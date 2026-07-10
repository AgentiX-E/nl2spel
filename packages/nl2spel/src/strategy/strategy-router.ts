import { PatternMatcher } from '../pattern/pattern-matcher.js';
import type { PatternMatchResult } from '../pattern/pattern-matcher.js';
import { BUILTIN_PATTERNS } from '../pattern/builtin-patterns.js';
import { IntentClassifier } from '../template/intent-classifier.js';
import type { IntentResult } from '../template/intent-classifier.js';
import { TemplateEngine } from '../template/template-engine.js';
import type { TemplateResult } from '../template/template-engine.js';
import { PromptBuilder } from '../template/prompts/prompt-builder.js';
import { ProviderRegistry } from '../provider/provider-registry.js';
import type { LLMProvider, LLMPrompt } from '../provider/llm-provider.js';
import type { ContextSchema } from '../SpelEvaluator.js';
import { ValidationPipeline } from '../validation/validation-pipeline.js';
import { AutoFixer } from '../validation/auto-fixer.js';
import { SelfCorrectionLoop } from '../validation/self-correction-loop.js';

export type StrategyType = 'pattern' | 'template' | 'llm-api' | 'llm-fallback' | 'none';

export interface StrategyResult {
  /** 生成的 SpEL 表达式 */
  expression: string;

  /** 使用的策略 */
  strategy: StrategyType;

  /** 置信度 (0-1) */
  confidence: number;

  /** 策略相关的元数据 */
  metadata: StrategyMetadata;

  /** 生成耗时 (ms) */
  latencyMs: number;
}

export interface StrategyMetadata {
  /** 命中的模式 ID (仅 pattern 策略) */
  patternId?: string;

  /** 意图类型 (仅 template 策略) */
  intent?: string;

  /** 模板名称 (仅 template 策略) */
  templateName?: string;

  /** LLM Provider 名称 (仅 llm 策略) */
  providerName?: string;

  /** LLM 模型 (仅 llm 策略) */
  model?: string;

  /** 修正次数 (仅 llm 策略 + self-correction) */
  corrections?: number;

  /** 原始 LLM 输出 (仅 llm 策略) */
  rawOutput?: string;
}

export interface StrategyRouterConfig {
  /** Pattern 置信度阈值 (默认 0.7) */
  patternMinConfidence?: number;
  /** Template 置信度阈值 (默认 0.6) */
  templateMinConfidence?: number;
  /** LLM 置信度阈值 (默认 0.5) */
  llmMinConfidence?: number;
  /** 是否启用 Self-Correction (默认 true) */
  enableSelfCorrection?: boolean;
  /** Self-Correction 最大尝试次数 (默认 3) */
  maxCorrectionAttempts?: number;
}

export class StrategyRouter {
  private readonly patternMatcher: PatternMatcher;
  private readonly intentClassifier: IntentClassifier;
  private readonly templateEngine: TemplateEngine;
  private readonly promptBuilder: PromptBuilder;
  private readonly validationPipeline: ValidationPipeline;
  private readonly autoFixer: AutoFixer;
  private readonly providerRegistry: ProviderRegistry;
  private readonly config: StrategyRouterConfig;

  constructor(providerRegistry: ProviderRegistry, config: StrategyRouterConfig = {}) {
    this.patternMatcher = new PatternMatcher(BUILTIN_PATTERNS);
    this.intentClassifier = new IntentClassifier();
    this.templateEngine = new TemplateEngine();
    this.promptBuilder = new PromptBuilder();
    this.validationPipeline = new ValidationPipeline();
    this.autoFixer = new AutoFixer();
    this.providerRegistry = providerRegistry;
    this.config = {
      patternMinConfidence: config.patternMinConfidence ?? 0.7,
      templateMinConfidence: config.templateMinConfidence ?? 0.6,
      llmMinConfidence: config.llmMinConfidence ?? 0.5,
      enableSelfCorrection: config.enableSelfCorrection ?? true,
      maxCorrectionAttempts: config.maxCorrectionAttempts ?? 3,
    };
  }

  /**
   * 执行完整的生成策略路由
   */
  public async generate(
    nl: string,
    contextSchema?: ContextSchema,
    forceLLMProvider?: string,
  ): Promise<StrategyResult> {
    const startTime = Date.now();

    if (contextSchema) {
      this.templateEngine.setContext(contextSchema);
    }

    // ---------- Layer 0: Pattern Matching ----------
    const patternResult = this.patternMatcher.match(nl);

    if (patternResult.matched && patternResult.confidence >= this.config.patternMinConfidence!) {
      // 验证 pattern 结果
      const validation = await this.validationPipeline.validate(patternResult.spel!, contextSchema);

      if (validation.valid) {
        return {
          expression: patternResult.spel!,
          strategy: 'pattern',
          confidence: patternResult.confidence,
          metadata: { patternId: patternResult.pattern?.id },
          latencyMs: Date.now() - startTime,
        };
      }

      // Pattern 结果验证失败，尝试 AutoFix
      const afResult = this.autoFixer.fix(patternResult.spel!);
      if (afResult.wasFixed) {
        const afValidation = await this.validationPipeline.validate(
          afResult.expression,
          contextSchema,
        );
        if (afValidation.valid) {
          return {
            expression: afResult.expression,
            strategy: 'pattern',
            confidence: patternResult.confidence * 0.95,
            metadata: { patternId: patternResult.pattern?.id },
            latencyMs: Date.now() - startTime,
          };
        }
      }
    }

    // ---------- Layer 1: Template ----------
    const intentResult = this.intentClassifier.classify(nl);
    const templateResult = this.templateEngine.generate(nl, intentResult);

    if (
      templateResult &&
      templateResult.confidence >= this.config.templateMinConfidence! &&
      templateResult.unfilledSlots.length === 0
    ) {
      // 验证模板结果
      const validation = await this.validationPipeline.validate(
        templateResult.expression,
        contextSchema,
      );

      if (validation.valid) {
        return {
          expression: templateResult.expression,
          strategy: 'template',
          confidence: templateResult.confidence,
          metadata: {
            intent: templateResult.intent,
            templateName: templateResult.templateName,
          },
          latencyMs: Date.now() - startTime,
        };
      }
    }

    // ---------- Layer 2: LLM ----------
    // 构建 prompt
    const prompt = this.promptBuilder.build(nl, contextSchema);

    // 获取可用提供者
    let providers = await this.providerRegistry.getPrioritized();

    // 如果指定了特定 provider，优先使用
    if (forceLLMProvider) {
      const forced = providers.find(p => p.name === forceLLMProvider);
      if (forced) {
        providers = [forced, ...providers.filter(p => p !== forced)];
      }
    }

    if (providers.length === 0) {
      throw new Error('No LLM providers available');
    }

    let lastError: Error | null = null;

    for (const provider of providers) {
      try {
        const response = await provider.generate(prompt, { timeout: 30000 });

        let expression = response.text.trim();
        let corrections = 0;

        // Self-Correction 循环
        if (this.config.enableSelfCorrection && contextSchema) {
          const correctionLoop = new SelfCorrectionLoop({
            maxAttempts: this.config.maxCorrectionAttempts,
          });
          const correctionResult = await correctionLoop.correct(
            expression,
            contextSchema,
            prompt => provider.generate(prompt),
            prompt,
          );
          expression = correctionResult.expression;
          corrections = correctionResult.correctionAttempts;
        }

        return {
          expression,
          strategy: 'llm-api',
          confidence: 0.8,
          metadata: {
            providerName: provider.name,
            model: response.model,
            corrections,
            rawOutput: response.text,
          },
          latencyMs: Date.now() - startTime,
        };
      } catch (err) {
        lastError = err as Error;
        // 尝试下一个 provider
        continue;
      }
    }

    // 所有 provider 失败
    throw new Error(`All LLM providers failed. Last error: ${lastError?.message ?? 'Unknown'}`);
  }

  /**
   * 获取 PatternMatcher（用于外部测试/调试）
   */
  public getPatternMatcher(): PatternMatcher {
    return this.patternMatcher;
  }

  /**
   * 获取 TemplateEngine
   */
  public getTemplateEngine(): TemplateEngine {
    return this.templateEngine;
  }

  /**
   * 获取 PromptBuilder
   */
  public getPromptBuilder(): PromptBuilder {
    return this.promptBuilder;
  }
}
