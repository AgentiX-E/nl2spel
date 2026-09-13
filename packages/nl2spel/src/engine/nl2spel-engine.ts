import { StrategyRouter, type StrategyRouterConfig } from '../strategy/strategy-router.js';
import { ProviderRegistry } from '../provider/provider-registry.js';
import type { LLMProvider } from '../provider/llm-provider.js';
import type { PatternDefinition } from '../pattern/pattern-definition.js';
import { splitClauses } from '../pattern/clause-splitter.js';
import { IntentClassifier } from '../template/intent-classifier.js';
import { ContextExtractor } from '../context/context-extractor.js';
import type { ContextSchema, SpelEvaluator } from '@agentix-e/spel-ts';

export interface GenerateOptions {
  /** Context Schema (optional) */
  contextSchema?: ContextSchema;

  /** Raw context object (auto-extracted to ContextSchema) */
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

  /** Force using a specific LLM Provider */
  preferredProvider?: string;

  /** Minimum confidence threshold (default 0.5) */
  minConfidence?: number;

  /** Offline only (Pattern + Template, no LLM calls) */
  offlineOnly?: boolean;

  /** Whether validation is enabled (default true) */
  enableValidation?: boolean;

  /** Whether self-correction is enabled (default true) */
  enableSelfCorrection?: boolean;

  /** Language (default auto-detect) */
  language?: 'zh' | 'en';

  /** Whether to return debug information */
  debug?: boolean;
}

export interface GenerateResult {
  /** Generated SpEL expression */
  expression: string;

  /** Strategy used */
  strategy: string;

  /** Confidence (0-1) */
  confidence: number;

  /** Generation latency (ms) */
  latencyMs: number;

  /** Debug info (only when debug=true) */
  debugInfo?: DebugInfo;
}

export interface DebugInfo {
  /** Pattern match result */
  patternMatch?: { matched: boolean; patternId?: string; spel?: string };

  /** Intent classification result */
  intent?: { primary: string; complexity: number };

  /** Template generation result */
  template?: { expression?: string; templateName?: string };

  /** LLM Provider info */
  provider?: { name: string; model: string };

  /** Self-correction info */
  corrections?: { attempts: number };
}

export interface ExplainResult {
  /** Input text */
  input: string;

  /** Strategy used */
  strategy: string;

  /** Intent information */
  intent: {
    primary: string;
    complexity: number;
    all: Array<{ intent: string; confidence: number }>;
  };

  /** Whether pattern was matched */
  patternMatched: boolean;

  /** Matched Pattern ID */
  patternId?: string;

  /** Final expression */
  expression: string;

  /** All possible expressions (from different strategies) */
  alternatives: string[];
}

export class NL2SpelEngine {
  private readonly router: StrategyRouter;
  private readonly providerRegistry: ProviderRegistry;
  private evaluatorInstance: SpelEvaluator | null = null;

  constructor(config: StrategyRouterConfig = {}) {
    this.providerRegistry = new ProviderRegistry();
    this.router = new StrategyRouter(this.providerRegistry, config);
  }

  /**
   * Register an LLM Provider
   */
  public registerProvider(provider: LLMProvider): void {
    this.providerRegistry.register(provider);
  }

  /**
   * Unregister an LLM Provider
   */
  public unregisterProvider(name: string): void {
    this.providerRegistry.unregister(name);
  }

  /**
   * Register a custom Pattern
   */
  public registerPattern(pattern: PatternDefinition): void {
    this.router.getPatternMatcher().register(pattern);
  }

  /**
   * Set SpelEvaluator for validation pipeline.
   * Must be called before generate() if parse-level validation is required.
   */
  public setSpelEvaluator(evaluator: SpelEvaluator): void {
    this.evaluatorInstance = evaluator;
    this.router.setEvaluator(evaluator);
  }

  /**
   * Extract ContextSchema from raw context object
   */
  public extractContextSchema(context: NonNullable<GenerateOptions['context']>): ContextSchema {
    const extractor = new ContextExtractor();
    return extractor.extract(context);
  }

  /**
   * Core generation API
   */
  public async generate(nl: string, options: GenerateOptions = {}): Promise<GenerateResult> {
    const startTime = Date.now();

    // Build ContextSchema — priority: explicit > evaluator > raw context
    let contextSchema = options.contextSchema;
    if (!contextSchema && this.evaluatorInstance) {
      const schema = await Promise.resolve(this.evaluatorInstance.getContextSchema());
      if (schema) contextSchema = schema;
    }
    if (!contextSchema && options.context) {
      const extractor = new ContextExtractor();
      contextSchema = extractor.extract(options.context);
    }

    // Offline mode
    if (options.offlineOnly) {
      // A compound sentence is decomposed rather than matched whole, because the
      // comparison patterns match a prefix of their input: matching whole would
      // answer `金额大于1000且订单已确认` with `#amount > 1000` and silently drop
      // the second requirement. A pattern tagged `logic` expresses the whole
      // sentence already, so it is preferred over decomposition.
      const patternMatcher = this.router.getPatternMatcher();
      const patternResult = patternMatcher.match(nl);
      const isCompound = splitClauses(nl).length > 1;
      const wholeIsFaithful =
        patternResult.matched && (patternResult.pattern?.tags.includes('logic') ?? false);

      if (isCompound && !wholeIsFaithful) {
        // Throws UnconvertibleClauseError, naming the clause it could not convert,
        // rather than returning a partial rule.
        const decomposition = this.router.decomposeClauses(nl);
        if (decomposition) {
          return {
            expression: decomposition.expression,
            strategy: 'pattern',
            confidence: decomposition.confidence,
            latencyMs: Date.now() - startTime,
          };
        }
        throw new Error(
          `Cannot generate expression offline: '${nl}' joins clauses but they could not all be converted.`,
        );
      }

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

    // Route generation
    const result = await this.router.generate(nl, contextSchema, options.preferredProvider);

    return {
      expression: result.expression,
      strategy: result.strategy,
      confidence: result.confidence,
      latencyMs: Date.now() - startTime,
    };
  }

  /**
   * Batch generation
   */
  public async generateBatch(
    nls: string[],
    options: GenerateOptions = {},
  ): Promise<GenerateResult[]> {
    return Promise.all(nls.map((nl) => this.generate(nl, options)));
  }

  /**
   * Debug explanation
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
      alternatives: allPatternResults.filter((r) => r.spel).map((r) => r.spel!),
    };
  }
}
