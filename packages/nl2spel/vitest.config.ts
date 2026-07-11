import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.spec.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'json-summary', 'html'],
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.test.ts',
        'src/**/*.spec.ts',
        'src/__tests__/**',
        // Types-only files (no executable code)
        'src/SpelEvaluator.ts',
        'src/index.ts',
        'src/provider/llm-provider.ts',
        'src/pattern/pattern-definition.ts',
        // Vendored/auto-generated
        'src/strategy/strategies/**',
      ],
    },
  },
});
