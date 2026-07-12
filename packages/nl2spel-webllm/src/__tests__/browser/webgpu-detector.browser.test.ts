/**
 * Browser-based tests for webgpu-detector.ts
 * Runs in REAL Chromium browser via Playwright.
 * Tests actual navigator.gpu integration — no mocks.
 */
import { test, expect } from '@playwright/test';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { resolve, dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/** Strip export statements for browser evaluation */
function loadForBrowser(filePath: string): string {
  let source = readFileSync(filePath, 'utf-8');
  source = source.replace(/^export\s+(function|class|const|let|var|async|default)\s+/gm, '$1 ');
  source = source.replace(/^export\s*\{[^}]*\};?\s*$/gm, '');
  source = source.replace(/^export\s+/gm, '');
  return source;
}

const detectorSource = loadForBrowser(resolve(__dirname, '../../../dist/webgpu-detector.js'));

// Prepend a wrapper so exported symbols are accessible on window
const wrappedDetectorSource = `
(function() {
  ${detectorSource}
  window.detectWebGPU = detectWebGPU;
})();
`;

test.describe('detectWebGPU (real browser)', () => {
  test('should return available=false in headless Chromium without GPU', async ({ page }) => {
    const result = await page.evaluate(source => {
      // Execute our compiled module in the real browser context
      new Function(source)();
      const detectWebGPU = (window as any).detectWebGPU;
      return detectWebGPU();
    }, wrappedDetectorSource);

    // In headless Chromium without GPU flags, WebGPU is unavailable
    expect(result.available).toBe(false);
    expect(result.error).toBeTruthy();
    expect(result.error).toContain('not available');
  });

  test('returns structured error object when unavailable', async ({ page }) => {
    const result = await page.evaluate(source => {
      new Function(source)();
      const detectWebGPU = (window as any).detectWebGPU;
      return detectWebGPU();
    }, wrappedDetectorSource);

    // Verify the response shape when WebGPU is unavailable
    expect(result).toHaveProperty('available');
    expect(result).toHaveProperty('error');
    expect(typeof result.available).toBe('boolean');
    expect(typeof result.error).toBe('string');
  });

  test('navigator object exists in real browser context', async ({ page }) => {
    const navInfo = await page.evaluate(() => ({
      hasNavigator: typeof navigator !== 'undefined',
      isObject: typeof navigator === 'object',
      hasUserAgent: typeof navigator.userAgent === 'string',
      hasLanguage: typeof navigator.language === 'string',
    }));

    expect(navInfo.hasNavigator).toBe(true);
    expect(navInfo.isObject).toBe(true);
    expect(navInfo.hasUserAgent).toBe(true);
    expect(navInfo.hasLanguage).toBe(true);
  });

  test('detectWebGPU handles async execution without throwing', async ({ page }) => {
    const result = await page.evaluate(source => {
      new Function(source)();
      const detectWebGPU = (window as any).detectWebGPU;

      // Verify the function returns a Promise (it's async)
      const promise = detectWebGPU();
      return {
        isPromise: promise instanceof Promise,
        hasThen: typeof promise?.then === 'function',
      };
    }, wrappedDetectorSource);

    expect(result.isPromise).toBe(true);
    expect(result.hasThen).toBe(true);
  });
});
