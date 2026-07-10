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
  /** 模型 ID */
  model: string;

  /** 自定义模型配置（可选择性覆盖） */
  customModelConfig?: Partial<ModelConfig>;

  /** 加载进度回调 */
  onProgress?: (progress: ModelLoadProgress) => void;

  /** 是否启用 GBNF 语法约束（默认 true） */
  enableGrammar?: boolean;

  /** 是否在控制台输出日志 */
  debug?: boolean;
}

export interface ModelLoadProgress {
  progress: number; // 0-1
  loaded: number; // bytes
  total: number; // bytes
  text: string; // 阶段描述
}

/**
 * WebLLMProvider — 浏览器端本地 LLM Provider。
 *
 * 实现 LLMProvider 接口，在浏览器中使用 WebLLM (@mlc-ai/web-llm)
 * 运行本地大模型，支持 GBNF 语法约束解码。
 *
 * 注意：此 Provider 仅工作在浏览器环境（依赖 WebGPU 和 navigator.gpu）。
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
      estimatedCostPerRequest: 0, // 本地推理，零 API 成本
      estimatedLatencyMs: Math.round((1000 / this.modelConfig.estimatedTokPerSec) * 50),
    };
  }

  /**
   * 初始化 — 检查 WebGPU 并下载/加载模型。
   */
  async initialize(): Promise<void> {
    if (this._initialized) return;
    if (this._initPromise) return this._initPromise;

    this._initPromise = this._doInitialize();
    return this._initPromise;
  }

  private async _doInitialize(): Promise<void> {
    // 1. 检查 WebGPU
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

    // 2. 动态导入 WebLLM (只在浏览器环境中)
    try {
      // WebLLM 是浏览器专用的，Node.js 环境会失败
      // 使用动态 import，让包在 Node.js 测试中也能加载
      const { CreateMLCEngine } = await this.importWebLLM();

      // 3. 创建引擎并加载模型
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
   * 动态导入 WebLLM（分离导入便于测试 mock）
   */
  private async importWebLLM(): Promise<any> {
    // 尝试动态导入，如果不在浏览器环境会失败
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
   * 检查 Provider 是否可用
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
   * 生成 SpEL 表达式
   */
  async generate(prompt: LLMPrompt, options?: LLMGenerateOptions): Promise<LLMResponse> {
    await this.ensureInitialized();

    const engine = this._engine as any;
    if (!engine) {
      throw new Error('WebLLM engine not initialized');
    }

    const startTime = Date.now();

    // 构建消息
    const messages = [
      { role: 'system' as const, content: prompt.system },
      { role: 'user' as const, content: prompt.user },
    ];

    // 生成 GBNF 语法约束
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
   * 流式生成（暂未实现，WebLLM 支持但需要额外处理）
   */
  async *generateStream(
    prompt: LLMPrompt,
    options?: LLMGenerateOptions,
  ): AsyncIterable<LLMStreamChunk> {
    await this.ensureInitialized();

    // WebLLM 流式生成暂不实现（需要 @mlc-ai/web-llm stream API）
    // 作为 fallback，生成完整结果后一次性输出
    const result = await this.generate(prompt, options);
    yield {
      delta: result.text,
      accumulated: result.text,
      done: true,
      finishReason: result.finishReason,
    };
  }

  /**
   * 释放资源
   */
  async dispose(): Promise<void> {
    if (this._engine && typeof (this._engine as any).unload === 'function') {
      try {
        (this._engine as any).unload();
      } catch {
        // 忽略卸载错误
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
