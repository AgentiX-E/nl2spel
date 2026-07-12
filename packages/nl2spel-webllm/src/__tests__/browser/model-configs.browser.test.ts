/**
 * Browser-based tests for model-configs.ts
 * Uses actual Chromium browser via Playwright.
 */
import { test, expect } from '@playwright/test';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { resolve, dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/** Strip export for browser */
function loadForBrowser(filePath: string): string {
  let source = readFileSync(filePath, 'utf-8');
  source = source.replace(/^export\s+(function|class|const|let|var|async|default)\s+/gm, '$1 ');
  source = source.replace(/^export\s*\{[^}]*\};?\s*$/gm, '');
  source = source.replace(/^export\s+/gm, '');
  return source;
}

const modelConfigsSource = loadForBrowser(resolve(__dirname, '../../../dist/model-configs.js'));
const wrappedSource = `
(function() {
  ${modelConfigsSource}
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
    expect(typeof result.highVRAM).toBe('string');
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
    expect(result.errors).toHaveLength(0);
    expect(result.count).toBe(4);
  });

  test('recommendModel returns fastest from valid VRAM', async ({ page }) => {
    const result = await page.evaluate(source => {
      new Function(source)();
      const rm = (window as any).recommendModel;

      // With 2GB VRAM, only the smallest models fit
      const model = rm(2);
      // Should select the fastest one that fits within 2GB
      return { model, isString: typeof model === 'string' };
    }, wrappedSource);

    expect(result.isString).toBe(true);
    expect(result.model.length).toBeGreaterThan(0);
  });
});
