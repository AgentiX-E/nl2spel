import { describe, it, expect, vi } from 'vitest';
import { SelfCorrectionLoop } from '../validation/self-correction-loop.js';
import { ValidationPipeline } from '../validation/validation-pipeline.js';
import { AutoFixer } from '../validation/auto-fixer.js';
import type { ContextSchema, LLMPrompt, LLMResponse } from '../index.js';

const TEST_SCHEMA: ContextSchema = {
  root: {
    name: 'order',
    type: 'Order',
    fields: {
      amount: { type: 'number', description: '订单金额' },
      status: { type: 'string', description: '订单状态' },
      paid: { type: 'boolean', description: '是否支付' },
    },
    methods: {},
  },
  variables: {},
  beans: {},
  types: {},
  functions: {},
};

const TEST_PROMPT: LLMPrompt = {
  system: 'Generate SpEL.',
  user: '金额大于1000',
  contextSchema: TEST_SCHEMA,
  examples: [],
};

function createSuccessfulResponse(text: string): LLMResponse {
  return {
    text,
    model: 'mock-model',
    usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
    latencyMs: 50,
    finishReason: 'stop',
    providerName: 'mock',
  };
}

describe('SelfCorrectionLoop', () => {
  // ===== Correct expressions pass without iterations =====
  it('should pass valid expression without correction', async () => {
    const loop = new SelfCorrectionLoop();
    const generateFn = vi.fn();

    const result = await loop.correct('#order.amount > 1000', TEST_SCHEMA, generateFn, TEST_PROMPT);

    expect(result.valid).toBe(true);
    expect(result.correctionAttempts).toBe(0);
    expect(generateFn).not.toHaveBeenCalled();
  });

  // ===== AutoFix corrects JS operators =====
  it('should auto-fix === without LLM correction', async () => {
    const loop = new SelfCorrectionLoop();
    const generateFn = vi.fn();

    const result = await loop.correct(
      '#order.amount === 1000',
      TEST_SCHEMA,
      generateFn,
      TEST_PROMPT,
    );

    expect(result.valid).toBe(true);
    expect(result.correctionAttempts).toBeLessThanOrEqual(1);
    expect(result.expression).not.toContain('===');
    // Should have been auto-fixed
    const autoFixCorrection = result.corrections.find(c => c.autoFixed);
    expect(autoFixCorrection).toBeDefined();
  });

  it('should auto-fix && without LLM correction', async () => {
    const loop = new SelfCorrectionLoop();
    const generateFn = vi.fn();

    const result = await loop.correct(
      '#order.amount > 100 && #order.paid == true',
      TEST_SCHEMA,
      generateFn,
      TEST_PROMPT,
    );

    expect(result.valid).toBe(true);
    expect(result.expression).not.toContain('&&');
  });

  // ===== LLM correction flow =====
  it('should call LLM when auto-fix is insufficient', async () => {
    const loop = new SelfCorrectionLoop({ maxAttempts: 2, enableAutoFix: false });
    const generateFn = vi
      .fn()
      .mockResolvedValueOnce(createSuccessfulResponse('#order.amount > 1000'));

    const result = await loop.correct('#invalid syntax [[[', TEST_SCHEMA, generateFn, TEST_PROMPT);

    expect(generateFn).toHaveBeenCalledTimes(1);
    expect(result.valid).toBe(true);
    expect(result.correctionAttempts).toBe(1);
    expect(result.corrections.length).toBeGreaterThan(0);
  });

  it('should retry up to max attempts', async () => {
    const loop = new SelfCorrectionLoop({ maxAttempts: 3, enableAutoFix: false });
    const generateFn = vi
      .fn()
      .mockResolvedValueOnce(createSuccessfulResponse('#bad expression [[['))
      .mockResolvedValueOnce(createSuccessfulResponse('#still bad [[['))
      .mockResolvedValueOnce(createSuccessfulResponse('#order.amount > 1000'));

    const result = await loop.correct('#bad expression [[[', TEST_SCHEMA, generateFn, TEST_PROMPT);

    expect(generateFn).toHaveBeenCalledTimes(3);
    expect(result.valid).toBe(true);
    expect(result.correctionAttempts).toBe(3);
  });

  it('should report failed corrections', async () => {
    const loop = new SelfCorrectionLoop({ maxAttempts: 1, enableAutoFix: false });
    const generateFn = vi.fn().mockResolvedValueOnce(createSuccessfulResponse('#still bad [[['));

    const result = await loop.correct('#bad expression [[[', TEST_SCHEMA, generateFn, TEST_PROMPT);

    expect(result.valid).toBe(false);
    expect(result.correctionAttempts).toBe(1);
  });

  // ===== Configuration =====
  it('should respect maxAttempts config', async () => {
    const loop = new SelfCorrectionLoop({ maxAttempts: 1, enableAutoFix: false });
    const generateFn = vi.fn().mockResolvedValue(createSuccessfulResponse('#bad [[['));

    const result = await loop.correct('#bad [[[', TEST_SCHEMA, generateFn, TEST_PROMPT);

    expect(generateFn.mock.calls.length).toBeLessThanOrEqual(1);
  });

  it('should respect enableAutoFix config', async () => {
    const loop = new SelfCorrectionLoop({ enableAutoFix: false });
    const generateFn = vi
      .fn()
      .mockResolvedValueOnce(createSuccessfulResponse('#order.amount > 1000'));

    const result = await loop.correct(
      '#order.amount === 1000', // Would be auto-fixed normally
      TEST_SCHEMA,
      generateFn,
      TEST_PROMPT,
    );

    // With auto-fix disabled, the AutoFix check passes but still needs correction if invalid
    // But === IS detected by validation pipeline, so LLM should be called
    expect(result.valid).toBe(true);
  });

  // ===== Correction log tracking =====
  it('should include corrections log for each attempt', async () => {
    const loop = new SelfCorrectionLoop({ maxAttempts: 2, enableAutoFix: false });
    const generateFn = vi
      .fn()
      .mockResolvedValueOnce(createSuccessfulResponse('#bad [[['))
      .mockResolvedValueOnce(createSuccessfulResponse('#order.amount > 1000'));

    const result = await loop.correct('#bad [[[', TEST_SCHEMA, generateFn, TEST_PROMPT);

    expect(result.corrections.length).toBe(2);
    expect(result.corrections[0]!.attempt).toBe(1);
    // Expression gets auto-fixed (bracket fixing) after each LLM call
    expect(result.corrections[0]!.expression).toContain('#bad');
    expect(result.corrections[1]!.attempt).toBe(2);
    expect(result.corrections[1]!.expression).toContain('#order.amount');
  });

  it('should track total latency', async () => {
    const loop = new SelfCorrectionLoop({ enableAutoFix: false });
    const generateFn = vi
      .fn()
      .mockResolvedValueOnce(createSuccessfulResponse('#order.amount > 1000'));

    const result = await loop.correct('#bad [[[', TEST_SCHEMA, generateFn, TEST_PROMPT);

    expect(result.totalLatencyMs).toBeGreaterThanOrEqual(0);
  });

  // ===== Additional Coverage Tests =====
  describe('Additional Coverage', () => {
    it('correct expression passes immediately without any correction', async () => {
      const loop = new SelfCorrectionLoop();
      const generateFn = vi.fn();

      const result = await loop.correct(
        '#order.paid == true',
        TEST_SCHEMA,
        generateFn,
        TEST_PROMPT,
      );

      expect(result.valid).toBe(true);
      expect(result.correctionAttempts).toBe(0);
      expect(result.corrections).toHaveLength(0);
      expect(generateFn).not.toHaveBeenCalled();
    });

    it('expression that becomes valid after AutoFix only (no LLM needed)', async () => {
      const loop = new SelfCorrectionLoop();
      const generateFn = vi.fn();

      const result = await loop.correct(
        '#order.amount === 1000',
        TEST_SCHEMA,
        generateFn,
        TEST_PROMPT,
      );

      expect(result.valid).toBe(true);
      expect(result.correctionAttempts).toBeLessThanOrEqual(1);
      expect(result.expression).not.toContain('===');
      expect(result.expression).toContain('==');
      expect(generateFn).not.toHaveBeenCalled();
      // Auto-fix correction log should exist
      const autoFixEntry = result.corrections.find(c => c.autoFixed);
      expect(autoFixEntry).toBeDefined();
      expect(autoFixEntry!.autoFixChanges.some(c => c.includes('==='))).toBe(true);
    });

    it('expression needing exactly 2 correction attempts', async () => {
      const loop = new SelfCorrectionLoop({ maxAttempts: 2, enableAutoFix: false });
      const generateFn = vi
        .fn()
        .mockResolvedValueOnce(createSuccessfulResponse('#bad [[['))
        .mockResolvedValueOnce(createSuccessfulResponse('#order.amount > 1000'));

      const result = await loop.correct('#bad [[[', TEST_SCHEMA, generateFn, TEST_PROMPT);

      expect(result.valid).toBe(true);
      expect(result.correctionAttempts).toBe(2);
      expect(generateFn).toHaveBeenCalledTimes(2);
      expect(result.corrections).toHaveLength(2);
      expect(result.corrections[0]!.attempt).toBe(1);
      expect(result.corrections[1]!.attempt).toBe(2);
    });

    it('maxAttempts=0 should return immediately with valid=false', async () => {
      const loop = new SelfCorrectionLoop({ maxAttempts: 0, enableAutoFix: false });
      const generateFn = vi.fn();

      const result = await loop.correct('#invalid [[[', TEST_SCHEMA, generateFn, TEST_PROMPT);

      expect(result.valid).toBe(false);
      expect(result.correctionAttempts).toBe(0);
      expect(generateFn).not.toHaveBeenCalled();
    });

    it('LLM throws during correction (error handling)', async () => {
      const loop = new SelfCorrectionLoop({ maxAttempts: 2, enableAutoFix: false });
      const generateFn = vi.fn().mockRejectedValue(new Error('LLM service unavailable'));

      const result = await loop.correct('#bad [[[', TEST_SCHEMA, generateFn, TEST_PROMPT);

      expect(result.valid).toBe(false);
      expect(result.correctionAttempts).toBe(2);
      expect(generateFn).toHaveBeenCalledTimes(2);
      // Correction log entries should record the failure
      expect(result.corrections.every(c => !c.valid)).toBe(true);
      for (const entry of result.corrections) {
        expect(entry.errorCount).toBe(1);
      }
    });

    it('double auto-fix with quote fix', async () => {
      const loop = new SelfCorrectionLoop();
      const generateFn = vi.fn();

      const result = await loop.correct(
        '#order.status === "pending',
        TEST_SCHEMA,
        generateFn,
        TEST_PROMPT,
      );

      expect(result.valid).toBe(true);
      expect(result.expression).not.toContain('===');
      expect(generateFn).not.toHaveBeenCalled();

      // Should have a correction log entry for the auto-fix
      expect(result.corrections.length).toBeGreaterThanOrEqual(1);
      const autoFixEntry = result.corrections.find(c => c.autoFixed);
      expect(autoFixEntry).toBeDefined();
      // Auto-fix should include both === fix and double-quote fix
      expect(autoFixEntry!.autoFixChanges.some(c => c.includes('==='))).toBe(true);
      expect(autoFixEntry!.autoFixChanges.some(c => c.includes('quote'))).toBe(true);
    });

    it('verify correction log entry format and content', async () => {
      const loop = new SelfCorrectionLoop({ maxAttempts: 1, enableAutoFix: false });
      const generateFn = vi
        .fn()
        .mockResolvedValueOnce(createSuccessfulResponse('#order.amount > 1000'));

      const result = await loop.correct('#bad [[[', TEST_SCHEMA, generateFn, TEST_PROMPT);

      expect(result.corrections.length).toBeGreaterThan(0);

      for (const entry of result.corrections) {
        // Verify all required fields are present with correct types
        expect(entry).toHaveProperty('attempt');
        expect(entry).toHaveProperty('expression');
        expect(entry).toHaveProperty('valid');
        expect(entry).toHaveProperty('errorCount');
        expect(entry).toHaveProperty('warningCount');
        expect(entry).toHaveProperty('autoFixed');
        expect(entry).toHaveProperty('autoFixChanges');

        expect(typeof entry.attempt).toBe('number');
        expect(typeof entry.expression).toBe('string');
        expect(typeof entry.valid).toBe('boolean');
        expect(typeof entry.errorCount).toBe('number');
        expect(typeof entry.warningCount).toBe('number');
        expect(typeof entry.autoFixed).toBe('boolean');
        expect(Array.isArray(entry.autoFixChanges)).toBe(true);

        // attempt should be a positive integer (1-based for LLM corrections)
        expect(entry.attempt).toBeGreaterThan(0);
      }
    });

    it('should apply auto-fix after LLM correction inside the loop', async () => {
      // enableAutoFix: true (default), LLM returns expression with === that auto-fix can handle
      const loop = new SelfCorrectionLoop({ maxAttempts: 2 });
      const generateFn = vi
        .fn()
        .mockResolvedValueOnce(createSuccessfulResponse('#order.amount === 1000'));

      const result = await loop.correct('#invalid [[[', TEST_SCHEMA, generateFn, TEST_PROMPT);

      // Auto-fix at line 169 should fix ===
      expect(result.valid).toBe(true);
      expect(result.expression).not.toContain('===');
    });
  });
});
