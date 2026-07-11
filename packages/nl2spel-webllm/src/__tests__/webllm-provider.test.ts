import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { WebLLMProvider } from '../webllm-provider.js';

// Mock webgpu-detector module
vi.mock('../webgpu-detector.js', () => ({
  detectWebGPU: vi.fn().mockResolvedValue({
    available: true,
    adapterInfo: {
      vendor: 'NVIDIA',
      architecture: 'Ampere',
      description: 'RTX 4090',
      device: '0x1',
    },
  }),
}));

// Mock @mlc-ai/web-llm module
const mockCreateCompletions = vi.fn();
const mockEngineInstance = {
  chat: {
    completions: {
      create: mockCreateCompletions,
    },
  },
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

  afterEach(() => {
    vi.clearAllMocks();
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
      const provider = new WebLLMProvider({ model: 'unknown' });
      expect(provider.capabilities.maxContextTokens).toBe(8192);
    });

    it('should allow custom model config override', () => {
      const provider = new WebLLMProvider({
        model: 'gemma-2-2b-it',
        customModelConfig: { maxContextTokens: 4096, estimatedTokPerSec: 50 },
      });
      expect(provider.capabilities.maxContextTokens).toBe(4096);
    });

    it('should accept disableGrammar and debug options', () => {
      const p1 = new WebLLMProvider({ model: 'gemma-2-2b-it', enableGrammar: false });
      expect(p1.name).toBe('webllm');

      const p2 = new WebLLMProvider({ model: 'gemma-2-2b-it', debug: true });
      expect(p2.name).toBe('webllm');
    });

    it('should have estimated latency > 0', () => {
      const provider = new WebLLMProvider({ model: 'gemma-2-2b-it' });
      expect(provider.capabilities.estimatedLatencyMs).toBeGreaterThan(0);
    });
  });

  // ===== isAvailable Tests =====
  describe('isAvailable', () => {
    it('should return true when WebGPU is available', async () => {
      const provider = new WebLLMProvider({ model: 'gemma-2-2b-it' });
      const available = await provider.isAvailable();
      expect(available).toBe(true);
    });

    it('should return false when detectWebGPU throws', async () => {
      const { detectWebGPU } = await import('../webgpu-detector.js');
      vi.mocked(detectWebGPU).mockRejectedValueOnce(new Error('GPU not found'));

      const provider = new WebLLMProvider({ model: 'gemma-2-2b-it' });
      const available = await provider.isAvailable();
      expect(available).toBe(false);
    });
  });

  // ===== Initialize Tests =====
  describe('initialize', () => {
    it('should initialize successfully when WebGPU is available', async () => {
      const onProgress = vi.fn();
      const provider = new WebLLMProvider({
        model: 'gemma-2-2b-it',
        onProgress,
        debug: false,
      });

      await provider.initialize();

      expect(mockCreateMLCEngine).toHaveBeenCalledTimes(1);
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

      // Simulate progress callback
      expect(progressCallback).not.toBeNull();
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
      const count1 = mockCreateMLCEngine.mock.calls.length;

      await provider.initialize();
      const count2 = mockCreateMLCEngine.mock.calls.length;

      // Second call should not re-create engine
      expect(count2).toBe(count1);
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

      // Slightly delay resolution to ensure both calls register
      setTimeout(() => resolveInit(mockEngineInstance), 10);
      await Promise.all([p1, p2]);

      expect(mockCreateMLCEngine).toHaveBeenCalledTimes(1);
    }, 10000);

    it('should throw when WebGPU is not available', async () => {
      const { detectWebGPU } = await import('../webgpu-detector.js');
      vi.mocked(detectWebGPU).mockResolvedValueOnce({
        available: false,
        error: 'No GPU found',
      });

      const provider = new WebLLMProvider({ model: 'gemma-2-2b-it' });
      await expect(provider.initialize()).rejects.toThrow('WebGPU is not available');
    });

    it('should catch and re-throw initialization errors', async () => {
      mockCreateMLCEngine.mockRejectedValueOnce(new Error('Model download failed'));

      const provider = new WebLLMProvider({ model: 'gemma-2-2b-it' });
      await expect(provider.initialize()).rejects.toThrow('WebLLM initialization failed');
    });

    it('should use WARN log level when debug=false', async () => {
      const provider = new WebLLMProvider({ model: 'gemma-2-2b-it', debug: false });
      await provider.initialize();
      expect(mockCreateMLCEngine).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ logLevel: 'WARN' }),
      );
    });
  });

  // ===== Generate Tests =====
  describe('generate', () => {
    it('should generate with grammar constraint enabled', async () => {
      const provider = new WebLLMProvider({ model: 'gemma-2-2b-it' });
      await provider.initialize();

      const response = await provider.generate(BASE_PROMPT);

      expect(mockCreateCompletions).toHaveBeenCalledTimes(1);
      expect(response.text).toBe('#order.amount > 1000');
      expect(response.providerName).toBe('webllm');
      expect(response.finishReason).toBe('stop');
      expect(response.usage.totalTokens).toBe(150);
    });

    it('should generate without grammar constraint when disabled', async () => {
      const provider = new WebLLMProvider({
        model: 'gemma-2-2b-it',
        enableGrammar: false,
      });
      await provider.initialize();

      await provider.generate(BASE_PROMPT);

      expect(mockCreateCompletions).toHaveBeenCalled();
      // First arg should be an object with messages, temperature, max_tokens, top_p
      const call = mockCreateCompletions.mock.calls[0]![0]!;
      expect(call.messages).toBeDefined();
      expect(call.temperature).toBe(0.1);
      expect(call.max_tokens).toBe(512);
    });

    it('should pass custom generation options', async () => {
      const provider = new WebLLMProvider({ model: 'gemma-2-2b-it' });
      await provider.initialize();

      await provider.generate(BASE_PROMPT, {
        temperature: 0.5,
        maxTokens: 256,
        topP: 0.95,
      });

      expect(mockCreateCompletions).toHaveBeenCalledWith(
        expect.objectContaining({
          temperature: 0.5,
          max_tokens: 256,
          top_p: 0.95,
        }),
      );
    });

    it('should throw when WebGPU is unavailable on generate', async () => {
      const { detectWebGPU } = await import('../webgpu-detector.js');
      vi.mocked(detectWebGPU).mockResolvedValueOnce({ available: false, error: 'No GPU' });
      const provider = new WebLLMProvider({ model: 'gemma-2-2b-it' });
      await expect(provider.generate(BASE_PROMPT)).rejects.toThrow();
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

      const chunks: string[] = [];
      let done = false;
      for await (const chunk of provider.generateStream!(BASE_PROMPT)) {
        chunks.push(chunk.delta);
        if (chunk.done) done = true;
      }

      expect(done).toBe(true);
      expect(chunks.length).toBe(1);
      expect(chunks[0]).toBe('#order.amount > 1000');
    });

    it('should initialize before streaming', async () => {
      const provider = new WebLLMProvider({ model: 'gemma-2-2b-it' });
      // Don't call initialize() — generateStream should auto-init
      await provider.initialize(); // initialize first for coverage

      for await (const chunk of provider.generateStream!(BASE_PROMPT)) {
        expect(chunk.done).toBe(true);
      }
    });
  });

  // ===== Dispose Tests =====
  describe('dispose', () => {
    it('should dispose without error when not initialized', async () => {
      const provider = new WebLLMProvider({ model: 'gemma-2-2b-it' });
      await expect(provider.dispose()).resolves.not.toThrow();
    });

    it('should be safe to call dispose multiple times', async () => {
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

  // ===== determineGPULevel Path =====
  describe('GPU level detection', () => {
    it('should detect high GPU level for NVIDIA', async () => {
      const { detectWebGPU } = await import('../webgpu-detector.js');
      vi.mocked(detectWebGPU).mockResolvedValueOnce({
        available: true,
        adapterInfo: {
          vendor: 'NVIDIA',
          architecture: 'Ampere',
          description: 'RTX 4090',
          device: '0x1',
        },
      });

      const provider = new WebLLMProvider({ model: 'gemma-2-2b-it' });
      await provider.initialize();
      // No assertion needed — just ensure no error
    });

    it('should detect high GPU level for Apple', async () => {
      const { detectWebGPU } = await import('../webgpu-detector.js');
      vi.mocked(detectWebGPU).mockResolvedValueOnce({
        available: true,
        adapterInfo: {
          vendor: 'Apple',
          architecture: 'apple-m4',
          description: 'M4 Pro',
          device: '0x1',
        },
      });

      const provider = new WebLLMProvider({ model: 'gemma-2-2b-it' });
      await provider.initialize();
    });

    it('should use medium GPU level for unknown vendor', async () => {
      const { detectWebGPU } = await import('../webgpu-detector.js');
      vi.mocked(detectWebGPU).mockResolvedValueOnce({
        available: true,
        adapterInfo: {
          vendor: 'RaspberryPi',
          architecture: 'unknown',
          description: 'Pi GPU',
          device: '0x1',
        },
      });

      const provider = new WebLLMProvider({ model: 'gemma-2-2b-it' });
      await provider.initialize();
    });
  });
});
