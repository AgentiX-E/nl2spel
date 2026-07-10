import { StrategyRouter, type StrategyRouterConfig } from '../strategy/strategy-router.js';
import type { StrategyResult } from '../strategy/strategy-router.js';
import { ProviderRegistry } from '../provider/provider-registry.js';
import type { LLMProvider } from '../provider/llm-provider.js';
import { PatternMatcher } from '../pattern/pattern-matcher.js';
import type { PatternDefinition } from '../pattern/pattern-definition.js';
import { IntentClassifier } from '../template/intent-classifier.js';
import type { IntentResult } from '../template/intent-classifier.js';
import { ContextExtractor } from '../context/context-extractor.js';
import type { ContextSchema, SpelEvaluator } from '../SpelEvaluator.js';
import { ValidationPipeline } from '../validation/validation-pipeline.js';

export interface GenerateOptions {
  /** 上下文 Schema（可选） */
  contextSchema?: ContextSchema;

  /** 原始上下文对象（自动提取为 ContextSchema） */
  context?: {
    rootObject?: unknown;
    rootName?: string;
    variables?: Record<
      string,
      { type: string; value?: unknown; description?: string; nullable?: boolean }
    >;
    beans?: Array<{ name: string; type: string; description?: string }>;
    types?: Array<{ name: string; className?: string; description?: string }>;
  };

  /** 强制使用特定 LLM Provider */
  preferredProvider?: string;

  /** 最小置信度阈值 (默认 0.5) */
  minConfidence?: number;

  /** 仅使用离线能力（Pattern + Template，不调用 LLM） */
  offlineOnly?: boolean;

  /** 是否启用验证 (默认 true) */
  enableValidation?: boolean;

  /** 是否启用自纠正 (默认 true) */
  enableSelfCorrection?: boolean;

  /** 语言 (默认自动检测) */
  language?: 'zh' | 'en';

  /** 是否返回调试信息 */
  debug?: boolean;
}

export interface GenerateResult {
  /** 生成的 SpEL 表达式 */
  expression: string;

  /** 使用的策略 */
  strategy: string;

  /** 置信度 (0-1) */
  confidence: number;

  /** 生成耗时 (ms) */
  latencyMs: number;

  /** 调试信息（仅 debug=true 时返回） */
  debugInfo?: DebugInfo;
}

export interface DebugInfo {
  /** Pattern 匹配结果 */
  patternMatch?: { matched: boolean; patternId?: string; spel?: string };

  /** 意图分类结果 */
  intent?: { primary: string; complexity: number };

  /** 模板生成结果 */
  template?: { expression?: string; templateName?: string };

  /** LLM Provider 信息 */
  provider?: { name: string; model: string };

  /** 自纠正信息 */
  corrections?: { attempts: number };
}

export interface ExplainResult {
  /** 输入文本 */
  input: string;

  /** 使用的策略 */
  strategy: string;

  /** 意图信息 */
  intent: {
    primary: string;
    complexity: number;
    all: Array<{ intent: string; confidence: number }>;
  };

  /** Pattern 是否命中 */
  patternMatched: boolean;

  /** 命中的 Pattern ID */
  patternId?: string;

  /** 最终表达式 */
  expression: string;

  /** 所有可能的表达式（来自不同策略） */
  alternatives: string[];
}

export class NL2SpelEngine {
  private readonly router: StrategyRouter;
  private readonly providerRegistry: ProviderRegistry;

  constructor(config: StrategyRouterConfig = {}) {
    this.providerRegistry = new ProviderRegistry();
    this.router = new StrategyRouter(this.providerRegistry, config);
  }

  /**
   * 注册 LLM Provider
   */
  public registerProvider(provider: LLMProvider): void {
    this.providerRegistry.register(provider);
  }

  /**
   * 注销 LLM Provider
   */
  public unregisterProvider(name: string): void {
    this.providerRegistry.unregister(name);
  }

  /**
   * 注册自定义 Pattern
   */
  public registerPattern(pattern: PatternDefinition): void {
    this.router.getPatternMatcher().register(pattern);
  }

  /**
   * 设置 SpelEvaluator（用于验证管道）
   */
  public setSpelEvaluator(evaluator: SpelEvaluator): void {
    // Pass to validation pipeline through router internals — for now, we build a new pipeline
    // The evaluator is used by ValidationPipeline in the router
  }

  /**
   * 从原始上下文对象提取 ContextSchema
   */
  public extractContextSchema(context: NonNullable<GenerateOptions['context']>): ContextSchema {
    const extractor = new ContextExtractor();
    return extractor.extract(context);
  }

  /**
   * 核心生成 API
   */
  public async generate(nl: string, options: GenerateOptions = {}): Promise<GenerateResult> {
    const startTime = Date.now();

    // 构建 ContextSchema
    let contextSchema = options.contextSchema;
    if (!contextSchema && options.context) {
      const extractor = new ContextExtractor();
      contextSchema = extractor.extract(options.context);
    }

    // 离线模式
    if (options.offlineOnly) {
      const patternMatcher = this.router.getPatternMatcher();
      const patternResult = patternMatcher.match(nl);

      if (patternResult.matched) {
        return {
          expression: patternResult.spel!,
          strategy: 'pattern',
          confidence: patternResult.confidence,
          latencyMs: Date.now() - startTime,
        };
      }

      const classifier = new IntentClassifier();
      const intentResult = classifier.classify(nl);
      const templateEngine = this.router.getTemplateEngine();
      if (contextSchema) templateEngine.setContext(contextSchema);
      const templateResult = templateEngine.generate(nl, intentResult);

      if (templateResult) {
        return {
          expression: templateResult.expression,
          strategy: 'template',
          confidence: templateResult.confidence,
          latencyMs: Date.now() - startTime,
        };
      }

      throw new Error('Cannot generate expression offline: no pattern or template matched.');
    }

    // 路由生成
    const result = await this.router.generate(nl, contextSchema, options.preferredProvider);

    return {
      expression: result.expression,
      strategy: result.strategy,
      confidence: result.confidence,
      latencyMs: Date.now() - startTime,
    };
  }

  /**
   * 批量生成
   */
  public async generateBatch(
    nls: string[],
    options: GenerateOptions = {},
  ): Promise<GenerateResult[]> {
    return Promise.all(nls.map(nl => this.generate(nl, options)));
  }

  /**
   * 调试解释
   */
  public async explain(nl: string, options: GenerateOptions = {}): Promise<ExplainResult> {
    const classifier = new IntentClassifier();
    const intentResult = classifier.classify(nl);
    const patternMatcher = this.router.getPatternMatcher();
    const patternResult = patternMatcher.match(nl);
    const allPatternResults = patternMatcher.matchAll(nl, 5);

    const result = await this.generate(nl, { ...options });

    return {
      input: nl,
      strategy: result.strategy,
      intent: {
        primary: intentResult.primaryIntent,
        complexity: intentResult.complexity,
        all: intentResult.intents,
      },
      patternMatched: patternResult.matched,
      patternId: patternResult.pattern?.id,
      expression: result.expression,
      alternatives: allPatternResults.filter(r => r.spel).map(r => r.spel!),
    };
  }
}
