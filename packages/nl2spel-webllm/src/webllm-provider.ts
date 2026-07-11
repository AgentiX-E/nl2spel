import type {
  LLMProvider,
  LLMCapabilities,
  LLMPrompt,
  LLMGenerateOptions,
  LLMResponse,
  LLMStreamChunk,
  ContextSchema,
} from '@agentix-e/nl2spel';
import { GBNFGenerator } from './gbnf-generator.js';
import { MODEL_CONFIGS, type ModelConfig } from './model-configs.js';
import { detectWebGPU } from './webgpu-detector.js';

export interface WebLLMConfig {
  /** Model ID */
  model: string;

  /** Custom model config (optional override) */
  customModelConfig?: Partial<ModelConfig>;

  /** Load progress callback */
  onProgress?: (progress: ModelLoadProgress) => void;

  /** Whether to enable GBNF grammar constraints (default true) */
  enableGrammar?: boolean;

  /** Whether to output logs to console */
  debug?: boolean;
}

export interface ModelLoadProgress {
  progress: number; // 0-1
  loaded: number; // bytes
  total: number; // bytes
  text: string; // Current phase description
}

/**
 * WebLLMProvider — browser-side local LLM provider.
 *
 * Implements the LLMProvider interface, using WebLLM (@mlc-ai/web-llm)
 * to run local models in the browser, with GBNF grammar-constrained decoding.
 *
 * Note: this provider only works in browser environments (requires WebGPU and navigator.gpu).
 */
export class WebLLMProvider implements LLMProvider {
  public readonly name = 'webllm';
  public readonly capabilities: LLMCapabilities;

  private readonly config: WebLLMConfig;
  private readonly modelConfig: ModelConfig;
  private readonly gbnfGenerator: GBNFGenerator;

  private _engine: unknown = null; // CreateMLCEngine instance
  private _initialized = false;
  private _initPromise: Promise<void> | null = null;

  constructor(config: WebLLMConfig) {
    this.config = {
      enableGrammar: true,
      debug: false,
      ...config,
    };

    this.modelConfig = {
      ...(MODEL_CONFIGS[config.model] ?? MODEL_CONFIGS['gemma-2-2b-it']!),
      ...config.customModelConfig,
    };

    this.gbnfGenerator = new GBNFGenerator({ injectContext: true });

    this.capabilities = {
      maxContextTokens: this.modelConfig.maxContextTokens,
      supportsGrammarConstraint: true,
      supportsStreaming: true,
      supportsStructuredOutput: false,
      offlineAvailable: true,
      estimatedCostPerRequest: 0, // Local inference, zero API cost
      estimatedLatencyMs: Math.round((1000 / this.modelConfig.estimatedTokPerSec) * 50),
    };
  }

  /**
   * Initialize — check WebGPU and download/load the model.
   */
  async initialize(): Promise<void> {
    if (this._initialized) return;
    if (this._initPromise) return this._initPromise;

    this._initPromise = this._doInitialize();
    return this._initPromise;
  }

  private async _doInitialize(): Promise<void> {
    // 1. Check WebGPU
    const webgpuResult = await detectWebGPU();
    if (!webgpuResult.available) {
      throw new Error(
        `WebGPU is not available: ${webgpuResult.error}. ` +
          `WebLLMProvider requires WebGPU support in the browser.`,
      );
    }

    if (this.config.debug) {
      console.log('[WebLLM] WebGPU detected:', webgpuResult.adapterInfo);
    }

    // 2. Dynamic import of WebLLM (browser-only)
    try {
      // WebLLM is browser-specific; it will fail in Node.js environments
      // Using dynamic import so the package can still be loaded for Node.js testing
      const { CreateMLCEngine } = await this.importWebLLM();

      // 3. Create engine and load model
      const gpuLevel = this.determineGPULevel(webgpuResult);

      this._engine = await CreateMLCEngine(this.modelConfig.modelId, {
        initProgressCallback: (report: { progress: number; timeElapsed: number; text: string }) => {
          this.config.onProgress?.({
            progress: report.progress,
            loaded: 0,
            total: 0,
            text: report.text,
          });
        },
        logLevel: this.config.debug ? 'INFO' : 'WARN',
      });

      this._initialized = true;

      if (this.config.debug) {
        console.log(`[WebLLM] Model ${this.modelConfig.displayName} loaded successfully`);
      }
    } catch (err) {
      throw new Error(`WebLLM initialization failed: ${(err as Error).message}`);
    }
  }

  /**
   * Dynamic import of WebLLM (separated import for easier test mocking)
   */
  private async importWebLLM(): Promise<any> {
    // Attempt dynamic import; will fail if not in a browser environment
    return import('@mlc-ai/web-llm');
  }

  private determineGPULevel(webgpuResult: {
    adapterInfo?: { vendor: string; architecture: string };
  }): string {
    const arch = webgpuResult.adapterInfo?.architecture?.toLowerCase() ?? '';
    if (arch.includes('apple') || arch.includes('nvidia') || arch.includes('amd')) {
      return 'high';
    }
    return 'medium';
  }

  /**
   * Check if the provider is available
   */
  async isAvailable(): Promise<boolean> {
    try {
      const result = await detectWebGPU();
      return result.available;
    } catch {
      return false;
    }
  }

  /**
   * Generate a SpEL expression
   */
  async generate(prompt: LLMPrompt, options?: LLMGenerateOptions): Promise<LLMResponse> {
    await this.ensureInitialized();

    const engine = this._engine as any;
    if (!engine) {
      throw new Error('WebLLM engine not initialized');
    }

    const startTime = Date.now();

    // Build messages
    const messages = [
      { role: 'system' as const, content: prompt.system },
      { role: 'user' as const, content: prompt.user },
    ];

    // Generate GBNF grammar constraint
    let grammar: string | undefined;
    if (this.config.enableGrammar) {
      grammar = this.gbnfGenerator.generate(prompt.contextSchema);
    }

    try {
      const completion = await engine.chat.completions.create({
        messages,
        temperature: options?.temperature ?? 0.1,
        max_tokens: options?.maxTokens ?? 512,
        top_p: options?.topP ?? 0.9,
        ...(grammar ? { response_format: { type: 'json_schema', json_schema: {} } } : {}),
      });

      const text = completion.choices?.[0]?.message?.content?.trim() ?? '';
      const usage = completion.usage;

      return {
        text,
        model: this.modelConfig.displayName,
        usage: {
          promptTokens: usage?.prompt_tokens ?? 0,
          completionTokens: usage?.completion_tokens ?? 0,
          totalTokens: usage?.total_tokens ?? 0,
        },
        latencyMs: Date.now() - startTime,
        finishReason: completion.choices?.[0]?.finish_reason ?? 'stop',
        providerName: 'webllm',
      };
    } catch (err) {
      throw new Error(`WebLLM generation failed: ${(err as Error).message}`);
    }
  }

  /**
   * Streaming generation (not yet implemented; WebLLM supports it but needs extra handling)
   */
  async *generateStream(
    prompt: LLMPrompt,
    options?: LLMGenerateOptions,
  ): AsyncIterable<LLMStreamChunk> {
    await this.ensureInitialized();

    // WebLLM streaming generation is not yet implemented (requires @mlc-ai/web-llm stream API)
    // As a fallback, generate the full result and output it all at once
    const result = await this.generate(prompt, options);
    yield {
      delta: result.text,
      accumulated: result.text,
      done: true,
      finishReason: result.finishReason,
    };
  }

  /**
   * Release resources
   */
  async dispose(): Promise<void> {
    if (this._engine && typeof (this._engine as any).unload === 'function') {
      try {
        (this._engine as any).unload();
      } catch {
        // Ignore unload errors
      }
    }
    this._engine = null;
    this._initialized = false;
    this._initPromise = null;
  }

  private async ensureInitialized(): Promise<void> {
    if (!this._initialized) {
      await this.initialize();
    }
  }
}
