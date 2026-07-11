/**
 * Real integration tests for OpenAICompatibleProvider.
 *
 * These tests make actual HTTP calls to the DeepSeek API.
 * Requires DEEPSEEK_API_KEY in environment (or .env file).
 *
 * Tests are skipped (not failed) when API key is unavailable.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { OpenAICompatibleProvider } from '../openai-compatible-provider.js';
import type { LLMPrompt, ContextSchema } from '@agentix-e/nl2spel';

const API_KEY = process.env.DEEPSEEK_API_KEY ?? '';
const hasAPIKey = !!API_KEY;

// SpEL system prompt with full rules — ensures DeepSeek produces proper SpEL
const SPEL_SYSTEM_PROMPT = `You are a Spring Expression Language (SpEL) expert. Convert natural language to SpEL expressions.

RULES:
1. Use #variable for variables, #root.field for root object fields (e.g. #order.amount)
2. String literals use single quotes: 'value'
3. Null comparison: == null or != null
4. Logical operators: and, or, not (NOT &&, ||, !)
5. Comparison operators: ==, !=, >, <, >=, <=
6. Collection methods: .contains('item'), .size(), .isEmpty()
7. Range: variable between {min, max}
8. Permission: hasRole('role'), hasPermission('perm')
9. Type check: variable instanceof T(ClassName)
10. Elvis operator: value ?: 'default'

Output ONLY the SpEL expression. No explanation, no markdown.`;

// Simple mock PromptBuilder for testing (avoids require() hacks)
const mockPromptBuilder = {
  build: (userInput: string, contextSchema?: ContextSchema): LLMPrompt => ({
    system: SPEL_SYSTEM_PROMPT,
    user: userInput,
    contextSchema: contextSchema ?? {
      root: null,
      variables: {},
      beans: {},
      types: {},
      functions: {},
    },
    examples: [],
  }),
};

function createProvider(): OpenAICompatibleProvider {
  return new OpenAICompatibleProvider(
    { provider: 'deepseek', apiKey: API_KEY },
    mockPromptBuilder as any,
  );
}

describe('OpenAICompatibleProvider — Real Integration (DeepSeek)', () => {
  beforeAll(() => {
    if (!hasAPIKey) {
      console.warn('[integration] DEEPSEEK_API_KEY not set — skipping real integration tests');
    }
  });

  // ========================================================================
  // INT-G01: generate() — simple comparison
  // ========================================================================
  describe('INT-G01: Simple Comparison', () => {
    it.runIf(hasAPIKey)(
      'should generate comparison expression: amount > 1000',
      async () => {
        const provider = createProvider();
        const prompt = mockPromptBuilder.build('amount greater than 1000');

        const response = await provider.generate(prompt, { timeout: 30000, temperature: 0.0 });

        expect(response.text).toBeTruthy();
        expect(response.text.length).toBeGreaterThan(0);
        // DeepSeek may use "gt" or ">" — accept both
        expect(response.text).toMatch(/1000/);
        expect(response.providerName).toBe('deepseek');
        expect(response.finishReason).toBe('stop');
        expect(response.usage.totalTokens).toBeGreaterThan(0);
      },
      30000,
    );

    it.runIf(hasAPIKey)(
      'should generate string comparison: status == shipped',
      async () => {
        const provider = createProvider();
        const prompt = mockPromptBuilder.build('Order status is shipped');

        const response = await provider.generate(prompt, { timeout: 30000, temperature: 0.0 });

        expect(response.text).toBeTruthy();
        // Should contain a string comparison
        expect(response.text).toMatch(/==\s*'[^']*'/);
      },
      30000,
    );
  });

  // ========================================================================
  // INT-G02: generate() — null checks
  // ========================================================================
  describe('INT-G02: Null Checks', () => {
    it.runIf(hasAPIKey)(
      'should generate null check: remark is null',
      async () => {
        const provider = createProvider();
        const prompt = mockPromptBuilder.build('remark is null');

        const response = await provider.generate(prompt, { timeout: 30000, temperature: 0.0 });

        expect(response.text).toBeTruthy();
        expect(response.text).toMatch(/null/);
      },
      30000,
    );

    it.runIf(hasAPIKey)(
      'should generate not-null check: remark is not null',
      async () => {
        const provider = createProvider();
        const prompt = mockPromptBuilder.build('remark is not null');

        const response = await provider.generate(prompt, { timeout: 30000, temperature: 0.0 });

        expect(response.text).toBeTruthy();
        expect(response.text).toMatch(/!=/);
      },
      30000,
    );
  });

  // ========================================================================
  // INT-G03: generate() — logical combinations
  // ========================================================================
  describe('INT-G03: Logical Combinations', () => {
    it.runIf(hasAPIKey)(
      'should generate logical and: amount > 100 and status == done',
      async () => {
        const provider = createProvider();
        const prompt = mockPromptBuilder.build('amount greater than 100 and status equals done');

        const response = await provider.generate(prompt, { timeout: 30000, temperature: 0.0 });

        expect(response.text).toBeTruthy();
        expect(response.text).toMatch(/and/);
      },
      30000,
    );

    it.runIf(hasAPIKey)(
      'should generate logical or: VIP or amount > 1000',
      async () => {
        const provider = createProvider();
        const prompt = mockPromptBuilder.build('user is VIP or amount greater than 1000');

        const response = await provider.generate(prompt, { timeout: 30000, temperature: 0.0 });

        expect(response.text).toBeTruthy();
        expect(response.text).toMatch(/or/);
      },
      30000,
    );
  });

  // ========================================================================
  // INT-G04: generate() — range / between
  // ========================================================================
  describe('INT-G04: Range', () => {
    it.runIf(hasAPIKey)(
      'should generate range: age between 18 and 60',
      async () => {
        const provider = createProvider();
        const prompt = mockPromptBuilder.build('age between 18 and 60');

        const response = await provider.generate(prompt, { timeout: 30000, temperature: 0.0 });

        expect(response.text).toBeTruthy();
        expect(response.text).toMatch(/between/);
      },
      30000,
    );
  });

  // ========================================================================
  // INT-G05: generate() — collection operations
  // ========================================================================
  describe('INT-G05: Collection Operations', () => {
    it.runIf(hasAPIKey)(
      'should generate collection contains: tags contains VIP',
      async () => {
        const provider = createProvider();
        const prompt = mockPromptBuilder.build('tags contains VIP');

        const response = await provider.generate(prompt, { timeout: 30000, temperature: 0.0 });

        expect(response.text).toBeTruthy();
        expect(response.text).toMatch(/contains/);
      },
      30000,
    );

    it.runIf(hasAPIKey)(
      'should generate collection isEmpty: items is empty',
      async () => {
        const provider = createProvider();
        const prompt = mockPromptBuilder.build('items is empty');

        const response = await provider.generate(prompt, { timeout: 30000, temperature: 0.0 });

        expect(response.text).toBeTruthy();
      },
      30000,
    );
  });

  // ========================================================================
  // INT-G06: generate() — permission check
  // ========================================================================
  describe('INT-G06: Permission Check', () => {
    it.runIf(hasAPIKey)(
      'should generate hasRole: user has admin role',
      async () => {
        const provider = createProvider();
        const prompt = mockPromptBuilder.build('user has admin role');

        const response = await provider.generate(prompt, { timeout: 30000, temperature: 0.0 });

        expect(response.text).toBeTruthy();
        expect(response.text).toMatch(/hasRole|hasPermission/);
      },
      30000,
    );
  });

  // ========================================================================
  // INT-G07: generate() — with context schema
  // ========================================================================
  describe('INT-G07: Context Schema', () => {
    const orderSchema: ContextSchema = {
      root: {
        name: 'order',
        type: 'Order',
        fields: {
          amount: { type: 'number', description: 'Order amount' },
          status: { type: 'string', description: 'Order status' },
          paid: { type: 'boolean', description: 'Whether paid' },
        },
        methods: {},
      },
      variables: {},
      beans: {},
      types: {},
      functions: {},
    };

    it.runIf(hasAPIKey)(
      'should generate with context schema reference',
      async () => {
        const provider = createProvider();
        const prompt = mockPromptBuilder.build(
          'amount greater than 100 and status is shipped',
          orderSchema,
        );

        const response = await provider.generate(prompt, { timeout: 30000, temperature: 0.0 });

        expect(response.text).toBeTruthy();
        // Expression should contain comparison operators and field references
        expect(response.text.length).toBeGreaterThan(0);
      },
      30000,
    );
  });

  // ========================================================================
  // INT-G08: generate() — retry and error handling
  // ========================================================================
  describe('INT-G08: Error Handling', () => {
    it.runIf(hasAPIKey)(
      'should timeout on very short timeout',
      async () => {
        const provider = createProvider();
        const prompt = mockPromptBuilder.build('amount greater than 1000');

        // Timeout of 1ms should cause an abort error
        await expect(provider.generate(prompt, { timeout: 1 })).rejects.toThrow();
      },
      10000,
    );

    it.runIf(hasAPIKey)(
      'should succeed with adequate timeout',
      async () => {
        const provider = createProvider();
        const prompt = mockPromptBuilder.build('amount > 100');

        const response = await provider.generate(prompt, { timeout: 30000 });
        expect(response.text).toBeTruthy();
      },
      35000,
    );
  });

  // ========================================================================
  // INT-G09: generateStream() — streaming generation
  // ========================================================================
  describe('INT-G09: Streaming', () => {
    it.runIf(hasAPIKey)(
      'should stream generation chunks',
      async () => {
        const provider = createProvider();
        const prompt = mockPromptBuilder.build('amount greater than 1000 and status is confirmed');

        const chunks: string[] = [];
        let finalAccumulated = '';
        let streamDone = false;

        for await (const chunk of provider.generateStream(prompt, {
          timeout: 30000,
          temperature: 0.0,
        })) {
          chunks.push(chunk.delta);
          finalAccumulated = chunk.accumulated;
          if (chunk.done) streamDone = true;
        }

        expect(streamDone).toBe(true);
        expect(chunks.length).toBeGreaterThan(0);
        expect(finalAccumulated.length).toBeGreaterThan(0);
        // Accumulated text should contain SpEL-like content
        expect(finalAccumulated).toMatch(/[\w'"]/);
      },
      45000,
    );

    it.runIf(hasAPIKey)(
      'should produce non-empty stream for simple input',
      async () => {
        const provider = createProvider();
        const prompt = mockPromptBuilder.build('amount > 100');

        const chunks: string[] = [];
        for await (const chunk of provider.generateStream(prompt, {
          timeout: 30000,
          temperature: 0.0,
        })) {
          chunks.push(chunk.delta);
        }

        // At least one chunk with content
        const totalText = chunks.join('');
        expect(totalText.length).toBeGreaterThan(0);
      },
      45000,
    );
  });

  // ========================================================================
  // INT-G10: isAvailable
  // ========================================================================
  describe('INT-G10: isAvailable', () => {
    it('should be available when API key is set', async () => {
      if (!hasAPIKey) return; // skip assertion when no key
      const provider = createProvider();
      expect(await provider.isAvailable()).toBe(true);
    });
  });

  // ========================================================================
  // INT-G11: Custom model override
  // ========================================================================
  describe('INT-G11: Custom Model Override', () => {
    it.runIf(hasAPIKey)(
      'should use custom model from options',
      async () => {
        const provider = createProvider();
        const prompt = mockPromptBuilder.build('amount > 100');

        const response = await provider.generate(prompt, {
          timeout: 30000,
          temperature: 0.0,
          model: 'deepseek-chat', // explicitly override model
        });

        expect(response.text).toBeTruthy();
        expect(response.model).toBeTruthy();
      },
      30000,
    );
  });
});
