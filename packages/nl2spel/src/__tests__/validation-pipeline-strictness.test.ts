import { describe, it, expect } from 'vitest';
import { ValidationPipeline } from '../validation/validation-pipeline.js';
import type { ContextSchema, ParseResult, SpelEvaluator } from '@agentix-e/spel-ts';

/**
 * Strictness suite for the validation pipeline (D18).
 *
 * The pipeline's type, semantic and context stages used to push only warnings,
 * while `valid` was computed from `errors` alone — so nothing but a parse
 * failure could ever reject an expression. These tests pin the opposite
 * contract: every rejection case below must make `valid === false`, while a
 * well-formed corpus and the advisory observations must stay valid.
 */

function createSchema(): ContextSchema {
  return {
    root: {
      name: 'order',
      type: 'Order',
      fields: {
        amount: { type: 'number', description: '订单金额' },
        status: { type: 'string', description: '订单状态' },
        remark: { type: 'string', description: '备注' },
        paid: { type: 'boolean', description: '是否支付' },
        items: { type: 'array', isCollection: true, elementType: 'object' },
        tags: { type: 'array', isCollection: true, elementType: 'string' },
      },
      methods: {},
    },
    variables: { user: { type: 'object' } },
    beans: { discountService: { type: 'DiscountService' } },
    types: { Admin: { className: 'com.example.Admin' } },
    functions: {
      calculateDiscount: { returnType: 'number', params: [{ name: 'price', type: 'number' }] },
    },
  };
}

/** An evaluator that accepts only the expressions it was given. */
class MockEvaluator implements SpelEvaluator {
  private readonly validExpressions: Set<string>;

  constructor(validExpressions: string[] = []) {
    this.validExpressions = new Set(validExpressions);
  }

  async parse(expression: string): Promise<ParseResult> {
    if (this.validExpressions.has(expression)) {
      return { valid: true, errors: [] };
    }
    return {
      valid: false,
      errors: [{ message: `Syntax error in: ${expression}`, position: 0, code: 'SYNTAX' }],
    };
  }

  getContextSchema(): ContextSchema | null {
    return createSchema();
  }
}

const hasCode = (result: { errors: Array<{ code: string }> }, code: string): boolean =>
  result.errors.some((e) => e.code === code);

describe('ValidationPipeline strictness (D18)', () => {
  const pipeline = new ValidationPipeline();
  const schema = createSchema();

  // ===== Well-formed corpus stays valid =====
  describe('well-formed corpus passes', () => {
    const wellFormed = [
      '#order.amount > 1000',
      '#amount > 1000',
      "#order.amount > 100 and #order.status == 'active'",
      '#order.remark == null',
      "#order.status != 'cancelled'",
      '#order.items.?[#this.amount > 100]',
      '#order.items.^[#this.amount > 1000]',
      "#order.tags.contains('VIP')",
      '#order.amount between {18, 60}',
      '#user.name',
      '#calculateDiscount(100)',
      '@discountService',
      'T(java.lang.Math).abs(-1)',
      "#currentUser.role == 'admin'",
      '#order.items[0]',
    ];

    for (const expression of wellFormed) {
      it(`accepts ${expression}`, async () => {
        const result = await pipeline.validate(expression, schema);
        expect(result.errors).toHaveLength(0);
        expect(result.valid).toBe(true);
      });
    }

    it('exposes all five stage results', async () => {
      const result = await pipeline.validate('#order.amount > 1000', schema);
      expect(result.stages.parse.passed).toBe(true);
      expect(result.stages.type.passed).toBe(true);
      expect(result.stages.semantic.passed).toBe(true);
      expect(result.stages.context.passed).toBe(true);
      expect(result.stages.final.passed).toBe(true);
    });
  });

  // ===== Parse stage rejections =====
  describe('parse stage rejects', () => {
    it('rejects an empty expression', async () => {
      const result = await pipeline.validate('', schema);
      expect(result.valid).toBe(false);
      expect(hasCode(result, 'PARSE-EMPTY')).toBe(true);
    });

    it('rejects a whitespace-only expression', async () => {
      const result = await pipeline.validate('   ', schema);
      expect(result.valid).toBe(false);
      expect(hasCode(result, 'PARSE-EMPTY')).toBe(true);
    });

    it('rejects unbalanced parentheses', async () => {
      const result = await pipeline.validate('(#order.amount > 100', schema);
      expect(result.valid).toBe(false);
      expect(hasCode(result, 'PARSE-UNBALANCED_PARENS')).toBe(true);
    });

    it('rejects the JavaScript === operator', async () => {
      const result = await pipeline.validate('#order.amount === 1000', schema);
      expect(result.valid).toBe(false);
      expect(hasCode(result, 'PARSE-JS_OPERATOR')).toBe(true);
    });

    it('rejects the JavaScript !== operator', async () => {
      const result = await pipeline.validate("#order.status !== 'done'", schema);
      expect(result.valid).toBe(false);
      expect(hasCode(result, 'PARSE-JS_OPERATOR')).toBe(true);
    });

    it('rejects the JavaScript && operator', async () => {
      const result = await pipeline.validate('#order.amount > 100 && #order.paid', schema);
      expect(result.valid).toBe(false);
      expect(hasCode(result, 'PARSE-JS_LOGIC')).toBe(true);
    });

    it('rejects the JavaScript || operator', async () => {
      const result = await pipeline.validate('#order.status == done || #order.paid', schema);
      expect(result.valid).toBe(false);
      expect(hasCode(result, 'PARSE-JS_LOGIC')).toBe(true);
    });

    it('does not read brackets or operators from inside a string literal', async () => {
      // The unbalanced `(` and the `&&` are literal text, not syntax.
      const result = await pipeline.validate("#re matches '\\d+(' and #x == 'A && B'");
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  // ===== Evaluator-driven parse rejection =====
  describe('evaluator-driven parse rejection', () => {
    it('rejects an expression the evaluator cannot parse', async () => {
      const evaluator = new MockEvaluator();
      const strictPipeline = new ValidationPipeline(evaluator);
      const result = await strictPipeline.validate('#order.amount > 1000', schema);
      expect(result.valid).toBe(false);
      expect(hasCode(result, 'PARSE-SYNTAX')).toBe(true);
    });

    it('accepts an expression the evaluator parses', async () => {
      const evaluator = new MockEvaluator(['#order.amount > 1000']);
      const strictPipeline = new ValidationPipeline(evaluator);
      const result = await strictPipeline.validate('#order.amount > 1000', schema);
      expect(result.valid).toBe(true);
    });
  });

  // ===== Context stage rejections (schema supplied) =====
  describe('context stage rejects when a schema is supplied', () => {
    it('rejects a field that is absent from the root', async () => {
      const result = await pipeline.validate('#order.unknown > 100', schema);
      expect(result.valid).toBe(false);
      expect(hasCode(result, 'CTX-UNKNOWN_FIELD')).toBe(true);
    });

    it('rejects an undeclared variable', async () => {
      const result = await pipeline.validate('#unknownRef > 100', schema);
      expect(result.valid).toBe(false);
      expect(hasCode(result, 'CTX-UNKNOWN_REF')).toBe(true);
    });

    it('rejects an undeclared bean', async () => {
      const result = await pipeline.validate('@unknownService', schema);
      expect(result.valid).toBe(false);
      expect(hasCode(result, 'CTX-UNKNOWN_BEAN')).toBe(true);
    });

    it('does not judge references when no schema is supplied', async () => {
      const result = await pipeline.validate('#unknownRef > 1000');
      expect(result.valid).toBe(true);
      expect(hasCode(result, 'CTX-NO_SCHEMA')).toBe(false);
      expect(result.warnings.some((w) => w.code === 'CTX-NO_SCHEMA')).toBe(true);
    });

    it('does not treat a reference inside a literal as a reference', async () => {
      const result = await pipeline.validate("#order.status == '#unknownRef'", schema);
      expect(result.valid).toBe(true);
      expect(result.stages.context.errors).toHaveLength(0);
    });
  });

  // ===== Final stage: the expression must parse =====
  describe('final stage rejects a manifestly incomplete expression', () => {
    const truncated = [
      '#order.amount >',
      '#order.amount > 1000 and',
      '#order.amount > 1000 or',
      '#order.status ==',
      '#order.amount > 1000 and #order.status ==',
      '#order.amount +',
      '#order.status and',
    ];

    for (const expression of truncated) {
      it(`rejects ${expression}`, async () => {
        const result = await pipeline.validate(expression);
        expect(result.valid).toBe(false);
        expect(hasCode(result, 'FINAL-TRUNCATED')).toBe(true);
      });
    }

    it('reports the final stage as failed', async () => {
      const result = await pipeline.validate('#order.amount > 1000 and');
      expect(result.stages.final.passed).toBe(false);
      expect(result.stages.final.errors[0]!.requiresLLM).toBe(true);
    });

    it('accepts an expression that ends with a complete operand', async () => {
      const result = await pipeline.validate("#order.status == 'done'");
      expect(result.stages.final.passed).toBe(true);
      expect(result.valid).toBe(true);
    });

    it('accepts a literal whose content ends with an operator character', async () => {
      const result = await pipeline.validate("#order.status == 'done >'");
      expect(result.stages.final.passed).toBe(true);
      expect(result.valid).toBe(true);
    });
  });

  // ===== Advisory observations never flip valid =====
  describe('advisory observations stay warnings', () => {
    it('string compared numerically', async () => {
      const result = await pipeline.validate("#order.amount > 'abc'", schema);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.warnings.some((w) => w.code === 'TYPE-STR_NUM_CMP')).toBe(true);
    });

    it('tautology', async () => {
      const result = await pipeline.validate('#order.amount == #order.amount', schema);
      expect(result.valid).toBe(true);
      expect(result.warnings.some((w) => w.code === 'SEM-SELF_COMPARE')).toBe(true);
    });

    it('double negation', async () => {
      const result = await pipeline.validate('!!#order.paid', schema);
      expect(result.valid).toBe(true);
      expect(result.warnings.some((w) => w.code === 'SEM-DOUBLE_NEGATION')).toBe(true);
    });

    it('keeps advisory codes out of the error list', async () => {
      const result = await pipeline.validate(
        "'hello' > 100 and #order.paid == #order.paid",
        schema,
      );
      expect(result.valid).toBe(true);
      const codes = result.errors.map((e) => e.code);
      expect(codes).not.toContain('TYPE-STR_NUM_CMP');
      expect(codes).not.toContain('SEM-SELF_COMPARE');
    });
  });

  // ===== Backward-compatible result shape =====
  describe('result shape', () => {
    it('tags every error with a severity, stage and code', async () => {
      const result = await pipeline.validate('#unknownRef > 100', schema);
      expect(result.errors.length).toBeGreaterThan(0);
      for (const error of result.errors) {
        expect(error.code).toBeTruthy();
        expect(error.message).toBeTruthy();
        expect(error.stage).toBeTruthy();
        expect(error.severity).toBe('error');
      }
    });

    it('keeps the original four stage keys alongside the new final stage', async () => {
      const result = await pipeline.validate('#order.amount > 1000', schema);
      const keys = Object.keys(result.stages).sort();
      expect(keys).toEqual(['context', 'final', 'parse', 'semantic', 'type']);
    });

    it('still records warnings separately from errors', async () => {
      const result = await pipeline.validate('!!#order.paid', schema);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.warnings.length).toBeGreaterThan(0);
    });
  });
});
