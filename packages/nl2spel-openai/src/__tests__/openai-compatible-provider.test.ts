import { describe, it, expect, vi } from 'vitest';
import { OpenAICompatibleProvider } from '../openai-compatible-provider.js';
import { PROVIDER_PRESETS } from '../provider-presets.js';

// Mock PromptBuilder for testing
const mockPromptBuilder = {
  build: vi.fn().mockReturnValue({
    system: 'You are a SpEL expert.',
    user: '金额大于1000',
    contextSchema: { root: null, variables: {}, beans: {}, types: {}, functions: {} },
    examples: [],
  }),
};

describe('OpenAICompatibleProvider', () => {
  describe('constructor', () => {
    it('should create provider with known preset', () => {
      const provider = new OpenAICompatibleProvider(
        { provider: 'openai', apiKey: 'sk-test' },
        mockPromptBuilder as any,
      );
      expect(provider.name).toBe('openai');
      expect(provider.capabilities.offlineAvailable).toBe(false);
    });

    it('should create provider with deepseek preset', () => {
      const provider = new OpenAICompatibleProvider(
        { provider: 'deepseek', apiKey: 'sk-test' },
        mockPromptBuilder as any,
      );
      expect(provider.name).toBe('deepseek');
      expect(provider.capabilities.estimatedCostPerRequest).toBe(0.0001);
    });

    it('should create provider with glm preset', () => {
      const provider = new OpenAICompatibleProvider(
        { provider: 'glm', apiKey: 'sk-test' },
        mockPromptBuilder as any,
      );
      expect(provider.name).toBe('glm');
    });

    it('should create provider with copilot preset', () => {
      const provider = new OpenAICompatibleProvider(
        { provider: 'copilot', apiKey: 'ghp_test' },
        mockPromptBuilder as any,
      );
      expect(provider.name).toBe('copilot');
      expect(provider.capabilities.estimatedCostPerRequest).toBe(0);
    });

    it('should create provider with hunyuan preset', () => {
      const provider = new OpenAICompatibleProvider(
        { provider: 'hunyuan', apiKey: 'sk-test' },
        mockPromptBuilder as any,
      );
      expect(provider.name).toBe('hunyuan');
    });

    it('should create provider with minimax preset', () => {
      const provider = new OpenAICompatibleProvider(
        { provider: 'minimax', apiKey: 'sk-test' },
        mockPromptBuilder as any,
      );
      expect(provider.name).toBe('minimax');
    });

    it('should create provider with kimi preset', () => {
      const provider = new OpenAICompatibleProvider(
        { provider: 'kimi', apiKey: 'sk-test' },
        mockPromptBuilder as any,
      );
      expect(provider.name).toBe('kimi');
    });
  });

  describe('custom config', () => {
    it('should create provider with custom config', () => {
      const provider = new OpenAICompatibleProvider(
        {
          custom: {
            name: 'my-llm',
            baseURL: 'https://my-llm.example.com/v1',
            apiKey: 'sk-custom',
            model: 'my-model-v1',
          },
        },
        mockPromptBuilder as any,
      );
      expect(provider.name).toBe('my-llm');
    });

    it('should throw without provider or custom config', () => {
      expect(() => new OpenAICompatibleProvider({} as any, mockPromptBuilder as any)).toThrow(
        'requires either a known "provider" name',
      );
    });

    it('should override model from preset', () => {
      const provider = new OpenAICompatibleProvider(
        { provider: 'openai', apiKey: 'sk-test', model: 'gpt-4' },
        mockPromptBuilder as any,
      );
      expect(provider.capabilities.maxContextTokens).toBe(128000);
    });
  });

  describe('isAvailable', () => {
    it('should be available with apiKey', async () => {
      const provider = new OpenAICompatibleProvider(
        { provider: 'openai', apiKey: 'sk-test' },
        mockPromptBuilder as any,
      );
      expect(await provider.isAvailable()).toBe(true);
    });

    it('should not be available without apiKey', async () => {
      const provider = new OpenAICompatibleProvider(
        { provider: 'openai' },
        mockPromptBuilder as any,
      );
      expect(await provider.isAvailable()).toBe(false);
    });
  });

  describe('capabilities', () => {
    it('should report correct capabilities for openai', () => {
      const provider = new OpenAICompatibleProvider(
        { provider: 'openai', apiKey: 'sk-test' },
        mockPromptBuilder as any,
      );
      expect(provider.capabilities.supportsStreaming).toBe(true);
      expect(provider.capabilities.supportsStructuredOutput).toBe(true);
      expect(provider.capabilities.offlineAvailable).toBe(false);
    });

    it('should report correct capabilities for deepseek', () => {
      const provider = new OpenAICompatibleProvider(
        { provider: 'deepseek', apiKey: 'sk-test' },
        mockPromptBuilder as any,
      );
      expect(provider.capabilities.supportsStreaming).toBe(true);
      expect(provider.capabilities.supportsStructuredOutput).toBe(false);
    });
  });
});

describe('PROVIDER_PRESETS', () => {
  it('should have 7 presets', () => {
    const keys = Object.keys(PROVIDER_PRESETS);
    expect(keys.length).toBe(7);
  });

  it('all presets should have valid baseURL', () => {
    for (const preset of Object.values(PROVIDER_PRESETS)) {
      expect(preset.baseURL).toBeTruthy();
      expect(preset.baseURL).toMatch(/^https?:\/\//);
    }
  });

  it('all presets should have valid model names', () => {
    for (const preset of Object.values(PROVIDER_PRESETS)) {
      expect(preset.defaultModel).toBeTruthy();
      expect(typeof preset.defaultModel).toBe('string');
    }
  });

  it('all presets should have positive maxContextTokens', () => {
    for (const preset of Object.values(PROVIDER_PRESETS)) {
      expect(preset.maxContextTokens).toBeGreaterThan(0);
    }
  });

  it('all presets should have valid cost estimates', () => {
    for (const preset of Object.values(PROVIDER_PRESETS)) {
      expect(preset.estimatedCostPerRequest).toBeGreaterThanOrEqual(0);
    }
  });
});
