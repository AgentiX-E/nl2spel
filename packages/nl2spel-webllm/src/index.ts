// Public API — @agentix-e/nl2spel-webllm

export { WebLLMProvider } from './webllm-provider.js';
export type { WebLLMConfig, ModelLoadProgress } from './webllm-provider.js';

export { GBNFGenerator } from './gbnf-generator.js';
export type { GBNFGeneratorOptions, GBNFSection, GBNFStructure } from './gbnf-generator.js';

export { detectWebGPU } from './webgpu-detector.js';
export type { WebGPUDetectionResult } from './webgpu-detector.js';

export { MODEL_CONFIGS, recommendModel } from './model-configs.js';
export type { ModelConfig } from './model-configs.js';
