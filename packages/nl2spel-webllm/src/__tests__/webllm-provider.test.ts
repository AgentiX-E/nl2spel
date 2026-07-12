import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { WebLLMProvider } from '../webllm-provider.js';

// Mock @mlc-ai/web-llm module
const mockCreateCompletions = vi.fn();
const mockEngineInstance = {
  chat: { completions: { create: mockCreateCompletions } },
};
const mockCreateMLCEngine = vi.fn().mockResolvedValue(mockEngineInstance);

vi.mock('@mlc-ai/web-llm', () => ({
  CreateMLCEngine: mockCreateMLCEngine,
}));

const BASE_PROMPT = {
  system: 'Generate SpEL.',
  user: '金额大于1000',
  contextSchema: {
    root: { name: 'order', type: 'Order', fields: {}, methods: {} },
    variables: {},
    beans: {},
    types: {},
    functions: {},
  },
  examples: [] as Array<{
    nl: string;
    spel: string;
    difficulty: 'easy' | 'medium' | 'hard';
    category: string;
  }>,
};

describe('WebLLMProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateMLCEngine.mockResolvedValue(mockEngineInstance);
    mockCreateCompletions.mockResolvedValue({
      choices: [{ message: { content: '#order.amount > 1000' }, finish_reason: 'stop' }],
      usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 },
    });
  });

  // ===== Constructor Tests =====
  describe('Constructor', () => {
    it('should create provider with default config', () => {
      const provider = new WebLLMProvider({ model: 'gemma-2-2b-it' });
      expect(provider.name).toBe('webllm');
      expect(provider.capabilities.offlineAvailable).toBe(true);
      expect(provider.capabilities.supportsGrammarConstraint).toBe(true);
      expect(provider.capabilities.supportsStreaming).toBe(true);
      expect(provider.capabilities.supportsStructuredOutput).toBe(false);
      expect(provider.capabilities.estimatedCostPerRequest).toBe(0);
    });

    it('should set correct maxContextTokens per model', () => {
      expect(new WebLLMProvider({ model: 'gemma-2-2b-it' }).capabilities.maxContextTokens).toBe(
        8192,
      );
      expect(new WebLLMProvider({ model: 'phi-3-mini' }).capabilities.maxContextTokens).toBe(4096);
      expect(new WebLLMProvider({ model: 'qwen2.5-1.5b' }).capabilities.maxContextTokens).toBe(
        32768,
      );
      expect(new WebLLMProvider({ model: 'llama-3.2-3b' }).capabilities.maxContextTokens).toBe(
        8192,
      );
    });

    it('should fallback to gemma for unknown model', () => {
      expect(new WebLLMProvider({ model: 'unknown' }).capabilities.maxContextTokens).toBe(8192);
    });

    it('should allow custom model config override', () => {
      const provider = new WebLLMProvider({
        model: 'gemma-2-2b-it',
        customModelConfig: { maxContextTokens: 4096 },
      });
      expect(provider.capabilities.maxContextTokens).toBe(4096);
    });

    it('should accept disableGrammar and debug options', () => {
      expect(new WebLLMProvider({ model: 'gemma-2-2b-it', enableGrammar: false }).name).toBe(
        'webllm',
      );
      expect(new WebLLMProvider({ model: 'gemma-2-2b-it', debug: true }).name).toBe('webllm');
    });
  });

  // ===== isAvailable Tests =====
  describe('isAvailable', () => {
    it('should always return true (WebLLM determines actual availability)', async () => {
      const provider = new WebLLMProvider({ model: 'gemma-2-2b-it' });
      expect(await provider.isAvailable()).toBe(true);
    });
  });

  // ===== Initialize Tests =====
  describe('initialize', () => {
    it('should initialize via WebLLM CreateMLCEngine', async () => {
      const provider = new WebLLMProvider({ model: 'gemma-2-2b-it', debug: false });
      await provider.initialize();

      expect(mockCreateMLCEngine).toHaveBeenCalledWith(
        'gemma-2-2b-it-q4f16_1-MLC',
        expect.objectContaining({
          logLevel: 'WARN',
          initProgressCallback: expect.any(Function),
        }),
      );
    });

    it('should call onProgress during model loading', async () => {
      let progressCallback: Function | null = null;
      mockCreateMLCEngine.mockImplementationOnce((_modelId: string, opts: any) => {
        progressCallback = opts.initProgressCallback;
        return Promise.resolve(mockEngineInstance);
      });

      const onProgress = vi.fn();
      const provider = new WebLLMProvider({ model: 'gemma-2-2b-it', onProgress });
      await provider.initialize();

      progressCallback!({ progress: 0.5, timeElapsed: 10, text: 'Loading model...' });
      expect(onProgress).toHaveBeenCalledWith({
        progress: 0.5,
        loaded: 0,
        total: 0,
        text: 'Loading model...',
      });
    });

    it('should be idempotent — second call returns immediately', async () => {
      const provider = new WebLLMProvider({ model: 'gemma-2-2b-it' });
      await provider.initialize();
      const count = mockCreateMLCEngine.mock.calls.length;
      await provider.initialize();
      expect(mockCreateMLCEngine.mock.calls.length).toBe(count);
    });

    it('should reuse in-progress initPromise', async () => {
      let resolveInit: (value: any) => void = () => {};
      const initPromise = new Promise<any>(r => {
        resolveInit = r;
      });
      mockCreateMLCEngine.mockReturnValueOnce(initPromise);

      const provider = new WebLLMProvider({ model: 'gemma-2-2b-it' });
      const p1 = provider.initialize();
      const p2 = provider.initialize();

      setTimeout(() => resolveInit(mockEngineInstance), 10);
      await Promise.all([p1, p2]);
      expect(mockCreateMLCEngine).toHaveBeenCalledTimes(1);
    }, 10000);

    it('should catch and re-throw initialization errors', async () => {
      mockCreateMLCEngine.mockRejectedValueOnce(new Error('Model download failed'));
      const provider = new WebLLMProvider({ model: 'gemma-2-2b-it' });
      await expect(provider.initialize()).rejects.toThrow('WebLLM initialization failed');
    });

    it('should use INFO log level when debug=true', async () => {
      const provider = new WebLLMProvider({ model: 'gemma-2-2b-it', debug: true });
      await provider.initialize();
      expect(mockCreateMLCEngine).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ logLevel: 'INFO' }),
      );
    });
  });

  // ===== Generate Tests =====
  describe('generate', () => {
    it('should generate via engine completions API', async () => {
      const provider = new WebLLMProvider({ model: 'gemma-2-2b-it' });
      await provider.initialize();
      const response = await provider.generate(BASE_PROMPT);

      expect(mockCreateCompletions).toHaveBeenCalledTimes(1);
      expect(response.text).toBe('#order.amount > 1000');
      expect(response.providerName).toBe('webllm');
      expect(response.finishReason).toBe('stop');
    });

    it('should pass custom generation options', async () => {
      const provider = new WebLLMProvider({ model: 'gemma-2-2b-it' });
      await provider.initialize();

      await provider.generate(BASE_PROMPT, { temperature: 0.5, maxTokens: 256, topP: 0.95 });
      expect(mockCreateCompletions).toHaveBeenCalledWith(
        expect.objectContaining({ temperature: 0.5, max_tokens: 256, top_p: 0.95 }),
      );
    });

    it('should generate twice without re-initialization', async () => {
      const provider = new WebLLMProvider({ model: 'gemma-2-2b-it' });
      await provider.initialize();
      await provider.generate(BASE_PROMPT);
      const response = await provider.generate(BASE_PROMPT);
      expect(response.text).toBe('#order.amount > 1000');
    });

    it('should throw on engine generation failure', async () => {
      const provider = new WebLLMProvider({ model: 'gemma-2-2b-it' });
      await provider.initialize();
      mockCreateCompletions.mockRejectedValueOnce(new Error('GPU out of memory'));
      await expect(provider.generate(BASE_PROMPT)).rejects.toThrow('WebLLM generation failed');
    });
  });

  // ===== generateStream Tests =====
  describe('generateStream', () => {
    it('should fallback to generate and yield full result', async () => {
      const provider = new WebLLMProvider({ model: 'gemma-2-2b-it' });
      await provider.initialize();

      let done = false;
      const chunks: string[] = [];
      for await (const chunk of provider.generateStream!(BASE_PROMPT)) {
        chunks.push(chunk.delta);
        if (chunk.done) done = true;
      }
      expect(done).toBe(true);
      expect(chunks).toHaveLength(1);
      expect(chunks[0]).toBe('#order.amount > 1000');
    });
  });

  // ===== Dispose Tests =====
  describe('dispose', () => {
    it('should dispose without error when not initialized', async () => {
      await expect(new WebLLMProvider({ model: 'gemma-2-2b-it' }).dispose()).resolves.not.toThrow();
    });

    it('should be safe to call multiple times', async () => {
      const provider = new WebLLMProvider({ model: 'gemma-2-2b-it' });
      await provider.dispose();
      await provider.dispose();
    });

    it('should call engine.unload when engine exists', async () => {
      const mockUnload = vi.fn();
      mockCreateMLCEngine.mockResolvedValueOnce({
        chat: { completions: { create: mockCreateCompletions } },
        unload: mockUnload,
      });
      const provider = new WebLLMProvider({ model: 'gemma-2-2b-it' });
      await provider.initialize();
      await provider.dispose();
      expect(mockUnload).toHaveBeenCalledTimes(1);
    });

    it('should handle unload errors gracefully', async () => {
      mockCreateMLCEngine.mockResolvedValueOnce({
        chat: { completions: { create: mockCreateCompletions } },
        unload: vi.fn().mockImplementation(() => {
          throw new Error('Unload failed');
        }),
      });
      const provider = new WebLLMProvider({ model: 'gemma-2-2b-it' });
      await provider.initialize();
      await expect(provider.dispose()).resolves.not.toThrow();
    });
  });
});
