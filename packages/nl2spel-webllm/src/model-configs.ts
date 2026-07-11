/**
 * WebLLM model configuration table — 4 optimized small models.
 */
export interface ModelConfig {
  /** Model ID (WebLLM model repo id) */
  modelId: string;
  /** Display name */
  displayName: string;
  /** Context window (tokens) */
  maxContextTokens: number;
  /** Model size (GB) */
  modelSizeGB: number;
  /** VRAM requirement (GB) */
  vramRequiredGB: number;
  /** Minimum WebGPU tier requirement */
  minWebGPU: 'low' | 'medium' | 'high';
  /** Estimated inference speed (tok/s) */
  estimatedTokPerSec: number;
  /** Model HF repository */
  hfRepo: string;
  /** Quantization level */
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

/** Model recommendation sorted by VRAM requirement */
export function recommendModel(vramGB: number): string {
  const models = Object.entries(MODEL_CONFIGS)
    .filter(([, config]) => config.vramRequiredGB <= vramGB)
    .sort(([, a], [, b]) => b.estimatedTokPerSec - a.estimatedTokPerSec);

  if (models.length > 0) {
    return models[0]![0]!;
  }

  // If none fit, return the smallest model
  const smallest = Object.entries(MODEL_CONFIGS).sort(
    ([, a], [, b]) => a.vramRequiredGB - b.vramRequiredGB,
  );

  return smallest[0]![0]!;
}
