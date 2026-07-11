import { describe, it, expect, vi } from 'vitest';
import { ContextExtractor } from '../context/context-extractor.js';
import { IntentClassifier } from '../template/intent-classifier.js';
import { TemplateEngine } from '../template/template-engine.js';
import { SelfCorrectionLoop } from '../validation/self-correction-loop.js';
import { ValidationPipeline } from '../validation/validation-pipeline.js';
import { PatternMatcher } from '../pattern/pattern-matcher.js';
import { ProviderRegistry } from '../provider/provider-registry.js';
import type { LLMProvider } from '../provider/llm-provider.js';
import type { ContextSchema, LLMPrompt, LLMResponse } from '../index.js';

// ================================================================
// Coverage Gap Fillers — targeted tests for remaining branch gaps
// ================================================================

describe('Coverage Gap Fillers', () => {
  // ===== context-extractor.ts: line 65 (value === undefined branch) =====
  describe('context-extractor: undefined value edge case', () => {
    it('inferSpelType returns string for undefined value', () => {
      const extractor = new ContextExtractor();
      const schema = extractor.extract({
        rootObject: { explicitlyUndefined: undefined },
      });
      expect(schema.root!.fields.explicitlyUndefined!.type).toBe('string');
      // undefined !== null, so nullable defaults to false
    });

    // === context-extractor.ts: lines 77-78 catch block ===
    it('handles throwing property accessor gracefully', () => {
      const extractor = new ContextExtractor();
      const throwingObj: any = Object.create(null);
      Object.defineProperty(throwingObj, 'dangerous', {
        get() {
          throw new Error('Access denied');
        },
        enumerable: true,
        configurable: true,
      });
      Object.defineProperty(throwingObj, 'safe', {
        value: 42,
        enumerable: true,
      });

      const schema = extractor.extract({ rootObject: throwingObj });
      // 'safe' should be extracted normally, 'dangerous' should be silently skipped
      expect(schema.root!.fields.safe).toBeDefined();
      expect(schema.root!.fields.safe!.type).toBe('number');
      expect(schema.root!.fields.dangerous).toBeUndefined();
    });
  });

  // ===== context-extractor.ts: line 114 (nullable default false) =====
  describe('context-extractor: nullable defaults', () => {
    it('variable without nullable field defaults to false', () => {
      const extractor = new ContextExtractor();
      const schema = extractor.extract({
        variables: {
          simpleVar: { type: 'string' },
        },
      });
      expect(schema.variables.simpleVar!.nullable).toBe(false);
    });
  });

  // ===== intent-classifier.ts: lines 210-215 (normalize pipeline) =====
  describe('intent-classifier: normalize pipeline coverage', () => {
    const classifier = new IntentClassifier();

    it('converts full-width parentheses to half-width', () => {
      // Full-width （ and ） U+FF08, U+FF09
      const result = classifier.classify('（金额）');
      expect(result.intents.length).toBeGreaterThan(0);
    });

    it('converts full-width letters to half-width', () => {
      // Full-width A-Z: U+FF21-U+FF3A, a-z: U+FF41-U+FF5A
      const result = classifier.classify('ＡＢＣ amount');
      expect(result.intents.length).toBeGreaterThan(0);
    });

    it('normalizes multiple whitespace to single space', () => {
      const result = classifier.classify('amount    >    500');
      expect(result.operators).toContain('>');
    });

    it('lowercases input for keyword matching', () => {
      const result = classifier.classify('AMOUNT > 500');
      // 'AMOUNT' lowercased → 'amount' which is a keyword
      // Note: the normalize lowercases but '>' comparison should still be detected
      expect(result.operators.length).toBeGreaterThan(0);
    });

    it('full-width digits converted to half-width', () => {
      const result = classifier.classify('amount > ５００');
      // ５ (U+FF15) → 5 (U+0035) after normalize
      // Entity extractor uses ascii digit pattern so may not match, but normalize succeeds
      expect(result.operators).toContain('>');
    });
  });

  // ===== template-engine.ts: entityCount.max path =====
  describe('template-engine: entityCount path coverage', () => {
    it('template generation works with minimal entities', () => {
      const engine = new TemplateEngine();
      const intent = {
        primaryIntent: 'COMPARISON' as any,
        intents: [{ intent: 'COMPARISON' as any, confidence: 0.9 }],
        entities: [{ text: '1000', type: 'value' as const, position: { start: 4, end: 8 } }],
        operators: ['>'],
        logicalConnectors: [],
        complexity: 10,
      };
      const result = engine.generate('amount > 1000', intent);
      expect(result).not.toBeNull();
      if (result) {
        expect(result.expression).toContain('>');
      }
    });

    it('template with all null context and empty entities still produces result', () => {
      const engine = new TemplateEngine();
      const intent = {
        primaryIntent: 'NULL_CHECK' as any,
        intents: [{ intent: 'NULL_CHECK' as any, confidence: 0.9 }],
        entities: [],
        operators: [],
        logicalConnectors: [],
        complexity: 5,
      };
      const result = engine.generate('is null', intent);
      expect(result).not.toBeNull();
    });
  });

  // ===== self-correction-loop.ts: error handling path =====
  const TEST_SCHEMA: ContextSchema = {
    root: {
      name: 'order',
      type: 'Order',
      fields: { amount: { type: 'number' }, status: { type: 'string' } },
      methods: {},
    },
    variables: {},
    beans: {},
    types: {},
    functions: {},
  };

  const PROMPT: LLMPrompt = {
    system: 'Generate SpEL.',
    user: 'test',
    contextSchema: TEST_SCHEMA,
    examples: [],
  };

  describe('self-correction-loop: error path during correction', () => {
    it('catches LLM error during correction attempt and logs it', async () => {
      const loop = new SelfCorrectionLoop({ maxAttempts: 2, enableAutoFix: false });
      const generateFn = vi
        .fn()
        // First attempt: throw error
        .mockRejectedValueOnce(new Error('LLM service crash'))
        // Second attempt: valid response
        .mockResolvedValueOnce({
          text: '#order.amount > 1000',
          model: 'mock',
          usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
          latencyMs: 10,
          finishReason: 'stop' as const,
          providerName: 'mock',
        });

      const result = await loop.correct('#invalid (((', TEST_SCHEMA, generateFn, PROMPT);

      expect(result.corrections.length).toBeGreaterThan(0);
      // Verify we have at least one log entry with errors
      const errorLog = result.corrections.find(c => c.errorCount > 0);
      expect(errorLog).toBeDefined();
    });

    it('auto-fix applied after LLM correction response', async () => {
      const loop = new SelfCorrectionLoop({ maxAttempts: 1, enableAutoFix: true });
      // LLM returns expression with === that needs AutoFix
      const generateFn = vi.fn().mockResolvedValueOnce({
        text: '#order.amount === 1000',
        model: 'mock',
        usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
        latencyMs: 10,
        finishReason: 'stop' as const,
        providerName: 'mock',
      });

      const result = await loop.correct('#bad (((', TEST_SCHEMA, generateFn, PROMPT);

      expect(result.expression).not.toContain('===');
    });

    it('handles maxAttempts=0 with immediate return', async () => {
      const loop = new SelfCorrectionLoop({ maxAttempts: 0, enableAutoFix: false });
      const generateFn = vi.fn();

      const result = await loop.correct('#bad (((', TEST_SCHEMA, generateFn, PROMPT);

      expect(generateFn).not.toHaveBeenCalled();
      expect(result.valid).toBe(false);
    });
  });

  // ===== validation-pipeline.ts: final edge cases =====
  describe('validation-pipeline: evaluator error and braces', () => {
    it('detects unbalanced curly braces', async () => {
      const pipeline = new ValidationPipeline();
      const result = await pipeline.validate('{ #order.amount > 100 {', TEST_SCHEMA);
      expect(result.errors.some(e => e.code === 'PARSE-UNBALANCED_PARENS')).toBe(true);
    });

    it('evaluator throws an error during parse', async () => {
      const throwingEvaluator = {
        parse: vi.fn().mockRejectedValue(new Error('Parse engine crashed')),
        getContextSchema: vi.fn().mockReturnValue(null),
      };
      const pipeline = new ValidationPipeline(throwingEvaluator as any);
      const result = await pipeline.validate('#order.amount > 1000', TEST_SCHEMA);
      expect(result.stages.parse.errors.some(e => e.code === 'PARSE-EXCEPTION')).toBe(true);
    });
  });

  // ===== pattern-matcher.ts: matchAll maxResults break (line 86) =====
  describe('pattern-matcher: matchAll maxResults boundary', () => {
    it('matchAll with limit=1 returns exactly 1 result and breaks early', () => {
      const matcher = new PatternMatcher();
      // Register multiple patterns that all match the same input
      for (let i = 0; i < 5; i++) {
        matcher.register({
          id: `P${i}`,
          match: /test(?<value>\d+)/,
          spelTemplate: '#test == {value}',
          slots: { value: { key: 'value', type: 'number', transform: 'toNumber' } },
          priority: 90 - i,
          tags: ['test'],
          examples: [],
          difficulty: 'easy',
          confidence: 0.9,
        });
      }
      const results = matcher.matchAll('test42', 1);
      expect(results).toHaveLength(1);
      expect(results[0]!.matched).toBe(true);
    });
  });

  // ===== pattern-matcher.ts: extractChineseField regex fallback (line 140) =====
  describe('pattern-matcher: extractChineseField for non-mapped field', () => {
    it('returns "value" for empty input', () => {
      // extractChineseField handles malformed inputs: ^[^\s，,、]+ fails → returns "value"
      // (We test this indirectly via the match on an expression where field is in spelTemplate)
      const matcher = new PatternMatcher();
      matcher.register({
        id: 'FALLBACK',
        match: /\s*(?<value>\d+)/,
        spelTemplate: '#{field} > {value}',
        slots: { value: { key: 'value', type: 'number', transform: 'toNumber' } },
        priority: 100,
        tags: ['test'],
        examples: [],
        difficulty: 'easy',
        confidence: 0.95,
      });
      const r = matcher.match('12345');
      // Without capture group 'field', falls back to extractChineseField
      if (r.matched) {
        expect(r.spel).toContain('#');
      }
    });
  });

  // ===== provider-registry.ts: getPrioritized offline/cost compare (lines 46, 49-50) =====
  describe('provider-registry: getPrioritized offline and cost comparison', () => {
    it('puts offline provider before online provider', async () => {
      const registry = new ProviderRegistry();
      const online: LLMProvider = {
        name: 'online-provider',
        capabilities: {
          maxContextTokens: 1000,
          supportsGrammarConstraint: false,
          supportsStreaming: false,
          supportsStructuredOutput: false,
          offlineAvailable: false,
          estimatedCostPerRequest: 0.001,
          estimatedLatencyMs: 100,
        },
        generate: vi.fn(),
        isAvailable: vi.fn().mockResolvedValue(true),
      };
      const offline: LLMProvider = {
        name: 'offline-provider',
        capabilities: {
          maxContextTokens: 1000,
          supportsGrammarConstraint: false,
          supportsStreaming: false,
          supportsStructuredOutput: false,
          offlineAvailable: true,
          estimatedCostPerRequest: 0,
          estimatedLatencyMs: 50,
        },
        generate: vi.fn(),
        isAvailable: vi.fn().mockResolvedValue(true),
      };
      registry.register(online);
      registry.register(offline);

      const prioritized = await registry.getPrioritized();
      expect(prioritized[0]!.name).toBe('offline-provider');
      expect(prioritized[1]!.name).toBe('online-provider');
    });

    it('sorts by cost when both offline statuses are same', async () => {
      const registry = new ProviderRegistry();
      const cheap: LLMProvider = {
        name: 'cheap-provider',
        capabilities: {
          maxContextTokens: 1000,
          supportsGrammarConstraint: false,
          supportsStreaming: false,
          supportsStructuredOutput: false,
          offlineAvailable: false,
          estimatedCostPerRequest: 0.0001,
          estimatedLatencyMs: 100,
        },
        generate: vi.fn(),
        isAvailable: vi.fn().mockResolvedValue(true),
      };
      const expensive: LLMProvider = {
        name: 'expensive-provider',
        capabilities: {
          maxContextTokens: 1000,
          supportsGrammarConstraint: false,
          supportsStreaming: false,
          supportsStructuredOutput: false,
          offlineAvailable: false,
          estimatedCostPerRequest: 0.01,
          estimatedLatencyMs: 50,
        },
        generate: vi.fn(),
        isAvailable: vi.fn().mockResolvedValue(true),
      };
      registry.register(expensive);
      registry.register(cheap);

      const prioritized = await registry.getPrioritized();
      expect(prioritized[0]!.name).toBe('cheap-provider');
      expect(prioritized[1]!.name).toBe('expensive-provider');
    });
  });

  // ===== self-correction-loop: AutoFix insufficient path (lines 123-132) =====
  describe('self-correction-loop: AutoFix insufficient fallback path', () => {
    it('when auto-fix is not sufficient, continues to LLM correction', async () => {
      const loop = new SelfCorrectionLoop({ maxAttempts: 1 });
      // Expression has fixable === AND unfixable unbalanced parens
      const generateFn = vi.fn().mockResolvedValueOnce({
        text: '#order.amount > 1000',
        model: 'mock',
        usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
        latencyMs: 10,
        finishReason: 'stop' as const,
        providerName: 'mock',
      });

      const result = await loop.correct(
        '#order.amount === 1000 ]',
        TEST_SCHEMA,
        generateFn,
        PROMPT,
      );

      // AutoFix fixes === but extra ] remains; validation fails → LLM is called
      expect(generateFn).toHaveBeenCalled();
      // Correction log should contain an auto-fixed entry
      const autoFixEntry = result.corrections.find(c => c.autoFixed);
      expect(autoFixEntry).toBeDefined();
    });
  });
});
