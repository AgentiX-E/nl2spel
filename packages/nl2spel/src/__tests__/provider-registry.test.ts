import { describe, it, expect, vi } from 'vitest';
import { ProviderRegistry } from '../provider/provider-registry.js';
import type { LLMProvider, LLMCapabilities } from '../provider/llm-provider.js';

function createMockProvider(
  name: string,
  overrides: Partial<{
    offlineAvailable: boolean;
    isAvailable: boolean;
  }> = {},
): LLMProvider {
  const capabilities: LLMCapabilities = {
    maxContextTokens: 128000,
    supportsGrammarConstraint: false,
    supportsStreaming: true,
    supportsStructuredOutput: true,
    offlineAvailable: overrides.offlineAvailable ?? false,
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

    it('should accept a priority option', () => {
      const registry = new ProviderRegistry();
      registry.register(createMockProvider('test'), { priority: 5 });
      // Verify no throw + count is correct
      expect(registry.count).toBe(1);
    });

    it('should unregister a provider', () => {
      const registry = new ProviderRegistry();
      registry.register(createMockProvider('openai'));
      expect(registry.count).toBe(1);
      registry.unregister('openai');
      expect(registry.count).toBe(0);
    });

    it('should not throw when unregistering a non-existent provider', () => {
      const registry = new ProviderRegistry();
      expect(() => registry.unregister('unknown')).not.toThrow();
    });
  });

  // ===== Lookup =====
  describe('lookup', () => {
    it('should return registered provider by name', () => {
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

      registry.register(onlineProvider, { priority: 0 }); // low priority number = preferred
      registry.register(offlineProvider, { priority: 100 });

      const prioritized = await registry.getPrioritized();
      // Offline always wins regardless of priority
      expect(prioritized[0]!.name).toBe('webllm');
      expect(prioritized[1]!.name).toBe('openai');
    });

    it('should sort by user priority when same offline status', async () => {
      const registry = new ProviderRegistry();
      registry.register(createMockProvider('high-priority'), { priority: 100 });
      registry.register(createMockProvider('low-priority'), { priority: 0 });

      const prioritized = await registry.getPrioritized();
      expect(prioritized[0]!.name).toBe('low-priority');
      expect(prioritized[1]!.name).toBe('high-priority');
    });

    it('should fall back to registration order when priorities equal', async () => {
      const registry = new ProviderRegistry();
      registry.register(createMockProvider('first'));
      registry.register(createMockProvider('second'));

      const prioritized = await registry.getPrioritized();
      expect(prioritized[0]!.name).toBe('first');
      expect(prioritized[1]!.name).toBe('second');
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

    // Both offline → sort by priority then registration order
    it('should sort two offline providers by priority', async () => {
      const registry = new ProviderRegistry();
      registry.register(createMockProvider('second-offline', { offlineAvailable: true }), {
        priority: 10,
      });
      registry.register(createMockProvider('first-offline', { offlineAvailable: true }), {
        priority: 0,
      });

      const prioritized = await registry.getPrioritized();
      expect(prioritized[0]!.name).toBe('first-offline');
      expect(prioritized[1]!.name).toBe('second-offline');
    });

    // Three providers: mixed offline/online with priorities
    it('should sort three providers correctly', async () => {
      const registry = new ProviderRegistry();
      // Online, low priority = most preferred online
      registry.register(createMockProvider('preferred-online'), { priority: 0 });
      // Online, high priority = less preferred
      registry.register(createMockProvider('fallback-online'), { priority: 50 });
      // Offline, any priority = always first
      registry.register(createMockProvider('offline', { offlineAvailable: true }), {
        priority: 999,
      });

      const prioritized = await registry.getPrioritized();
      expect(prioritized).toHaveLength(3);
      expect(prioritized[0]!.name).toBe('offline');
      expect(prioritized[1]!.name).toBe('preferred-online');
      expect(prioritized[2]!.name).toBe('fallback-online');
    });
  });

  // ===== Reorder =====
  describe('reorder', () => {
    it('should explicitly reorder providers', async () => {
      const registry = new ProviderRegistry();
      registry.register(createMockProvider('a'));
      registry.register(createMockProvider('b'));
      registry.register(createMockProvider('c'));

      registry.reorder(['c', 'a']);

      const prioritized = await registry.getPrioritized();
      expect(prioritized[0]!.name).toBe('c');
      expect(prioritized[1]!.name).toBe('a');
      expect(prioritized[2]!.name).toBe('b');
    });

    it('should no-op for empty reorder list', async () => {
      const registry = new ProviderRegistry();
      registry.register(createMockProvider('a'));
      registry.register(createMockProvider('b'));

      registry.reorder([]);

      const prioritized = await registry.getPrioritized();
      expect(prioritized[0]!.name).toBe('a');
      expect(prioritized[1]!.name).toBe('b');
    });
  });
});
