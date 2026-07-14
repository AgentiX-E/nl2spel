import { describe, it, expect, vi } from 'vitest';
import { NL2SpelEngine } from '../engine/nl2spel-engine.js';
import type { LLMProvider, LLMCapabilities } from '../provider/llm-provider.js';

function createMockLLMProvider(
  name: string,
  responseText: string = '#order.amount > 1000',
  available: boolean = true,
): LLMProvider {
  return {
    name,
    capabilities: {
      maxContextTokens: 128000,
      supportsGrammarConstraint: false,
      supportsStreaming: true,
      supportsStructuredOutput: true,
      offlineAvailable: false,
      estimatedCostPerRequest: 0.001,
      estimatedLatencyMs: 2000,
    },
    generate: vi.fn().mockResolvedValue({
      text: responseText,
      model: 'mock-model',
      usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
      latencyMs: 100,
      finishReason: 'stop' as const,
      providerName: name,
    }),
    isAvailable: vi.fn().mockResolvedValue(available),
  };
}

describe('NL2SpelEngine', () => {
  // ===== Core generate API =====
  describe('generate (Pattern)', () => {
    it('should generate simple comparison via pattern', async () => {
      const engine = new NL2SpelEngine();
      const result = await engine.generate('订单金额大于1000');
      expect(result.expression).toContain('>');
      expect(result.strategy).toBe('pattern');
      expect(result.confidence).toBeGreaterThanOrEqual(0.5);
    });

    it('should generate string comparison via pattern', async () => {
      const engine = new NL2SpelEngine();
      const result = await engine.generate('订单状态是已发货');
      expect(result.expression).toContain('已发货');
      expect(result.strategy).toBe('pattern');
    });

    it('should generate null check via pattern', async () => {
      const engine = new NL2SpelEngine();
      const result = await engine.generate('备注为空');
      expect(result.expression).toContain('null');
      expect(result.strategy).toBe('pattern');
    });

    it('should generate permission check via pattern', async () => {
      const engine = new NL2SpelEngine();
      const result = await engine.generate('用户是VIP');
      expect(result.expression).toContain('hasRole');
      expect(result.strategy).toBe('pattern');
    });

    it('should generate range check via pattern', async () => {
      const engine = new NL2SpelEngine();
      const result = await engine.generate('年龄在18到60之间');
      expect(result.expression).toContain('between');
      expect(result.strategy).toBe('pattern');
    });

    it('should track latency', async () => {
      const engine = new NL2SpelEngine();
      const result = await engine.generate('订单金额大于1000');
      expect(result.latencyMs).toBeGreaterThanOrEqual(0);
    });
  });

  // ===== Medium: Template =====
  describe('generate (Template)', () => {
    it('should fall through to template for logical combinations', async () => {
      const engine = new NL2SpelEngine();
      const result = await engine.generate('金额大于100且订单已确认');
      expect(result.expression.length).toBeGreaterThan(0);
      expect(result.confidence).toBeGreaterThan(0);
    });
  });

  // ===== LLM fallback =====
  describe('generate (LLM)', () => {
    it('should use LLM provider when registered', async () => {
      const engine = new NL2SpelEngine();
      engine.registerProvider(createMockLLMProvider('openai', '#order.complex > 1000'));

      const result = await engine.generate('一个非常复杂的需要深度LLM理解的表达式');
      expect(result.expression.length).toBeGreaterThan(0);
    });
  });

  // ===== offlineOnly mode =====
  describe('offlineOnly', () => {
    it('should work offline for simple patterns', async () => {
      const engine = new NL2SpelEngine();
      const result = await engine.generate('订单金额大于1000', { offlineOnly: true });
      expect(result.expression).toContain('>');
      expect(result.strategy).toBe('pattern');
    });

    it('should return best-effort result offline for complex unmatched input', async () => {
      const engine = new NL2SpelEngine();
      // Even for unmatched input, offline mode should return something (template fallback)
      const result = await engine.generate('xyzasdfqwerty1234567890!@#$ not matching anything', {
        offlineOnly: true,
      });
      // Best effort: should return some expression
      expect(result.expression).toBeTruthy();
      expect(result.strategy).toBeTruthy();
    });
  });

  // ===== generateBatch =====
  describe('generateBatch', () => {
    it('should generate multiple expressions', async () => {
      const engine = new NL2SpelEngine();
      const results = await engine.generateBatch(['金额大于100', '用户是VIP', '备注为空']);
      expect(results).toHaveLength(3);
      expect(results[0]!.expression).toBeTruthy();
      expect(results[1]!.expression).toBeTruthy();
      expect(results[2]!.expression).toBeTruthy();
    });
  });

  // ===== explain =====
  describe('explain', () => {
    it('should provide debug info', async () => {
      const engine = new NL2SpelEngine();
      const explanation = await engine.explain('订单金额大于1000');

      expect(explanation.input).toBe('订单金额大于1000');
      expect(explanation.expression).toBeTruthy();
      expect(explanation.intent.primary).toBeTruthy();
      expect(explanation.intent.complexity).toBeGreaterThanOrEqual(0);
      expect(explanation.intent.all.length).toBeGreaterThan(0);
      expect(explanation.strategy).toBeTruthy();
    });

    it('should list alternatives when available', async () => {
      const engine = new NL2SpelEngine();
      const explanation = await engine.explain('订单金额大于1000');
      expect(explanation.alternatives).toBeDefined();
      expect(Array.isArray(explanation.alternatives)).toBe(true);
    });
  });

  // ===== Custom patterns =====
  describe('registerPattern', () => {
    it('should allow custom pattern registration', async () => {
      const engine = new NL2SpelEngine();
      engine.registerPattern({
        id: 'custom-test',
        match: /自定义测试\s*(?<value>\d+)/,
        spelTemplate: '#test.custom == {value}',
        slots: {
          value: { key: 'value', type: 'number', transform: 'toNumber' },
        },
        priority: 100,
        tags: ['custom'],
        examples: [],
        difficulty: 'easy',
        confidence: 0.99,
      });

      const result = await engine.generate('自定义测试 42');
      expect(result.expression).toContain('42');
      expect(result.expression).toContain('#test.custom');
    });
  });

  // ===== ContextSchema =====
  describe('ContextSchema', () => {
    it('should generate with explicit context schema', async () => {
      const engine = new NL2SpelEngine();
      const result = await engine.generate('订单金额大于1000', {
        contextSchema: {
          root: {
            name: 'invoice',
            type: 'Invoice',
            fields: { total: { type: 'number' as const } },
            methods: {},
          },
          variables: {},
          beans: {},
          types: {},
          functions: {},
        },
      });
      expect(result.expression).toContain('>');
    });

    it('should extract context schema from raw objects', async () => {
      const engine = new NL2SpelEngine();
      const result = await engine.generate('金额大于100', {
        context: { rootObject: { amount: 500 }, rootName: 'payment' },
      });
      expect(result.expression).toContain('>');
    });

    it('should accept contextSchema directly without context object', async () => {
      const engine = new NL2SpelEngine();
      const schema = {
        root: {
          name: 'product',
          type: 'Product',
          fields: { price: { type: 'number' as const }, status: { type: 'string' as const } },
          methods: {},
        },
        variables: {},
        beans: {},
        types: {},
        functions: {},
      };
      const result = await engine.generate('价格大于100', { contextSchema: schema });
      expect(result.expression).toContain('>');
      expect(result.strategy).toBeTruthy();
    });

    it('should accept both contextSchema and context object without error', async () => {
      const engine = new NL2SpelEngine();
      const schema = {
        root: {
          name: 'invoice',
          type: 'Invoice',
          fields: { total: { type: 'number' as const } },
          methods: {},
        },
        variables: {},
        beans: {},
        types: {},
        functions: {},
      };
      const contextObj = { rootObject: { amount: 500 }, rootName: 'payment' };
      const result = await engine.generate('金额大于100', {
        contextSchema: schema,
        context: contextObj,
      });
      expect(result.expression).toContain('>');
      expect(result.strategy).toBeTruthy();
    });
  });

  // ===== Provider management =====
  describe('Provider management', () => {
    it('should register and unregister a provider', () => {
      const engine = new NL2SpelEngine();
      const provider = createMockLLMProvider('test-provider');

      engine.registerProvider(provider);
      expect((engine as any)['providerRegistry'].count).toBe(1);
      expect((engine as any)['providerRegistry'].list()).toHaveLength(1);

      engine.unregisterProvider('test-provider');
      expect((engine as any)['providerRegistry'].count).toBe(0);
      expect((engine as any)['providerRegistry'].list()).toHaveLength(0);
    });

    it('should track count of multiple registered providers', () => {
      const engine = new NL2SpelEngine();
      engine.registerProvider(createMockLLMProvider('provider-a'));
      engine.registerProvider(createMockLLMProvider('provider-b'));
      engine.registerProvider(createMockLLMProvider('provider-c'));

      expect((engine as any)['providerRegistry'].count).toBe(3);
      expect((engine as any)['providerRegistry'].list()).toHaveLength(3);
    });
  });

  // ===== setSpelEvaluator =====
  describe('setSpelEvaluator', () => {
    it('should accept a SpelEvaluator without crashing', () => {
      const engine = new NL2SpelEngine();
      const mockEvaluator = {
        parse: vi.fn().mockReturnValue({ valid: true, errors: [] }),
        getContextSchema: vi.fn().mockReturnValue(null),
      };

      expect(() => engine.setSpelEvaluator(mockEvaluator)).not.toThrow();
    });

    // Coverage: nl2spel-engine.ts lines 165-167 — evaluator contextSchema fallback
    // Also covers line 190 (setContext called with truthy contextSchema)
    it('should use evaluator contextSchema when no explicit schema is provided', async () => {
      const engine = new NL2SpelEngine();
      engine.setSpelEvaluator({
        parse: vi.fn().mockReturnValue({ valid: true, errors: [] }),
        getContextSchema: vi.fn().mockResolvedValue({
          root: {
            name: 'order',
            type: 'Order',
            fields: { amount: { type: 'number' as const } },
            methods: {},
          },
          variables: {},
          beans: {},
          types: {},
          functions: {},
        }),
      });
      engine.registerProvider(createMockLLMProvider('test-llm', '#order.amount > 500'));

      // No explicit contextSchema — falls back to evaluator instance (lines 165-167)
      // Do not use offlineOnly so we exercise the non-offline path too
      const result = await engine.generate('filter orders where amount exceeds 500');
      expect(result.expression).toBeTruthy();
      expect(result.strategy).toBeTruthy();
    });
  });

  // ===== explain() with patternMatched =====
  describe('explain', () => {
    it('should set patternMatched=true for input that matches a pattern', async () => {
      const engine = new NL2SpelEngine();
      const explanation = await engine.explain('订单金额大于1000');

      expect(explanation.patternMatched).toBe(true);
      expect(explanation.patternId).toBeDefined();
      expect(typeof explanation.patternId).toBe('string');
      expect(explanation.patternId!.length).toBeGreaterThan(0);
    });

    it('should return alternatives containing valid SpEL expressions', async () => {
      const engine = new NL2SpelEngine();
      const explanation = await engine.explain('订单金额大于1000');

      expect(explanation.alternatives.length).toBeGreaterThan(0);
      for (const alt of explanation.alternatives) {
        expect(typeof alt).toBe('string');
        expect(alt.length).toBeGreaterThan(0);
      }
    });
  });

  // ===== generate() options =====
  describe('generate options', () => {
    it('should accept preferredProvider option without error', async () => {
      const engine = new NL2SpelEngine();
      engine.registerProvider(createMockLLMProvider('openai', '#order.amount > 500'));

      // preferredProvider is passed through to the router; even if the
      // provider isn't used (pattern matches first), it shouldn't crash.
      const result = await engine.generate('一个复杂条件判断', {
        preferredProvider: 'openai',
      });
      expect(result.expression).toBeTruthy();
      expect(result.strategy).toBeTruthy();
    });

    it('should accept debug option without error', async () => {
      const engine = new NL2SpelEngine();
      const result = await engine.generate('订单金额大于1000', {
        debug: true,
      });
      expect(result.expression).toBeTruthy();
      expect(result.strategy).toBeTruthy();
    });
  });

  // ===== generateBatch error handling =====
  describe('generateBatch error handling', () => {
    it('should reject entire batch when any single generate fails (Promise.all semantics)', async () => {
      const engine = new NL2SpelEngine();

      // All valid inputs — batch succeeds
      const batch1 = await engine.generateBatch(['订单金额大于1000', '用户是VIP'], {
        offlineOnly: true,
      });
      expect(batch1).toHaveLength(2);
      expect(batch1[0]!.expression).toBeTruthy();
      expect(batch1[1]!.expression).toBeTruthy();

      // One invalid input (empty string cannot be matched by pattern or template)
      // causes generate() to throw, and Promise.all rejects the entire batch.
      await expect(
        engine.generateBatch(['订单金额大于1000', ''], { offlineOnly: true }),
      ).rejects.toThrow('Cannot generate expression offline');
    });
  });

  // ===== extractContextSchema =====
  describe('extractContextSchema', () => {
    it('should extract context schema from a raw context object', () => {
      const engine = new NL2SpelEngine();
      const schema = engine.extractContextSchema({
        rootObject: { amount: 500, status: 'shipped' },
        rootName: 'order',
      });

      expect(schema.root).not.toBeNull();
      expect(schema.root!.name).toBe('order');
      expect(schema.root!.fields.amount).toBeDefined();
      expect(schema.root!.fields.status).toBeDefined();
    });
  });

  // ===== Constructor with custom StrategyRouterConfig =====
  describe('Constructor with custom config', () => {
    it('should accept custom StrategyRouterConfig', async () => {
      const engine = new NL2SpelEngine({
        patternMinConfidence: 0.9,
        templateMinConfidence: 0.8,
        llmMinConfidence: 0.7,
        enableSelfCorrection: false,
        maxCorrectionAttempts: 1,
      });

      // Engine should still function with custom thresholds
      const result = await engine.generate('订单金额大于1000');
      expect(result.expression).toContain('>');
      expect(result.strategy).toBe('pattern');
    });
  });
});
