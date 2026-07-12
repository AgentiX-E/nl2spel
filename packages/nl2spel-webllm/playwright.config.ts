import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testMatch: 'src/__tests__/browser/**/*.browser.test.ts',
  timeout: 30000,
  fullyParallel: false,
  forbidOnly: true,
  retries: 0,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:0',
    trace: 'off',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
