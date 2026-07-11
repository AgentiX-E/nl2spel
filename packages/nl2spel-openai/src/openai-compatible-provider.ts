import {
  type LLMProvider,
  type LLMCapabilities,
  type LLMPrompt,
  type LLMGenerateOptions,
  type LLMResponse,
  type LLMStreamChunk,
  type PromptBuilder,
  type ContextSchema,
} from '@agentix-e/nl2spel';
import { PROVIDER_PRESETS, type ProviderPreset } from './provider-presets.js';

export interface OpenAICompatibleConfig {
  /** Predefined provider name (openai/deepseek/glm/copilot/hunyuan/minimax/kimi) */
  provider?: string;

  /** Custom config (used when provider is empty or not found) */
  custom?: {
    name: string;
    baseURL: string;
    apiKey: string;
    model: string;
    maxContextTokens?: number;
  };

  /** API key (overrides preset default) */
  apiKey?: string;

  /** Model name (overrides preset default) */
  model?: string;

  /** Maximum context tokens (overrides preset default) */
  maxContextTokens?: number;

  /** Custom request headers */
  headers?: Record<string, string>;
}

function defaultPromptBuilder(): PromptBuilder {
  // Dynamic import to avoid circular dependency
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { PromptBuilder } = require('@agentix-e/nl2spel') as typeof import('@agentix-e/nl2spel');
  return new PromptBuilder();
}

export class OpenAICompatibleProvider implements LLMProvider {
  public readonly name: string;
  public readonly capabilities: LLMCapabilities;

  private readonly baseURL: string;
  private readonly apiKey: string;
  private readonly model: string;
  private readonly headers: Record<string, string>;
  private readonly _promptBuilder: PromptBuilder;

  constructor(config: OpenAICompatibleConfig, promptBuilder?: PromptBuilder) {
    let preset: ProviderPreset | null = null;

    if (config.provider && PROVIDER_PRESETS[config.provider]) {
      preset = PROVIDER_PRESETS[config.provider]!;
    }

    if (config.custom) {
      this.name = config.custom.name;
      this.baseURL = config.custom.baseURL;
      this.apiKey = config.custom.apiKey;
      this.model = config.custom.model;
      this.headers = {};
    } else if (preset) {
      this.name = preset.name;
      this.baseURL = preset.baseURL;
      this.apiKey = config.apiKey ?? '';
      this.model = config.model ?? preset.defaultModel;
      this.headers = { ...preset.headers };
    } else {
      throw new Error(
        'OpenAICompatibleProvider requires either a known "provider" name or a "custom" config',
      );
    }

    // Allow overriding apiKey and model via config
    if (config.apiKey) this.apiKey = config.apiKey;
    if (config.model) this.model = config.model;

    // Merge headers
    if (config.headers) {
      Object.assign(this.headers, config.headers);
    }

    this._promptBuilder = promptBuilder ?? defaultPromptBuilder();

    const maxTokens = config.maxContextTokens ?? preset?.maxContextTokens ?? 128000;
    const streaming = preset?.supportsStreaming ?? true;

    this.capabilities = {
      maxContextTokens: maxTokens,
      supportsGrammarConstraint: false,
      supportsStreaming: streaming,
      supportsStructuredOutput: preset?.supportsStructuredOutput ?? false,
      offlineAvailable: false,
      estimatedCostPerRequest: preset?.estimatedCostPerRequest ?? 0.001,
      estimatedLatencyMs: preset?.estimatedLatencyMs ?? 2000,
    };
  }

  async isAvailable(): Promise<boolean> {
    return !!this.apiKey;
  }

  async generate(prompt: LLMPrompt, options?: LLMGenerateOptions): Promise<LLMResponse> {
    const startTime = Date.now();
    const model = options?.model ?? this.model;

    const messages = [
      { role: 'system', content: prompt.system },
      { role: 'user', content: prompt.user },
    ];

    // Include few-shot examples as part of user message if not already in it
    if (prompt.examples.length > 0 && !prompt.user.includes('Few-Shot')) {
      const exampleText = prompt.examples.map(e => `NL: ${e.nl}\nSpEL: ${e.spel}`).join('\n\n');
      messages.push({
        role: 'user',
        content: `Examples:\n${exampleText}\n\nInput: ${prompt.user}`,
      });
    }

    const body: Record<string, unknown> = {
      model,
      messages,
      temperature: options?.temperature ?? 0.1,
      max_tokens: options?.maxTokens ?? 512,
      top_p: options?.topP ?? 0.9,
    };

    if (options?.stopSequences) {
      body.stop = options.stopSequences;
    }

    const timeout = options?.timeout ?? 30000;
    const maxRetries = options?.maxRetries ?? 2;
    let lastError: Error | null = null;

    for (let retry = 0; retry <= maxRetries; retry++) {
      try {
        const response = await this.fetchWithTimeout(
          `${this.baseURL}/chat/completions`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${this.apiKey}`,
              ...this.headers,
            },
            body: JSON.stringify(body),
          },
          timeout,
        );

        const data = (await response.json()) as any;

        if (!response.ok) {
          const errorMsg = data?.error?.message ?? `HTTP ${response.status}`;
          throw new Error(`API error (${response.status}): ${errorMsg}`);
        }

        const choice = data.choices?.[0];

        return {
          text: choice?.message?.content?.trim() ?? '',
          model: data.model ?? model,
          usage: {
            promptTokens: data.usage?.prompt_tokens ?? 0,
            completionTokens: data.usage?.completion_tokens ?? 0,
            totalTokens: data.usage?.total_tokens ?? 0,
          },
          latencyMs: Date.now() - startTime,
          finishReason: choice?.finish_reason ?? 'stop',
          providerName: this.name,
        };
      } catch (err) {
        lastError = err as Error;
        if (retry < maxRetries) {
          await new Promise(r => setTimeout(r, 1000 * (retry + 1)));
        }
      }
    }

    throw lastError ?? new Error('Unknown error');
  }

  async *generateStream(
    prompt: LLMPrompt,
    options?: LLMGenerateOptions,
  ): AsyncIterable<LLMStreamChunk> {
    const model = options?.model ?? this.model;

    const messages = [
      { role: 'system', content: prompt.system },
      { role: 'user', content: prompt.user },
    ];

    const body: Record<string, unknown> = {
      model,
      messages,
      temperature: options?.temperature ?? 0.1,
      max_tokens: options?.maxTokens ?? 512,
      top_p: options?.topP ?? 0.9,
      stream: true,
    };

    const response = await fetch(`${this.baseURL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
        ...this.headers,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`API error (${response.status}): ${err}`);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error('No response body');

    const decoder = new TextDecoder();
    let accumulated = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n').filter(l => l.startsWith('data: '));

        for (const line of lines) {
          const data = line.slice(6).trim();
          if (data === '[DONE]') {
            yield { delta: '', accumulated, done: true, finishReason: 'stop' };
            return;
          }

          try {
            const parsed = JSON.parse(data);
            const delta = parsed.choices?.[0]?.delta?.content ?? '';
            accumulated += delta;

            yield {
              delta,
              accumulated,
              done: false,
              finishReason: parsed.choices?.[0]?.finish_reason,
            };
          } catch {
            // Skip malformed lines
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    yield { delta: '', accumulated, done: true, finishReason: 'stop' };
  }

  /**
   * Set the PromptBuilder (convenient for injecting mocks in tests)
   */
  setPromptBuilder(builder: PromptBuilder): void {
    (this as any)._promptBuilder = builder;
  }

  /**
   * Get the PromptBuilder
   */
  getPromptBuilder(): PromptBuilder {
    return this._promptBuilder;
  }

  private async fetchWithTimeout(
    url: string,
    init: RequestInit,
    timeoutMs: number,
  ): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        ...init,
        signal: controller.signal,
      });
      return response;
    } finally {
      clearTimeout(timeoutId);
    }
  }
}
