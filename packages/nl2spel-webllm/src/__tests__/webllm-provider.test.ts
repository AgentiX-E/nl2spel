import { describe, it, expect, vi } from 'vitest';
import { WebLLMProvider } from '../webllm-provider.js';
import type { LLMCapabilities } from '@agentix-e/nl2spel';

describe('WebLLMProvider', () => {
  // ===== WL-P01: Constructor =====
  describe('WL-P01: Constructor', () => {
    it('should create provider with default config', () => {
      const provider = new WebLLMProvider({ model: 'gemma-2-2b-it' });
      expect(provider.name).toBe('webllm');
      expect(provider.capabilities.offlineAvailable).toBe(true);
    });

    it('should have correct capabilities', () => {
      const provider = new WebLLMProvider({ model: 'gemma-2-2b-it' });
      expect(provider.capabilities.supportsGrammarConstraint).toBe(true);
      expect(provider.capabilities.supportsStreaming).toBe(true);
      expect(provider.capabilities.supportsStructuredOutput).toBe(false);
      expect(provider.capabilities.offlineAvailable).toBe(true);
      expect(provider.capabilities.estimatedCostPerRequest).toBe(0);
    });

    it('should have estimated latency', () => {
      const provider = new WebLLMProvider({ model: 'gemma-2-2b-it' });
      expect(provider.capabilities.estimatedLatencyMs).toBeGreaterThan(0);
    });
  });

  // ===== WL-P02: Model selection =====
  describe('WL-P02: Model Selection', () => {
    it('should use gemma-2-2b-it config', () => {
      const provider = new WebLLMProvider({ model: 'gemma-2-2b-it' });
      expect(provider.capabilities.maxContextTokens).toBe(8192);
    });

    it('should use phi-3-mini config', () => {
      const provider = new WebLLMProvider({ model: 'phi-3-mini' });
      expect(provider.capabilities.maxContextTokens).toBe(4096);
    });

    it('should use qwen2.5-1.5b config', () => {
      const provider = new WebLLMProvider({ model: 'qwen2.5-1.5b' });
      expect(provider.capabilities.maxContextTokens).toBe(32768);
    });

    it('should use llama-3.2-3b config', () => {
      const provider = new WebLLMProvider({ model: 'llama-3.2-3b' });
      expect(provider.capabilities.maxContextTokens).toBe(8192);
    });

    it('should fallback to gemma for unknown model', () => {
      const provider = new WebLLMProvider({ model: 'unknown-model' });
      expect(provider.capabilities.maxContextTokens).toBe(8192);
    });
  });

  // ===== WL-P03: Custom config override =====
  describe('WL-P03: Custom Config Override', () => {
    it('should allow custom model config', () => {
      const provider = new WebLLMProvider({
        model: 'gemma-2-2b-it',
        customModelConfig: { maxContextTokens: 4096 },
      });
      expect(provider.capabilities.maxContextTokens).toBe(4096);
    });

    it('should allow disabling grammar', () => {
      const provider = new WebLLMProvider({
        model: 'gemma-2-2b-it',
        enableGrammar: false,
      });
      // Internal config check — just verify construction doesn't throw
      expect(provider.name).toBe('webllm');
    });
  });

  // ===== WL-P04: isAvailable =====
  describe('WL-P04: isAvailable', () => {
    it('should return false in Node.js environment', async () => {
      const provider = new WebLLMProvider({ model: 'gemma-2-2b-it' });
      const available = await provider.isAvailable();
      // In Node.js, WebGPU is not available
      expect(available).toBe(false);
    });

    it('should not throw on isAvailable check', async () => {
      const provider = new WebLLMProvider({ model: 'gemma-2-2b-it' });
      await expect(provider.isAvailable()).resolves.not.toThrow();
    });
  });

  // ===== WL-P05: Dispose =====
  describe('WL-P05: Dispose', () => {
    it('should dispose without error when not initialized', async () => {
      const provider = new WebLLMProvider({ model: 'gemma-2-2b-it' });
      await expect(provider.dispose()).resolves.not.toThrow();
    });

    it('should be safe to call dispose multiple times', async () => {
      const provider = new WebLLMProvider({ model: 'gemma-2-2b-it' });
      await provider.dispose();
      await provider.dispose();
      // Should not throw
    });
  });

  // ===== WL-P06: Generate (without browser) =====
  describe('WL-P06: Generate (requires browser)', () => {
    it('should throw when generate called without initialization', async () => {
      const provider = new WebLLMProvider({ model: 'gemma-2-2b-it' });
      await expect(
        provider.generate({
          system: 'Generate SpEL.',
          user: '金额大于1000',
          contextSchema: {
            root: { name: 'order', type: 'Order', fields: {}, methods: {} },
            variables: {},
            beans: {},
            types: {},
            functions: {},
          },
          examples: [],
        }),
      ).rejects.toThrow();
    });
  });
});
