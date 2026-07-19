import type {
  LLMProvider,
  LLMCapabilities,
  LLMPrompt,
  LLMGenerateOptions,
  LLMResponse,
  LLMStreamChunk,
} from '@agentix-e/nl2spel';
import { MODEL_CONFIGS, type ModelConfig } from './model-configs.js';

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
 * Uses @mlc-ai/web-llm to run local models in the browser.
 * WebLLM's CreateMLCEngine handles all GPU detection and error reporting internally.
 * This provider simply delegates to WebLLM's native capabilities.
 */
export class WebLLMProvider implements LLMProvider {
  public readonly name = 'webllm';
  public readonly capabilities: LLMCapabilities;

  private readonly config: WebLLMConfig;
  private readonly modelConfig: ModelConfig;

  private _engine: unknown = null;
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

    this.capabilities = {
      maxContextTokens: this.modelConfig.maxContextTokens,
      supportsGrammarConstraint: true,
      supportsStreaming: true,
      supportsStructuredOutput: false,
      offlineAvailable: true,
      costPreference: 0,
      latencyPreference: Math.round((1000 / this.modelConfig.estimatedTokPerSec) * 50),
    };
  }

  /**
   * Initialize — download and load the model via WebLLM.
   * WebLLM's CreateMLCEngine handles GPU detection natively.
   */
  async initialize(): Promise<void> {
    if (this._initialized) return;
    if (this._initPromise) return this._initPromise;

    this._initPromise = this._doInitialize();
    return this._initPromise;
  }

  private async _doInitialize(): Promise<void> {
    try {
      const { CreateMLCEngine } = await this.importWebLLM();

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
   * Dynamic import of WebLLM (separated for test mocking)
   */
  private async importWebLLM(): Promise<any> {
    return import('@mlc-ai/web-llm');
  }

  /**
   * Check if the provider is available.
   * Simply returns true — actual GPU availability is determined by WebLLM at initialization.
   */
  async isAvailable(): Promise<boolean> {
    return true;
  }

  /**
   * Generate a SpEL expression
   */
  async generate(prompt: LLMPrompt, options?: LLMGenerateOptions): Promise<LLMResponse> {
    await this.initialize();
    const engine = this._engine as any;

    const startTime = Date.now();

    const messages = [
      { role: 'system' as const, content: prompt.system },
      { role: 'user' as const, content: prompt.user },
    ];

    // GBNF grammar generation is available via GBNFGenerator for manual use.
    // Auto-injection into WebLLM requests is not yet supported by @mlc-ai/web-llm.
    // if (this.config.enableGrammar) {
    //   this.gbnfGenerator.generate(prompt.contextSchema);
    // }

    try {
      const completion = await engine.chat.completions.create({
        messages,
        temperature: options?.temperature ?? 0.1,
        max_tokens: options?.maxTokens ?? 512,
        top_p: options?.topP ?? 0.9,
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
   * Streaming generation — falls back to generate() since WebLLM stream API
   * requires extra handling not yet implemented.
   */
  async *generateStream(
    prompt: LLMPrompt,
    options?: LLMGenerateOptions,
  ): AsyncIterable<LLMStreamChunk> {
    await this.initialize();

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
}
