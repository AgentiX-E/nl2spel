import { PatternMatcher } from '../pattern/pattern-matcher.js';
import { BUILTIN_PATTERNS } from '../pattern/builtin-patterns.js';
import {
  decompose,
  splitClauses,
  UnconvertibleClauseError,
} from '../pattern/clause-splitter.js';
import { IntentClassifier } from '../template/intent-classifier.js';
import { TemplateEngine } from '../template/template-engine.js';
import type { TemplateResult } from '../template/template-engine.js';
import { PromptBuilder } from '../template/prompts/prompt-builder.js';
import { ProviderRegistry } from '../provider/provider-registry.js';
import type { ContextSchema, SpelEvaluator } from '@agentix-e/spel-ts';
import { ValidationPipeline } from '../validation/validation-pipeline.js';
import { AutoFixer } from '../validation/auto-fixer.js';
import { SelfCorrectionLoop } from '../validation/self-correction-loop.js';

export type StrategyType = 'pattern' | 'template' | 'llm-api' | 'llm-fallback' | 'none';

export interface StrategyResult {
  /** Generated SpEL expression */
  expression: string;

  /** Strategy used */
  strategy: StrategyType;

  /** Confidence (0-1) */
  confidence: number;

  /** Strategy-related metadata */
  metadata: StrategyMetadata;

  /** Generation latency (ms) */
  latencyMs: number;
}

export interface StrategyMetadata {
  /** Matched pattern ID (pattern strategy only) */
  patternId?: string;

  /** Clause texts, when a compound sentence was decomposed */
  clauses?: string[];

  /** Intent type (template strategy only) */
  intent?: string;

  /** Template name (template strategy only) */
  templateName?: string;

  /** LLM Provider name (llm strategy only) */
  providerName?: string;

  /** LLM model (llm strategy only) */
  model?: string;

  /** Correction count (llm strategy + self-correction only) */
  corrections?: number;

  /** Raw LLM output (llm strategy only) */
  rawOutput?: string;
}

/** A compound sentence converted clause by clause. */
export interface DecomposedConversion {
  /** The joined expression, with every operand parenthesised. */
  expression: string;

  /** The clause texts, in order. */
  clauses: string[];

  /** The lowest confidence among the converted clauses. */
  confidence: number;
}

export interface StrategyRouterConfig {
  /** Pattern confidence threshold (default 0.7) */
  patternMinConfidence?: number;
  /** Template confidence threshold (default 0.6) */
  templateMinConfidence?: number;
  /** LLM confidence threshold (default 0.5) */
  llmMinConfidence?: number;
  /** Whether Self-Correction is enabled (default true) */
  enableSelfCorrection?: boolean;
  /** Maximum Self-Correction attempts (default 3) */
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
   * Execute the full generation strategy routing
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
    // A compound sentence is decomposed rather than matched whole. The comparison
    // patterns match a prefix of their input, so matching whole would answer
    // `金额大于1000且订单已确认` with `#amount > 1000` and silently drop the
    // second requirement.
    let clauseFailure: UnconvertibleClauseError | null = null;

    if (splitClauses(nl).length > 1) {
      let decomposition: DecomposedConversion | null = null;
      try {
        decomposition = this.decomposeClauses(nl);
      } catch (error) {
        if (!(error instanceof UnconvertibleClauseError)) throw error;
        clauseFailure = error;
      }

      if (decomposition) {
        const validation = await this.validationPipeline.validate(
          decomposition.expression,
          contextSchema,
        );
        if (validation.valid) {
          return {
            expression: decomposition.expression,
            strategy: 'pattern',
            confidence: decomposition.confidence,
            metadata: { clauses: decomposition.clauses },
            latencyMs: Date.now() - startTime,
          };
        }
      }
      // A clause that could not be converted, or a joined expression that did not
      // validate, must NOT fall back to the whole-string match: that match is the
      // truncation this stage exists to prevent. The remaining layers are offered
      // the whole sentence instead, and `clauseFailure` is surfaced if they cannot
      // answer either.
    } else {
      const patternResult = this.patternMatcher.match(nl);

      if (patternResult.matched && patternResult.confidence >= this.config.patternMinConfidence!) {
        // Validate pattern result
        const validation = await this.validationPipeline.validate(
          patternResult.spel!,
          contextSchema,
        );

        if (validation.valid) {
          return {
            expression: patternResult.spel!,
            strategy: 'pattern',
            confidence: patternResult.confidence,
            metadata: { patternId: patternResult.pattern?.id },
            latencyMs: Date.now() - startTime,
          };
        }

        // Pattern result validation failed, try AutoFix
        try {
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
        } catch {
          // AutoFix failed, fall through to template/LLM layers
        }
      }
    }

    // ---------- Layer 1: Template ----------
    const intentResult = this.intentClassifier.classify(nl);
    let templateResult: TemplateResult | null = null;
    try {
      templateResult = this.templateEngine.generate(nl, intentResult);
    } catch {
      // Template generation failed, fall through to LLM fallback
    }

    if (
      templateResult &&
      templateResult.confidence >= this.config.templateMinConfidence! &&
      templateResult.unfilledSlots.length === 0
    ) {
      // Validate template result
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
    // Build prompt
    const prompt = this.promptBuilder.build(nl, contextSchema);

    // Get available providers
    let providers = await this.providerRegistry.getPrioritized();

    // If a specific provider is forced, use it first
    if (forceLLMProvider) {
      const forced = providers.find((p) => p.name === forceLLMProvider);
      if (forced) {
        providers = [forced, ...providers.filter((p) => p !== forced)];
      }
    }

    if (providers.length === 0) {
      // A compound sentence whose clauses could not all be converted is reported
      // as such: that is more useful than "no providers", and it is the honest
      // statement of why no rule can be produced.
      throw clauseFailure ?? new Error('No LLM providers available');
    }

    let lastError: Error | null = null;

    for (const provider of providers) {
      try {
        const response = await provider.generate(prompt, { timeout: 30000 });

        let expression = response.text.trim();
        let corrections = 0;

        // Self-Correction loop
        if (this.config.enableSelfCorrection && contextSchema) {
          const correctionLoop = new SelfCorrectionLoop(
            {
              maxAttempts: this.config.maxCorrectionAttempts,
            },
            this.validationPipeline,
          );
          const correctionResult = await correctionLoop.correct(
            expression,
            contextSchema,
            (prompt) => provider.generate(prompt),
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
        // Try next provider
        continue;
      }
    }

    // All providers failed
    throw new Error(`All LLM providers failed. Last error: ${lastError?.message ?? 'Unknown'}`);
  }

  /**
   * Get PatternMatcher (for external testing/debugging)
   */
  /**
   * Convert a sentence that joins its clauses with a logical connector.
   *
   * Returns `null` when `nl` has no top-level connector, in which case the caller
   * should use its ordinary single-pass conversion. Throws
   * {@link UnconvertibleClauseError} when a clause cannot be converted, so the
   * caller can refuse instead of emitting a partial rule.
   */
  public decomposeClauses(nl: string): DecomposedConversion | null {
    if (splitClauses(nl).length <= 1) return null;

    const confidences: number[] = [];
    const convert = (clause: string): string | null => {
      const result = this.patternMatcher.match(clause);
      if (!result.matched || result.confidence < this.config.patternMinConfidence!) {
        return null;
      }
      confidences.push(result.confidence);
      return result.spel!;
    };

    const decomposition = decompose(nl, convert);
    if (decomposition === null) return null;

    return {
      expression: decomposition.expression,
      clauses: decomposition.clauses,
      confidence: confidences.length > 0 ? Math.min(...confidences) : 0,
    };
  }

  public getPatternMatcher(): PatternMatcher {
    return this.patternMatcher;
  }

  /**
   * Get TemplateEngine
   */
  public getTemplateEngine(): TemplateEngine {
    return this.templateEngine;
  }

  /**
   * Get PromptBuilder
   */
  public getPromptBuilder(): PromptBuilder {
    return this.promptBuilder;
  }

  /**
   * Set SpelEvaluator for validation pipeline.
   * Must be called before generate() if parse-level validation is needed.
   */
  public setEvaluator(evaluator: SpelEvaluator): void {
    this.validationPipeline.setEvaluator(evaluator);
  }
}
