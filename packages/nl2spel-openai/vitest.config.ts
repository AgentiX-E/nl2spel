import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
    testTimeout: 60000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'json-summary', 'html'],
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.test.ts',
        'src/__tests__/**',
        // Re-export files (no executable code)
        'src/index.ts',
      ],
      thresholds: {
        statements: 95,
        branches: 95,
        functions: 90,
        lines: 90,
      },
    },
    env: {
      DEEPSEEK_API_KEY: process.env.DEEPSEEK_API_KEY ?? '',
    },
  },
});
