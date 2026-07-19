/**
 * PROVIDER_PRESETS — 7 predefined LLM provider configurations.
 *
 * Each preset includes the full API endpoint and model name.
 */
export interface ProviderPreset {
  /** Provider name */
  name: string;
  /** API base URL */
  baseURL: string;
  /** Default model */
  defaultModel: string;
  /** Maximum context tokens */
  maxContextTokens: number;
  /** Whether streaming output is supported */
  supportsStreaming: boolean;
  /** Default request headers */
  headers?: Record<string, string>;
  /** Whether structured output is supported */
  supportsStructuredOutput: boolean;
}

export const PROVIDER_PRESETS: Record<string, ProviderPreset> = {
  openai: {
    name: 'openai',
    baseURL: 'https://api.openai.com/v1',
    defaultModel: 'gpt-4o-mini',
    maxContextTokens: 128000,
    supportsStreaming: true,
    supportsStructuredOutput: true,
  },

  deepseek: {
    name: 'deepseek',
    baseURL: 'https://api.deepseek.com/v1',
    defaultModel: 'deepseek-chat',
    maxContextTokens: 64000,
    supportsStreaming: true,
    supportsStructuredOutput: false,
  },

  glm: {
    name: 'glm',
    baseURL: 'https://open.bigmodel.cn/api/paas/v4',
    defaultModel: 'glm-4-flash',
    maxContextTokens: 128000,
    supportsStreaming: true,
    supportsStructuredOutput: false,
  },

  copilot: {
    name: 'copilot',
    baseURL: 'https://api.githubcopilot.com',
    defaultModel: 'gpt-4o',
    maxContextTokens: 128000,
    supportsStreaming: true,
    headers: { 'Copilot-Integration-Id': 'vscode-chat' },
    supportsStructuredOutput: true,
  },

  hunyuan: {
    name: 'hunyuan',
    baseURL: 'https://api.hunyuan.cloud.tencent.com/v1',
    defaultModel: 'hunyuan-lite',
    maxContextTokens: 32000,
    supportsStreaming: true,
    supportsStructuredOutput: false,
  },

  minimax: {
    name: 'minimax',
    baseURL: 'https://api.minimax.chat/v1',
    defaultModel: 'abab6.5s-chat',
    maxContextTokens: 32768,
    supportsStreaming: true,
    supportsStructuredOutput: false,
  },

  kimi: {
    name: 'kimi',
    baseURL: 'https://api.moonshot.cn/v1',
    defaultModel: 'moonshot-v1-8k',
    maxContextTokens: 8192,
    supportsStreaming: true,
    supportsStructuredOutput: false,
  },
};
