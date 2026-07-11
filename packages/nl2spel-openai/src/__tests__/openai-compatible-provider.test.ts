import { describe, it, expect, vi, afterEach } from 'vitest';
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
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function createMockPromptBuilder() {
    return {
      build: vi.fn().mockReturnValue({
        system: 'You are a SpEL expert.',
        user: '金额大于1000',
        contextSchema: { root: null, variables: {}, beans: {}, types: {}, functions: {} },
        examples: [],
      }),
    } as any;
  }

  // === CONSTRUCTOR tests ===
  describe('constructor', () => {
    it('should create provider with known preset', () => {
      const provider = new OpenAICompatibleProvider(
        { provider: 'openai', apiKey: 'sk-test' },
        createMockPromptBuilder(),
      );
      expect(provider.name).toBe('openai');
      expect(provider.capabilities.offlineAvailable).toBe(false);
    });

    it('should create provider with deepseek preset', () => {
      const provider = new OpenAICompatibleProvider(
        { provider: 'deepseek', apiKey: 'sk-test' },
        createMockPromptBuilder(),
      );
      expect(provider.name).toBe('deepseek');
      expect(provider.capabilities.estimatedCostPerRequest).toBe(0.0001);
    });

    it('should create provider with glm preset', () => {
      const provider = new OpenAICompatibleProvider(
        { provider: 'glm', apiKey: 'sk-test' },
        createMockPromptBuilder(),
      );
      expect(provider.name).toBe('glm');
    });

    it('should create provider with copilot preset', () => {
      const provider = new OpenAICompatibleProvider(
        { provider: 'copilot', apiKey: 'ghp_test' },
        createMockPromptBuilder(),
      );
      expect(provider.name).toBe('copilot');
      expect(provider.capabilities.estimatedCostPerRequest).toBe(0);
    });

    it('should create provider with hunyuan preset', () => {
      const provider = new OpenAICompatibleProvider(
        { provider: 'hunyuan', apiKey: 'sk-test' },
        createMockPromptBuilder(),
      );
      expect(provider.name).toBe('hunyuan');
    });

    it('should create provider with minimax preset', () => {
      const provider = new OpenAICompatibleProvider(
        { provider: 'minimax', apiKey: 'sk-test' },
        createMockPromptBuilder(),
      );
      expect(provider.name).toBe('minimax');
    });

    it('should create provider with kimi preset', () => {
      const provider = new OpenAICompatibleProvider(
        { provider: 'kimi', apiKey: 'sk-test' },
        createMockPromptBuilder(),
      );
      expect(provider.name).toBe('kimi');
    });

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
        createMockPromptBuilder(),
      );
      expect(provider.name).toBe('my-llm');
    });

    it('should throw without provider or custom config', () => {
      expect(() => new OpenAICompatibleProvider({} as any, createMockPromptBuilder())).toThrow(
        'requires either a known "provider" name',
      );
    });

    it('should override model from preset', () => {
      const provider = new OpenAICompatibleProvider(
        { provider: 'openai', apiKey: 'sk-test', model: 'gpt-4' },
        createMockPromptBuilder(),
      );
      expect(provider.capabilities.maxContextTokens).toBe(128000);
    });
  });

  // === isAvailable tests ===
  describe('isAvailable', () => {
    it('should be available with apiKey', async () => {
      const provider = new OpenAICompatibleProvider(
        { provider: 'openai', apiKey: 'sk-test' },
        createMockPromptBuilder(),
      );
      expect(await provider.isAvailable()).toBe(true);
    });

    it('should not be available without apiKey', async () => {
      const provider = new OpenAICompatibleProvider(
        { provider: 'openai' },
        createMockPromptBuilder(),
      );
      expect(await provider.isAvailable()).toBe(false);
    });
  });

  // === capabilities tests ===
  describe('capabilities', () => {
    it('should report correct capabilities for openai', () => {
      const provider = new OpenAICompatibleProvider(
        { provider: 'openai', apiKey: 'sk-test' },
        createMockPromptBuilder(),
      );
      expect(provider.capabilities.supportsStreaming).toBe(true);
      expect(provider.capabilities.supportsStructuredOutput).toBe(true);
      expect(provider.capabilities.offlineAvailable).toBe(false);
    });

    it('should report correct capabilities for deepseek', () => {
      const provider = new OpenAICompatibleProvider(
        { provider: 'deepseek', apiKey: 'sk-test' },
        createMockPromptBuilder(),
      );
      expect(provider.capabilities.supportsStreaming).toBe(true);
      expect(provider.capabilities.supportsStructuredOutput).toBe(false);
    });

    it('should report maxContextTokens from custom config', () => {
      const provider = new OpenAICompatibleProvider(
        {
          custom: {
            name: 'custom',
            baseURL: 'https://example.com/v1',
            apiKey: 'sk-test',
            model: 'm1',
          },
          maxContextTokens: 64000,
        },
        createMockPromptBuilder(),
      );
      expect(provider.capabilities.maxContextTokens).toBe(64000);
    });
  });

  // === generate() mocked tests ===
  describe('generate (mocked fetch)', () => {
    it('should call fetch with correct URL and body', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            choices: [{ message: { content: '#order.amount > 1000' }, finish_reason: 'stop' }],
            model: 'deepseek-chat',
            usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 },
          }),
      });
      vi.stubGlobal('fetch', mockFetch);

      const provider = new OpenAICompatibleProvider(
        { provider: 'deepseek', apiKey: 'sk-test' },
        createMockPromptBuilder(),
      );

      const prompt = mockPromptBuilder.build('测试');
      const response = await provider.generate(prompt, { timeout: 5000 });

      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.deepseek.com/v1/chat/completions',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            Authorization: 'Bearer sk-test',
          }),
        }),
      );

      expect(response.text).toBe('#order.amount > 1000');
      expect(response.providerName).toBe('deepseek');
      expect(response.usage.totalTokens).toBe(150);
    });

    it('should retry up to maxRetries on failure', async () => {
      const mockFetch = vi
        .fn()
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              choices: [{ message: { content: '#order.amount > 1000' }, finish_reason: 'stop' }],
              model: 'deepseek-chat',
              usage: { prompt_tokens: 50, completion_tokens: 30, total_tokens: 80 },
            }),
        });
      vi.stubGlobal('fetch', mockFetch);

      const provider = new OpenAICompatibleProvider(
        { provider: 'deepseek', apiKey: 'sk-test' },
        createMockPromptBuilder(),
      );

      const prompt = mockPromptBuilder.build('测试');
      const response = await provider.generate(prompt, { timeout: 5000, maxRetries: 1 });

      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(response.text).toBe('#order.amount > 1000');
    });

    it('should throw after all retries exhausted', async () => {
      const mockFetch = vi.fn().mockRejectedValue(new Error('Network error'));
      vi.stubGlobal('fetch', mockFetch);

      const provider = new OpenAICompatibleProvider(
        { provider: 'deepseek', apiKey: 'sk-test' },
        createMockPromptBuilder(),
      );

      const prompt = mockPromptBuilder.build('测试');
      await expect(provider.generate(prompt, { timeout: 5000, maxRetries: 0 })).rejects.toThrow(
        'Network error',
      );
    });

    it('should throw on HTTP error response', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        json: () => Promise.resolve({ error: { message: 'Invalid API key' } }),
      });
      vi.stubGlobal('fetch', mockFetch);

      const provider = new OpenAICompatibleProvider(
        { provider: 'deepseek', apiKey: 'sk-test' },
        createMockPromptBuilder(),
      );

      const prompt = mockPromptBuilder.build('测试');
      await expect(provider.generate(prompt, { timeout: 5000, maxRetries: 0 })).rejects.toThrow(
        /API error.*401/,
      );
    });

    it('should pass custom model from options', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            choices: [{ message: { content: '#x > 0' }, finish_reason: 'stop' }],
            model: 'custom-model',
            usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
          }),
      });
      vi.stubGlobal('fetch', mockFetch);

      const provider = new OpenAICompatibleProvider(
        { provider: 'deepseek', apiKey: 'sk-test' },
        createMockPromptBuilder(),
      );

      const prompt = mockPromptBuilder.build('测试');
      await provider.generate(prompt, { timeout: 5000, model: 'custom-model' });

      const body = JSON.parse(mockFetch.mock.calls[0]![1]!.body as string);
      expect(body.model).toBe('custom-model');
    });

    it('should include stop sequences and temperature from options', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            choices: [{ message: { content: '#x > 0' }, finish_reason: 'stop' }],
            model: 'deepseek-chat',
            usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
          }),
      });
      vi.stubGlobal('fetch', mockFetch);

      const provider = new OpenAICompatibleProvider(
        { provider: 'deepseek', apiKey: 'sk-test' },
        createMockPromptBuilder(),
      );

      const prompt = mockPromptBuilder.build('测试');
      await provider.generate(prompt, {
        timeout: 5000,
        temperature: 0.5,
        topP: 0.8,
        stopSequences: ['END'],
      });

      const body = JSON.parse(mockFetch.mock.calls[0]![1]!.body as string);
      expect(body.temperature).toBe(0.5);
      expect(body.top_p).toBe(0.8);
      expect(body.stop).toEqual(['END']);
    });

    it('should handle response without usage data', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            choices: [{ message: { content: '#x > 0' }, finish_reason: 'stop' }],
            model: 'unknown',
          }),
      });
      vi.stubGlobal('fetch', mockFetch);

      const provider = new OpenAICompatibleProvider(
        { provider: 'deepseek', apiKey: 'sk-test' },
        createMockPromptBuilder(),
      );

      const prompt = mockPromptBuilder.build('测试');
      const response = await provider.generate(prompt, { timeout: 5000, maxRetries: 0 });

      expect(response.usage.promptTokens).toBe(0);
      expect(response.usage.totalTokens).toBe(0);
      expect(response.model).toBe('unknown');
    });
  });

  // === generateStream() mocked tests ===
  describe('generateStream (mocked)', () => {
    it('should yield stream chunks', async () => {
      const mockReader = {
        read: vi
          .fn()
          .mockResolvedValueOnce({
            done: false,
            value: new TextEncoder().encode('data: {"choices":[{"delta":{"content":"#order"}}]}\n'),
          })
          .mockResolvedValueOnce({
            done: false,
            value: new TextEncoder().encode(
              'data: {"choices":[{"delta":{"content":".amount > 1000"}}]}\n',
            ),
          })
          .mockResolvedValueOnce({ done: false, value: new TextEncoder().encode('data: [DONE]\n') })
          .mockResolvedValueOnce({ done: true, value: new Uint8Array() }),
        releaseLock: vi.fn(),
      };

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        body: { getReader: () => mockReader },
      });
      vi.stubGlobal('fetch', mockFetch);

      const provider = new OpenAICompatibleProvider(
        { provider: 'deepseek', apiKey: 'sk-test' },
        createMockPromptBuilder(),
      );

      const prompt = mockPromptBuilder.build('测试');
      const chunks: string[] = [];
      for await (const chunk of provider.generateStream!(prompt, { timeout: 5000 })) {
        chunks.push(chunk.delta);
      }

      const fullText = chunks.join('');
      expect(fullText).toContain('#order');
      expect(fullText).toContain('1000');
    });

    it('should throw on non-ok response', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        text: () => Promise.resolve('Internal Server Error'),
      });
      vi.stubGlobal('fetch', mockFetch);

      const provider = new OpenAICompatibleProvider(
        { provider: 'deepseek', apiKey: 'sk-test' },
        createMockPromptBuilder(),
      );

      const prompt = mockPromptBuilder.build('测试');
      await expect(async () => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        for await (const _ of provider.generateStream!(prompt, { timeout: 5000 })) {
          // trigger stream error
        }
      }).rejects.toThrow(/API error.*500/);
    });

    it('should handle body without reader', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        body: null,
      });
      vi.stubGlobal('fetch', mockFetch);

      const provider = new OpenAICompatibleProvider(
        { provider: 'deepseek', apiKey: 'sk-test' },
        createMockPromptBuilder(),
      );

      const prompt = mockPromptBuilder.build('测试');
      await expect(async () => {
        for await (const _ of provider.generateStream!(prompt, { timeout: 5000 })) {
          // trigger error
        }
      }).rejects.toThrow('No response body');
    });
  });

  // === PromptBuilder getter/setter tests ===
  describe('PromptBuilder accessors', () => {
    it('should return the internal PromptBuilder via getter', () => {
      const provider = new OpenAICompatibleProvider(
        { provider: 'openai', apiKey: 'sk-test' },
        createMockPromptBuilder(),
      );
      const builder = provider.getPromptBuilder();
      expect(builder).toBeDefined();
      expect(typeof builder.build).toBe('function');
    });

    it('should allow setting a new PromptBuilder', () => {
      const provider = new OpenAICompatibleProvider(
        { provider: 'openai', apiKey: 'sk-test' },
        createMockPromptBuilder(),
      );
      const newBuilder = { build: vi.fn() };
      provider.setPromptBuilder(newBuilder as any);
      expect(provider.getPromptBuilder()).toBe(newBuilder);
    });
  });

  // === Custom headers test ===
  describe('custom headers', () => {
    it('should merge custom headers with auth header', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            choices: [{ message: { content: '#x > 0' }, finish_reason: 'stop' }],
            model: 'test',
            usage: { prompt_tokens: 5, completion_tokens: 3, total_tokens: 8 },
          }),
      });
      vi.stubGlobal('fetch', mockFetch);

      const provider = new OpenAICompatibleProvider(
        {
          provider: 'openai',
          apiKey: 'sk-test',
          headers: { 'X-Custom': 'test-value' },
        },
        createMockPromptBuilder(),
      );

      const prompt = mockPromptBuilder.build('测试');
      await provider.generate(prompt, { timeout: 5000, maxRetries: 0 });

      const headers = mockFetch.mock.calls[0]![1]!.headers as Record<string, string>;
      expect(headers['X-Custom']).toBe('test-value');
      expect(headers['Authorization']).toBe('Bearer sk-test');
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
