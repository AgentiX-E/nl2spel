import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
    testTimeout: 60000,
    env: {
      DEEPSEEK_API_KEY: process.env.DEEPSEEK_API_KEY ?? '',
    },
  },
});
