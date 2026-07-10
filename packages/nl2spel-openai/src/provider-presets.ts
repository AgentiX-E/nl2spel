/**
 * PROVIDER_PRESETS — 7 个预定义 LLM Provider 配置。
 *
 * 每个 Preset 包含完整的 API 端点和模型名称。
 */
export interface ProviderPreset {
  /** Provider 名称 */
  name: string;
  /** API 基础 URL */
  baseURL: string;
  /** 默认模型 */
  defaultModel: string;
  /** 最大上下文 tokens */
  maxContextTokens: number;
  /** 是否支持流式输出 */
  supportsStreaming: boolean;
  /** 估算单次请求成本（美元） */
  estimatedCostPerRequest: number;
  /** 估算延迟 (ms) */
  estimatedLatencyMs: number;
  /** 默认请求头 */
  headers?: Record<string, string>;
  /** 是否支持结构化输出 */
  supportsStructuredOutput: boolean;
}

export const PROVIDER_PRESETS: Record<string, ProviderPreset> = {
  openai: {
    name: 'openai',
    baseURL: 'https://api.openai.com/v1',
    defaultModel: 'gpt-4o-mini',
    maxContextTokens: 128000,
    supportsStreaming: true,
    estimatedCostPerRequest: 0.0003,
    estimatedLatencyMs: 2000,
    supportsStructuredOutput: true,
  },

  deepseek: {
    name: 'deepseek',
    baseURL: 'https://api.deepseek.com/v1',
    defaultModel: 'deepseek-chat',
    maxContextTokens: 64000,
    supportsStreaming: true,
    estimatedCostPerRequest: 0.0001,
    estimatedLatencyMs: 1500,
    supportsStructuredOutput: false,
  },

  glm: {
    name: 'glm',
    baseURL: 'https://open.bigmodel.cn/api/paas/v4',
    defaultModel: 'glm-4-flash',
    maxContextTokens: 128000,
    supportsStreaming: true,
    estimatedCostPerRequest: 0.00005,
    estimatedLatencyMs: 1800,
    supportsStructuredOutput: false,
  },

  copilot: {
    name: 'copilot',
    baseURL: 'https://api.githubcopilot.com',
    defaultModel: 'gpt-4o',
    maxContextTokens: 128000,
    supportsStreaming: true,
    estimatedCostPerRequest: 0,
    estimatedLatencyMs: 2500,
    headers: { 'Copilot-Integration-Id': 'vscode-chat' },
    supportsStructuredOutput: true,
  },

  hunyuan: {
    name: 'hunyuan',
    baseURL: 'https://api.hunyuan.cloud.tencent.com/v1',
    defaultModel: 'hunyuan-lite',
    maxContextTokens: 32000,
    supportsStreaming: true,
    estimatedCostPerRequest: 0,
    estimatedLatencyMs: 2000,
    supportsStructuredOutput: false,
  },

  minimax: {
    name: 'minimax',
    baseURL: 'https://api.minimax.chat/v1',
    defaultModel: 'abab6.5s-chat',
    maxContextTokens: 32768,
    supportsStreaming: true,
    estimatedCostPerRequest: 0.002,
    estimatedLatencyMs: 2500,
    supportsStructuredOutput: false,
  },

  kimi: {
    name: 'kimi',
    baseURL: 'https://api.moonshot.cn/v1',
    defaultModel: 'moonshot-v1-8k',
    maxContextTokens: 8192,
    supportsStreaming: true,
    estimatedCostPerRequest: 0.002,
    estimatedLatencyMs: 2000,
    supportsStructuredOutput: false,
  },
};
