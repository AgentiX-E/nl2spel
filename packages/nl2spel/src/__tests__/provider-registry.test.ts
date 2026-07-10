import { describe, it, expect, vi } from 'vitest';
import { ProviderRegistry } from '../provider/provider-registry.js';
import type { LLMProvider, LLMCapabilities } from '../provider/llm-provider.js';

function createMockProvider(
  name: string,
  overrides: Partial<{
    offlineAvailable: boolean;
    estimatedCostPerRequest: number;
    estimatedLatencyMs: number;
    isAvailable: boolean;
  }> = {},
): LLMProvider {
  const capabilities: LLMCapabilities = {
    maxContextTokens: 128000,
    supportsGrammarConstraint: false,
    supportsStreaming: true,
    supportsStructuredOutput: true,
    offlineAvailable: overrides.offlineAvailable ?? false,
    estimatedCostPerRequest: overrides.estimatedCostPerRequest ?? 0.0001,
    estimatedLatencyMs: overrides.estimatedLatencyMs ?? 2000,
  };

  return {
    name,
    capabilities,
    generate: vi.fn().mockResolvedValue({
      text: '#order.amount > 1000',
      model: 'test',
      usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
      latencyMs: 100,
      finishReason: 'stop' as const,
      providerName: name,
    }),
    isAvailable: vi.fn().mockResolvedValue(overrides.isAvailable ?? true),
  };
}

describe('ProviderRegistry', () => {
  // ===== Registration =====
  describe('registration', () => {
    it('should register a new provider', () => {
      const registry = new ProviderRegistry();
      const provider = createMockProvider('openai');
      expect(() => registry.register(provider)).not.toThrow();
      expect(registry.list()).toHaveLength(1);
      expect(registry.count).toBe(1);
    });

    it('should throw when registering a duplicate provider', () => {
      const registry = new ProviderRegistry();
      const provider = createMockProvider('openai');
      registry.register(provider);
      expect(() => registry.register(provider)).toThrow("Provider 'openai' already registered");
    });

    it('should throw when registering two providers with the same name', () => {
      const registry = new ProviderRegistry();
      registry.register(createMockProvider('openai'));
      expect(() => registry.register(createMockProvider('openai'))).toThrow(
        "Provider 'openai' already registered",
      );
    });

    it('should register multiple providers with different names', () => {
      const registry = new ProviderRegistry();
      registry.register(createMockProvider('openai'));
      registry.register(createMockProvider('deepseek'));
      registry.register(createMockProvider('glm'));
      expect(registry.list()).toHaveLength(3);
      expect(registry.count).toBe(3);
    });
  });

  // ===== Unregistration =====
  describe('unregistration', () => {
    it('should unregister a provider by name', () => {
      const registry = new ProviderRegistry();
      registry.register(createMockProvider('openai'));
      registry.register(createMockProvider('deepseek'));

      registry.unregister('openai');
      expect(registry.list()).toHaveLength(1);
      expect(registry.get('openai')).toBeUndefined();
      expect(registry.get('deepseek')).toBeDefined();
    });

    it('should not throw when unregistering non-existent provider', () => {
      const registry = new ProviderRegistry();
      expect(() => registry.unregister('nonexistent')).not.toThrow();
    });
  });

  // ===== Get by name =====
  describe('get', () => {
    it('should return provider by name', () => {
      const registry = new ProviderRegistry();
      const provider = createMockProvider('openai');
      registry.register(provider);
      expect(registry.get('openai')).toBe(provider);
    });

    it('should return undefined for unknown provider', () => {
      const registry = new ProviderRegistry();
      expect(registry.get('unknown')).toBeUndefined();
    });
  });

  // ===== Prioritized providers =====
  describe('getPrioritized', () => {
    it('should return only available providers', async () => {
      const registry = new ProviderRegistry();
      const availableProvider = createMockProvider('openai', { isAvailable: true });
      const unavailableProvider = createMockProvider('deepseek', { isAvailable: false });

      registry.register(availableProvider);
      registry.register(unavailableProvider);

      const prioritized = await registry.getPrioritized();
      expect(prioritized).toHaveLength(1);
      expect(prioritized[0]!.name).toBe('openai');
    });

    it('should prioritize offline providers first', async () => {
      const registry = new ProviderRegistry();
      const onlineProvider = createMockProvider('openai', { offlineAvailable: false });
      const offlineProvider = createMockProvider('webllm', { offlineAvailable: true });

      registry.register(onlineProvider);
      registry.register(offlineProvider);

      const prioritized = await registry.getPrioritized();
      expect(prioritized[0]!.name).toBe('webllm');
      expect(prioritized[1]!.name).toBe('openai');
    });

    it('should prioritize lower cost providers second', async () => {
      const registry = new ProviderRegistry();
      const expensiveProvider = createMockProvider('openai', {
        estimatedCostPerRequest: 0.001,
        offlineAvailable: false,
      });
      const cheapProvider = createMockProvider('deepseek', {
        estimatedCostPerRequest: 0.0001,
        offlineAvailable: false,
      });

      registry.register(expensiveProvider);
      registry.register(cheapProvider);

      const prioritized = await registry.getPrioritized();
      expect(prioritized[0]!.name).toBe('deepseek');
      expect(prioritized[1]!.name).toBe('openai');
    });

    it('should prioritize lower latency when cost is equal', async () => {
      const registry = new ProviderRegistry();
      const slowProvider = createMockProvider('openai', {
        estimatedCostPerRequest: 0.0001,
        estimatedLatencyMs: 3000,
        offlineAvailable: false,
      });
      const fastProvider = createMockProvider('glm', {
        estimatedCostPerRequest: 0.0001,
        estimatedLatencyMs: 1000,
        offlineAvailable: false,
      });

      registry.register(slowProvider);
      registry.register(fastProvider);

      const prioritized = await registry.getPrioritized();
      expect(prioritized[0]!.name).toBe('glm');
      expect(prioritized[1]!.name).toBe('openai');
    });

    it('should return empty array when no providers are available', async () => {
      const registry = new ProviderRegistry();
      registry.register(createMockProvider('openai', { isAvailable: false }));
      registry.register(createMockProvider('deepseek', { isAvailable: false }));

      const prioritized = await registry.getPrioritized();
      expect(prioritized).toHaveLength(0);
    });

    it('should return empty array when no providers registered', async () => {
      const registry = new ProviderRegistry();
      const prioritized = await registry.getPrioritized();
      expect(prioritized).toHaveLength(0);
    });
  });

  // ===== list =====
  describe('list', () => {
    it('should return all registered providers including unavailable', () => {
      const registry = new ProviderRegistry();
      registry.register(createMockProvider('openai', { isAvailable: false }));
      registry.register(createMockProvider('deepseek', { isAvailable: true }));

      const all = registry.list();
      expect(all).toHaveLength(2);
    });

    it('should return empty array when no providers', () => {
      const registry = new ProviderRegistry();
      expect(registry.list()).toEqual([]);
    });

    it('should return a copy, not the internal array', () => {
      const registry = new ProviderRegistry();
      registry.register(createMockProvider('openai'));
      const list = registry.list();
      list.push(createMockProvider('extra'));
      expect(registry.count).toBe(1);
    });
  });

  // ===== count =====
  describe('count', () => {
    it('should return 0 initially', () => {
      const registry = new ProviderRegistry();
      expect(registry.count).toBe(0);
    });

    it('should increment after registration', () => {
      const registry = new ProviderRegistry();
      registry.register(createMockProvider('openai'));
      expect(registry.count).toBe(1);
    });

    it('should decrement after unregistration', () => {
      const registry = new ProviderRegistry();
      registry.register(createMockProvider('openai'));
      registry.register(createMockProvider('deepseek'));
      registry.unregister('openai');
      expect(registry.count).toBe(1);
    });
  });
});
