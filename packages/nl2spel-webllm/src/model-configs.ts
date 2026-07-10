/**
 * WebLLM 模型配置表 — 4 个优化的小模型。
 */
export interface ModelConfig {
  /** 模型 ID (WebLLM model repo id) */
  modelId: string;
  /** 显示名称 */
  displayName: string;
  /** 上下文窗口 (tokens) */
  maxContextTokens: number;
  /** 模型大小 (GB) */
  modelSizeGB: number;
  /** VRAM 需求 (GB) */
  vramRequiredGB: number;
  /** 最低 WebGPU 等级要求 */
  minWebGPU: 'low' | 'medium' | 'high';
  /** 推理速度估算 (tok/s) */
  estimatedTokPerSec: number;
  /** 模型 HF 仓库 */
  hfRepo: string;
  /** 量化级别 */
  quantization: string;
}

export const MODEL_CONFIGS: Record<string, ModelConfig> = {
  'gemma-2-2b-it': {
    modelId: 'gemma-2-2b-it-q4f16_1-MLC',
    displayName: 'Gemma 2 2B Instruct',
    maxContextTokens: 8192,
    modelSizeGB: 1.5,
    vramRequiredGB: 2.0,
    minWebGPU: 'low',
    estimatedTokPerSec: 25,
    hfRepo: 'google/gemma-2-2b-it',
    quantization: 'q4f16_1',
  },

  'phi-3-mini': {
    modelId: 'Phi-3-mini-4k-instruct-q4f16_1-MLC',
    displayName: 'Phi-3 Mini 4K Instruct',
    maxContextTokens: 4096,
    modelSizeGB: 2.2,
    vramRequiredGB: 2.8,
    minWebGPU: 'medium',
    estimatedTokPerSec: 20,
    hfRepo: 'microsoft/Phi-3-mini-4k-instruct',
    quantization: 'q4f16_1',
  },

  'qwen2.5-1.5b': {
    modelId: 'Qwen2.5-1.5B-Instruct-q4f16_1-MLC',
    displayName: 'Qwen 2.5 1.5B Instruct',
    maxContextTokens: 32768,
    modelSizeGB: 1.1,
    vramRequiredGB: 1.5,
    minWebGPU: 'low',
    estimatedTokPerSec: 30,
    hfRepo: 'Qwen/Qwen2.5-1.5B-Instruct',
    quantization: 'q4f16_1',
  },

  'llama-3.2-3b': {
    modelId: 'Llama-3.2-3B-Instruct-q4f16_1-MLC',
    displayName: 'Llama 3.2 3B Instruct',
    maxContextTokens: 8192,
    modelSizeGB: 2.8,
    vramRequiredGB: 3.5,
    minWebGPU: 'high',
    estimatedTokPerSec: 15,
    hfRepo: 'meta-llama/Llama-3.2-3B-Instruct',
    quantization: 'q4f16_1',
  },
};

/** 按 VRAM 需求排序的模型推荐 */
export function recommendModel(vramGB: number): string {
  const models = Object.entries(MODEL_CONFIGS)
    .filter(([, config]) => config.vramRequiredGB <= vramGB)
    .sort(([, a], [, b]) => b.estimatedTokPerSec - a.estimatedTokPerSec);

  if (models.length > 0) {
    return models[0]![0]!;
  }

  // 如果都不满足，返回最小的
  const smallest = Object.entries(MODEL_CONFIGS).sort(
    ([, a], [, b]) => a.vramRequiredGB - b.vramRequiredGB,
  );

  return smallest[0]![0]!;
}
