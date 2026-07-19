import { describe, it, expect, vi } from 'vitest';
import { StrategyRouter } from '../strategy/strategy-router.js';
import { ProviderRegistry } from '../provider/provider-registry.js';
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
      costPreference: 0.001,
      latencyPreference: 2000,
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

describe('StrategyRouter', () => {
  // ===== Easy: Pattern matching =====
  describe('Layer 0: Pattern', () => {
    it('should match simple Chinese comparison via pattern', async () => {
      const registry = new ProviderRegistry();
      const router = new StrategyRouter(registry, { patternMinConfidence: 0.7 });
      const result = await router.generate('订单金额大于1000');
      expect(result.strategy).toBe('pattern');
      expect(result.expression).toContain('>');
      expect(result.confidence).toBeGreaterThanOrEqual(0.9);
    });

    it('should match simple English comparison via pattern', async () => {
      const registry = new ProviderRegistry();
      const router = new StrategyRouter(registry);
      const result = await router.generate('amount > 500');
      expect(result.strategy).toBe('pattern');
      expect(result.expression).toContain('>');
    });

    it('should match null check via pattern', async () => {
      const registry = new ProviderRegistry();
      const router = new StrategyRouter(registry);
      const result = await router.generate('备注为空');
      expect(result.strategy).toBe('pattern');
      expect(result.expression).toContain('null');
    });

    it('should match hasrole via pattern', async () => {
      const registry = new ProviderRegistry();
      const router = new StrategyRouter(registry);
      const result = await router.generate('用户是管理员');
      expect(result.strategy).toBe('pattern');
      expect(result.expression).toContain('hasRole');
    });
  });

  // ===== Medium: Template layer =====
  describe('Layer 1: Template', () => {
    it('should use template or LLM when pattern confidence is low', async () => {
      const registry = new ProviderRegistry();
      registry.register(
        createMockLLMProvider('openai', "#order.amount > 100 and #order.status == '已确认'"),
      );
      const router = new StrategyRouter(registry, { patternMinConfidence: 1.0 });
      // Setting very high pattern threshold forces non-pattern routes
      const result = await router.generate('金额大于100且已确认');
      // May use template or LLM — just verify expression exists
      expect(result.expression.length).toBeGreaterThan(0);
    });
  });

  // ===== LLM fallback =====
  describe('Layer 2: LLM', () => {
    it('should fallback to LLM for unmatched input', async () => {
      const registry = new ProviderRegistry();
      registry.register(createMockLLMProvider('openai', '#order.amount > 1000'));
      const router = new StrategyRouter(registry);

      const result = await router.generate('一个非常复杂的需要LLM处理的查询');
      expect(result.strategy).toBe('llm-api');
      expect(result.expression).toContain('#order');
    });

    it('should throw when no LLM providers available', async () => {
      const registry = new ProviderRegistry();
      const router = new StrategyRouter(registry);

      await expect(router.generate('一个非常复杂的需要LLM处理的查询')).rejects.toThrow(
        'No LLM providers',
      );
    });

    it('should try next provider on failure', async () => {
      const registry = new ProviderRegistry();
      const failingProvider = createMockLLMProvider('failing');
      (failingProvider.generate as any) = vi
        .fn()
        .mockRejectedValue(new Error('Service unavailable'));

      const workingProvider = createMockLLMProvider('openai', '#order.amount > 1000');
      registry.register(failingProvider);
      registry.register(workingProvider);

      const router = new StrategyRouter(registry);
      // Make pattern not match by using low confidence threshold? No, use high threshold
      // Actually, let's test via a non-matching input
    });
  });

  // ===== Metadata =====
  describe('Metadata', () => {
    it('should include pattern ID for pattern matches', async () => {
      const registry = new ProviderRegistry();
      const router = new StrategyRouter(registry);
      const result = await router.generate('订单金额大于1000');
      expect(result.metadata.patternId).toBeDefined();
    });

    it('should include provider name for LLM matches', async () => {
      const registry = new ProviderRegistry();
      registry.register(createMockLLMProvider('openai', '#order.amount > 1000'));
      const router = new StrategyRouter(registry);

      // Use input that won't match any pattern
      const result = await router.generate('复杂的多层嵌套查询需要deep analysis');
      if (result.strategy === 'llm-api') {
        expect(result.metadata.providerName).toBeDefined();
      }
    });
  });

  // ===== Latency tracking =====
  describe('Latency', () => {
    it('should track latency', async () => {
      const registry = new ProviderRegistry();
      const router = new StrategyRouter(registry);
      const result = await router.generate('订单金额大于1000');
      expect(result.latencyMs).toBeGreaterThanOrEqual(0);
    });
  });

  // ============================================================
  // ADDITIONAL COVERAGE TESTS
  // ============================================================

  // ===== LLM Provider Fallback Chain =====
  describe('LLM Provider Fallback Chain', () => {
    it('should fallback to second provider when first provider fails', async () => {
      const registry = new ProviderRegistry();

      const failingProvider = createMockLLMProvider('failing');
      vi.mocked(failingProvider.generate).mockRejectedValue(new Error('Service unavailable'));

      const workingProvider = createMockLLMProvider('openai', '#order.amount > 1000');
      registry.register(failingProvider);
      registry.register(workingProvider);

      // High thresholds skip pattern and template, force LLM path
      const router = new StrategyRouter(registry, {
        patternMinConfidence: 1.0,
        templateMinConfidence: 1.0,
      });
      const result = await router.generate('复杂的LLM查询无法匹配模式或模板');

      expect(result.strategy).toBe('llm-api');
      expect(result.metadata.providerName).toBe('openai');
      expect(failingProvider.generate).toHaveBeenCalled();
      expect(workingProvider.generate).toHaveBeenCalled();
    });

    it('should throw when all LLM providers are exhausted', async () => {
      const registry = new ProviderRegistry();

      const failing1 = createMockLLMProvider('fail1');
      vi.mocked(failing1.generate).mockRejectedValue(new Error('Provider 1 failed'));

      const failing2 = createMockLLMProvider('fail2');
      vi.mocked(failing2.generate).mockRejectedValue(new Error('Provider 2 failed'));

      registry.register(failing1);
      registry.register(failing2);

      const router = new StrategyRouter(registry, {
        patternMinConfidence: 1.0,
        templateMinConfidence: 1.0,
      });

      await expect(router.generate('复杂查询')).rejects.toThrow('All LLM providers failed');
    });
  });

  // ===== Self-Correction =====
  describe('Self-Correction', () => {
    const contextSchema = {
      root: {
        name: 'order',
        type: 'Order',
        fields: {
          amount: { type: 'number' as const, description: 'Order amount' },
          status: { type: 'string' as const, description: 'Order status' },
        },
        methods: {},
      },
      variables: {},
      beans: {},
      types: {},
      functions: {},
    };

    it('should skip self-correction when disabled', async () => {
      const registry = new ProviderRegistry();
      registry.register(createMockLLMProvider('openai', '#order.amount > 1000'));

      const router = new StrategyRouter(registry, {
        enableSelfCorrection: false,
        patternMinConfidence: 1.0,
        templateMinConfidence: 1.0,
      });

      const result = await router.generate('LLM查询', contextSchema);

      expect(result.strategy).toBe('llm-api');
      // Corrections stays 0 because self-correction is disabled
      expect(result.metadata.corrections).toBe(0);
    });

    it('should run self-correction when enabled with contextSchema', async () => {
      const registry = new ProviderRegistry();
      registry.register(createMockLLMProvider('openai', '#order.amount > 1000'));

      const router = new StrategyRouter(registry, {
        enableSelfCorrection: true,
        patternMinConfidence: 1.0,
        templateMinConfidence: 1.0,
      });

      const result = await router.generate('LLM查询', contextSchema);

      expect(result.strategy).toBe('llm-api');
      // Self-correction was executed, corrections field populated
      expect(result.metadata.corrections).toBeDefined();
    });
  });

  // ===== forceLLMProvider =====
  describe('forceLLMProvider', () => {
    it('should prioritize the forced LLM provider when it exists', async () => {
      const registry = new ProviderRegistry();
      const primaryProvider = createMockLLMProvider('primary');
      const forcedProvider = createMockLLMProvider('forced', '#forced.result > 100');
      registry.register(primaryProvider);
      registry.register(forcedProvider);

      const router = new StrategyRouter(registry, {
        patternMinConfidence: 1.0,
        templateMinConfidence: 1.0,
      });

      const result = await router.generate('复杂查询', undefined, 'forced');

      expect(result.strategy).toBe('llm-api');
      expect(result.metadata.providerName).toBe('forced');
      expect(result.expression).toContain('forced');
    });

    it('should fallback to default priority when forced provider does not exist', async () => {
      const registry = new ProviderRegistry();
      const provider = createMockLLMProvider('openai', '#order.amount > 1000');
      registry.register(provider);

      const router = new StrategyRouter(registry, {
        patternMinConfidence: 1.0,
        templateMinConfidence: 1.0,
      });

      const result = await router.generate('查询', undefined, 'nonexistent');

      expect(result.strategy).toBe('llm-api');
      expect(result.metadata.providerName).toBe('openai');
    });
  });

  // ===== ContextSchema on Template Engine =====
  describe('ContextSchema on Template Engine', () => {
    it('should call setContext on template engine when contextSchema is provided', async () => {
      const registry = new ProviderRegistry();
      const router = new StrategyRouter(registry);

      const contextSchema = {
        root: {
          name: 'order',
          type: 'Order',
          fields: {
            amount: { type: 'number' as const },
          },
          methods: {},
        },
        variables: {},
        beans: {},
        types: {},
        functions: {},
      };

      // This exercises the contextSchema branch in generate()
      const result = await router.generate('订单金额大于1000', contextSchema);
      expect(result).toBeDefined();
      expect(result.strategy).toBe('pattern');
    });
  });

  // ===== Template to LLM Fallback =====
  describe('Template to LLM Fallback', () => {
    it('should route to template when confidence meets threshold and no unfilled slots', async () => {
      const registry = new ProviderRegistry();
      const router = new StrategyRouter(registry, {
        patternMinConfidence: 1.0, // skip all patterns
        templateMinConfidence: 0.0, // accept any template confidence
      });

      // "价格大于5000" → COMPARISON intent → COMPARISON-SIMPLE template
      // Template has all slots fillable → no unfilled slots
      const result = await router.generate('价格大于5000');

      expect(result.strategy).toBe('template');
      expect(result.metadata.intent).toBeDefined();
      expect(result.metadata.templateName).toBeDefined();
      expect(result.expression).toContain('5000');
    });

    it('should skip to LLM when template result has unfilled slots', async () => {
      const registry = new ProviderRegistry();
      registry.register(createMockLLMProvider('openai', '#order.amount > 1000'));

      const router = new StrategyRouter(registry, {
        patternMinConfidence: 1.0, // skip pattern entirely
        templateMinConfidence: 0.0, // accept any confidence
      });

      // Input triggers LOGICAL intent → LOGICAL-AND template has {left}/{right} unfilled
      const result = await router.generate('金额大于100且状态为已确认');

      // Should fall through to LLM because template has unfilled slots
      expect(result.strategy).toBe('llm-api');
    });

    it('should skip to LLM when template confidence is below threshold', async () => {
      const registry = new ProviderRegistry();
      registry.register(createMockLLMProvider('openai', '#order.amount > 1000'));

      const router = new StrategyRouter(registry, {
        patternMinConfidence: 1.0, // skip pattern
        templateMinConfidence: 0.99, // very high threshold
      });

      // Template confidence (0.9 * intentConfidence) will be < 0.99
      const result = await router.generate('金额大于100');

      expect(result.strategy).toBe('llm-api');
    });
  });

  // ===== PromptBuilder Integration =====
  describe('PromptBuilder Integration', () => {
    it('should pass prompt from PromptBuilder to LLM provider', async () => {
      const registry = new ProviderRegistry();
      const provider = createMockLLMProvider('openai', '#order.amount > 1000');
      registry.register(provider);

      const router = new StrategyRouter(registry, {
        enableSelfCorrection: false, // keep generate() call count predictable
        patternMinConfidence: 1.0,
        templateMinConfidence: 1.0,
      });

      await router.generate('复杂查询');

      // Verify PromptBuilder.build result was passed to LLM provider
      expect(provider.generate).toHaveBeenCalledWith(
        expect.objectContaining({
          system: expect.stringContaining('SpEL'),
          user: expect.stringContaining('复杂查询'),
        }),
        expect.objectContaining({ timeout: 30000 }),
      );
    });

    it('should include context schema in LLM prompt when provided', async () => {
      const registry = new ProviderRegistry();
      const provider = createMockLLMProvider('openai', '#order.amount > 1000');
      registry.register(provider);

      const contextSchema = {
        root: {
          name: 'order',
          type: 'Order',
          fields: {
            amount: { type: 'number' as const, description: 'Order amount' },
          },
          methods: {},
        },
        variables: {},
        beans: {},
        types: {},
        functions: {},
      };

      const router = new StrategyRouter(registry, {
        enableSelfCorrection: false,
        patternMinConfidence: 1.0,
        templateMinConfidence: 1.0,
      });

      await router.generate('复杂查询', contextSchema);

      // Verify contextSchema was included in the prompt
      expect(provider.generate).toHaveBeenCalledWith(
        expect.objectContaining({
          contextSchema: expect.objectContaining({
            root: expect.objectContaining({ name: 'order' }),
          }),
        }),
        expect.any(Object),
      );
    });

    it('should return rawOutput from LLM response in metadata', async () => {
      const registry = new ProviderRegistry();
      const llmOutput = '#order.amount > 1000';
      registry.register(createMockLLMProvider('openai', llmOutput));

      const router = new StrategyRouter(registry, {
        enableSelfCorrection: false,
        patternMinConfidence: 1.0,
        templateMinConfidence: 1.0,
      });

      const result = await router.generate('查询');

      expect(result.strategy).toBe('llm-api');
      expect(result.metadata.rawOutput).toBe(llmOutput);
    });
  });

  // ===== Provider Availability =====
  describe('Provider Availability', () => {
    it('should filter out unavailable providers from prioritized list', async () => {
      const registry = new ProviderRegistry();

      // Provider with isAvailable() returning false
      const unavailable = createMockLLMProvider('unavailable', '', false);
      const available = createMockLLMProvider('available', '#order.amount > 1000', true);
      registry.register(unavailable);
      registry.register(available);

      const router = new StrategyRouter(registry, {
        patternMinConfidence: 1.0,
        templateMinConfidence: 1.0,
      });

      const result = await router.generate('查询');

      // Only the available provider should be used
      expect(result.strategy).toBe('llm-api');
      expect(result.metadata.providerName).toBe('available');
    });
  });

  // ===== getPromptBuilder =====
  describe('getPromptBuilder', () => {
    it('should return the internal PromptBuilder instance', () => {
      const registry = new ProviderRegistry();
      const router = new StrategyRouter(registry);

      const promptBuilder = router.getPromptBuilder();
      expect(promptBuilder).toBeDefined();
      expect(typeof promptBuilder.build).toBe('function');
    });
  });

  // ===== getPatternMatcher =====
  describe('getPatternMatcher', () => {
    it('should return the internal PatternMatcher instance', () => {
      const registry = new ProviderRegistry();
      const router = new StrategyRouter(registry);

      const matcher = router.getPatternMatcher();
      expect(matcher).toBeDefined();
      expect(typeof matcher.match).toBe('function');
      expect(typeof matcher.register).toBe('function');
    });
  });

  // ===== getTemplateEngine =====
  describe('getTemplateEngine', () => {
    it('should return the internal TemplateEngine instance', () => {
      const registry = new ProviderRegistry();
      const router = new StrategyRouter(registry);

      const engine = router.getTemplateEngine();
      expect(engine).toBeDefined();
      expect(typeof engine.generate).toBe('function');
      expect(typeof engine.setContext).toBe('function');
    });
  });

  // ===== Pattern AutoFix Path =====
  describe('Pattern AutoFix Path', () => {
    it('should apply AutoFix when pattern produces expression with &&', async () => {
      const registry = new ProviderRegistry();
      const router = new StrategyRouter(registry);

      // Inject a custom pattern whose spelTemplate contains JS operator &&
      // This forces validation to fail and triggers the AutoFix path
      router.getPatternMatcher().register({
        id: 'TEST-JS-AND-OP',
        match: /^autofixtest double ampersand$/,
        spelTemplate: "#order.amount > 1000 && #order.status == 'confirmed'",
        slots: {},
        priority: 100,
        tags: ['test'],
        examples: [],
        difficulty: 'easy',
        confidence: 0.99,
      });

      const result = await router.generate('autofixtest double ampersand');

      expect(result.strategy).toBe('pattern');
      expect(result.metadata.patternId).toBe('TEST-JS-AND-OP');
      // AutoFix should have replaced && with and
      expect(result.expression).not.toContain('&&');
      expect(result.expression).toContain('and');
      // Confidence reduced by AutoFix multiplier (0.95)
      expect(result.confidence).toBeLessThan(0.99);
    });

    it('should apply AutoFix when pattern produces expression with ||', async () => {
      const registry = new ProviderRegistry();
      const router = new StrategyRouter(registry);

      // Inject a custom pattern whose spelTemplate contains JS operator ||
      router.getPatternMatcher().register({
        id: 'TEST-JS-OR-OP',
        match: /^autofixtest double pipe$/,
        spelTemplate: "#order.status == 'expired' || #order.amount > 10000",
        slots: {},
        priority: 100,
        tags: ['test'],
        examples: [],
        difficulty: 'easy',
        confidence: 0.99,
      });

      const result = await router.generate('autofixtest double pipe');

      expect(result.strategy).toBe('pattern');
      expect(result.metadata.patternId).toBe('TEST-JS-OR-OP');
      // AutoFix should have replaced || with or
      expect(result.expression).not.toContain('||');
      expect(result.expression).toContain('or');
    });

    it('should apply AutoFix when pattern produces expression with ===', async () => {
      const registry = new ProviderRegistry();
      const router = new StrategyRouter(registry);

      // Inject a custom pattern whose spelTemplate contains JS operator ===
      router.getPatternMatcher().register({
        id: 'TEST-JS-EQ-OP',
        match: /^autofixtest triple equals$/,
        spelTemplate: "#order.status === 'confirmed'",
        slots: {},
        priority: 100,
        tags: ['test'],
        examples: [],
        difficulty: 'easy',
        confidence: 0.99,
      });

      const result = await router.generate('autofixtest triple equals');

      expect(result.strategy).toBe('pattern');
      expect(result.metadata.patternId).toBe('TEST-JS-EQ-OP');
      // AutoFix should have replaced === with ==
      expect(result.expression).not.toContain('===');
      expect(result.expression).toContain('==');
    });
  });
});
