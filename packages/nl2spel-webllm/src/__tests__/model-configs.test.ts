import { describe, it, expect } from 'vitest';
import { MODEL_CONFIGS, recommendModel, type ModelConfig } from '../model-configs.js';

describe('Model Configs', () => {
  // ===== WL-M01: Config completeness =====
  describe('WL-M01: Config Completeness', () => {
    it('should have 4 models configured', () => {
      expect(Object.keys(MODEL_CONFIGS).length).toBe(4);
    });

    it('all models should have valid config', () => {
      const keys = [
        'modelId',
        'displayName',
        'maxContextTokens',
        'modelSizeGB',
        'vramRequiredGB',
        'minWebGPU',
        'estimatedTokPerSec',
        'hfRepo',
        'quantization',
      ] as const;

      for (const [name, config] of Object.entries(MODEL_CONFIGS)) {
        for (const key of keys) {
          expect(
            config[key as keyof ModelConfig],
            `${name}.${key} should be defined`,
          ).toBeDefined();
        }
      }
    });

    it('all models should have positive context size', () => {
      for (const [, config] of Object.entries(MODEL_CONFIGS)) {
        expect(config.maxContextTokens).toBeGreaterThan(0);
      }
    });

    it('all models should have valid quantization', () => {
      for (const [, config] of Object.entries(MODEL_CONFIGS)) {
        expect(config.quantization).toMatch(/^q\d/);
      }
    });

    it('VRAM requirement should be >= model size', () => {
      for (const [, config] of Object.entries(MODEL_CONFIGS)) {
        expect(config.vramRequiredGB).toBeGreaterThanOrEqual(config.modelSizeGB);
      }
    });
  });

  // ===== WL-M02: Model ordering =====
  describe('WL-M02: Model Ordering', () => {
    it('recommendModel should pick the fastest model that fits VRAM', () => {
      // With 4GB VRAM, all models fit — picks Qwen 2.5 1.5B (fastest at 30 tok/s)
      const model = recommendModel(4);
      expect(model).toBe('qwen2.5-1.5b');
    });

    it('should pick the smallest when VRAM is minimal', () => {
      const model = recommendModel(1.5);
      expect(model).toBe('qwen2.5-1.5b');
    });

    it('should fallback to smallest model when VRAM is very low', () => {
      const model = recommendModel(0.5);
      // qwen2.5-1.5b is the smallest
      expect(model).toBe('qwen2.5-1.5b');
    });

    it('should prefer high quality model when VRAM is abundant', () => {
      const model = recommendModel(8);
      // qwen2.5-1.5b is fastest
      expect(model).toBe('qwen2.5-1.5b');
    });
  });

  // ===== WL-M03: Model specifics =====
  describe('WL-M03: Model Specifics', () => {
    it('gemma-2-2b-it should have 8192 context', () => {
      expect(MODEL_CONFIGS['gemma-2-2b-it']!.maxContextTokens).toBe(8192);
    });

    it('phi-3-mini should have 4096 context', () => {
      expect(MODEL_CONFIGS['phi-3-mini']!.maxContextTokens).toBe(4096);
    });

    it('qwen2.5-1.5b should have 32768 context', () => {
      expect(MODEL_CONFIGS['qwen2.5-1.5b']!.maxContextTokens).toBe(32768);
    });

    it('llama-3.2-3b should have 8192 context', () => {
      expect(MODEL_CONFIGS['llama-3.2-3b']!.maxContextTokens).toBe(8192);
    });
  });
});
