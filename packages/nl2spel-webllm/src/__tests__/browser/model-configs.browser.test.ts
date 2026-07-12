/**
 * Browser-based tests for model-configs.ts
 * Uses actual Chromium browser via Playwright — verifies the module loads and works.
 */
import { test, expect } from '@playwright/test';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { resolve, dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function loadForBrowser(filePath: string): string {
  let source = readFileSync(filePath, 'utf-8');
  source = source.replace(/^export\s+(function|class|const|let|var|async|default)\s+/gm, '$1 ');
  source = source.replace(/^export\s*\{[^}]*\};?\s*$/gm, '');
  source = source.replace(/^export\s+/gm, '');
  // Remove type annotations that break in browser
  source = source.replace(/: ModelConfig/g, '');
  source = source.replace(/ModelConfig/g, 'any');
  return source;
}

const wrappedSource = `
(function() {
  ${loadForBrowser(resolve(__dirname, '../../../dist/model-configs.js'))}
  window.MODEL_CONFIGS = MODEL_CONFIGS;
  window.recommendModel = recommendModel;
})();
`;

test.describe('MODEL_CONFIGS (real browser)', () => {
  test('recommendModel works in browser context', async ({ page }) => {
    const result = await page.evaluate(source => {
      new Function(source)();
      return {
        modelCount: Object.keys((window as any).MODEL_CONFIGS).length,
        lowVRAM: (window as any).recommendModel(2),
        highVRAM: (window as any).recommendModel(8),
      };
    }, wrappedSource);

    expect(result.modelCount).toBe(4);
    expect(typeof result.lowVRAM).toBe('string');
  });

  test('MODEL_CONFIGS structure is valid in browser', async ({ page }) => {
    const result = await page.evaluate(source => {
      new Function(source)();
      const configs = (window as any).MODEL_CONFIGS;
      const errors: string[] = [];
      for (const [key, config] of Object.entries(configs)) {
        const c = config as any;
        if (!c.modelId) errors.push(`Missing modelId in ${key}`);
        if (c.vramRequiredGB <= 0) errors.push(`Invalid VRAM in ${key}`);
      }
      return { valid: errors.length === 0, errors, count: Object.keys(configs).length };
    }, wrappedSource);

    expect(result.valid).toBe(true);
    expect(result.count).toBe(4);
  });
});
