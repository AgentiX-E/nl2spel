import { describe, it, expect } from 'vitest';
import { ValidationPipeline } from '../validation/validation-pipeline.js';
import type { ContextSchema, SpelEvaluator, ParseResult } from '../SpelEvaluator.js';

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
    functions: {},
  };
}

class MockEvaluator implements SpelEvaluator {
  private validExpressions: Set<string>;

  constructor(validExpressions: string[] = []) {
    this.validExpressions = new Set(validExpressions);
  }

  async parse(expression: string): Promise<ParseResult> {
    if (this.validExpressions.has(expression)) {
      return { valid: true, errors: [] };
    }
    return {
      valid: false,
      errors: [
        {
          message: `Syntax error in: ${expression}`,
          position: 0,
          code: 'SYNTAX',
        },
      ],
    };
  }

  getContextSchema(): ContextSchema | null {
    return createSchema();
  }
}

describe('ValidationPipeline', () => {
  const pipeline = new ValidationPipeline();
  const schema = createSchema();

  // ===== VL-G07: Parse Check =====
  describe('VL-G07: Parse Check', () => {
    it('should pass valid expressions', async () => {
      const result = await pipeline.validate('#order.amount > 1000', schema);
      expect(result.stages.parse.passed).toBe(true);
    });

    it('should fail empty expression', async () => {
      const result = await pipeline.validate('', schema);
      expect(result.stages.parse.passed).toBe(false);
      expect(result.errors.some(e => e.code === 'PARSE-EMPTY')).toBe(true);
    });

    it('should detect JS === operator', async () => {
      const result = await pipeline.validate('#order.amount === 1000', schema);
      expect(result.errors.some(e => e.code === 'PARSE-JS_OPERATOR')).toBe(true);
    });

    it('should detect JS !== operator', async () => {
      const result = await pipeline.validate("#order.status !== 'done'", schema);
      expect(result.errors.some(e => e.code === 'PARSE-JS_OPERATOR')).toBe(true);
    });

    it('should detect JS && operator', async () => {
      const result = await pipeline.validate('#order.amount > 100 && #order.paid', schema);
      expect(result.errors.some(e => e.code === 'PARSE-JS_LOGIC')).toBe(true);
    });

    it('should detect JS || operator', async () => {
      const result = await pipeline.validate('#order.vip || #order.admin', schema);
      expect(result.errors.some(e => e.code === 'PARSE-JS_LOGIC')).toBe(true);
    });

    it('should detect unbalanced parentheses', async () => {
      const result = await pipeline.validate('(#order.amount > 100', schema);
      expect(result.errors.some(e => e.code === 'PARSE-UNBALANCED_PARENS')).toBe(true);
    });

    it('should pass balanced complex expressions', async () => {
      const result = await pipeline.validate(
        "(#order.amount > 100) and (#order.status == 'done')",
        schema,
      );
      expect(result.stages.parse.passed).toBe(true);
    });

    it('should pass balanced brackets', async () => {
      const result = await pipeline.validate('#order.items.?[#this.amount > 100]', schema);
      expect(result.stages.parse.passed).toBe(true);
    });
  });

  // ===== VL-G08: Type Check =====
  describe('VL-G08: Type Check', () => {
    it('should pass valid type operations', async () => {
      const result = await pipeline.validate('#order.amount > 100', schema);
      expect(result.stages.type.passed).toBe(true);
    });

    it('should warn on string-number comparison', async () => {
      const result = await pipeline.validate("'hello' > 100", schema);
      expect(result.stages.type.warnings.length).toBeGreaterThan(0);
    });

    it('should warn on boolean-number comparison', async () => {
      const result = await pipeline.validate('#order.paid > 5', schema);
      expect(result.stages.type.warnings.length).toBeGreaterThan(0);
    });
  });

  // ===== VL-G09: Semantic Check =====
  describe('VL-G09: Semantic Check', () => {
    it('should pass semantically valid expressions', async () => {
      const result = await pipeline.validate('#order.amount > 100', schema);
      expect(result.stages.semantic.passed).toBe(true);
    });

    it('should warn on self-comparison', async () => {
      const result = await pipeline.validate('#order.amount == #order.amount', schema);
      expect(result.stages.semantic.warnings.length).toBeGreaterThan(0);
    });

    it('should warn on double negation', async () => {
      const result = await pipeline.validate('!!#order.paid', schema);
      expect(result.stages.semantic.warnings.length).toBeGreaterThan(0);
    });

    it('should pass valid negation', async () => {
      const result = await pipeline.validate('!#order.paid', schema);
      expect(result.stages.semantic.passed).toBe(true);
    });
  });

  // ===== VL-G10: Context Check =====
  describe('VL-G10: Context Check', () => {
    it('should pass context-valid expressions', async () => {
      const result = await pipeline.validate('#order.amount > 100', schema);
      expect(result.stages.context.passed).toBe(true);
    });

    it('should warn on unknown field', async () => {
      const result = await pipeline.validate('#order.unknown > 100', schema);
      expect(result.stages.context.warnings.length).toBeGreaterThan(0);
    });

    it('should warn on unknown bean reference', async () => {
      const result = await pipeline.validate('@unknownService', schema);
      expect(result.stages.context.warnings.length).toBeGreaterThan(0);
    });

    it('should warn without ContextSchema', async () => {
      const result = await pipeline.validate('#order.amount > 100');
      expect(result.stages.context.warnings.some(w => w.code === 'CTX-NO_SCHEMA')).toBe(true);
    });

    it('should pass known bean reference', async () => {
      // @discountService is in the schema
      const result = await pipeline.validate('@discountService', schema);
      expect(result.valid).toBe(true);
    });

    it('should detect unknown variable', async () => {
      const result = await pipeline.validate('#unknown > 100', schema);
      expect(result.stages.context.warnings.length).toBeGreaterThan(0);
    });
  });

  // ===== VL-G11: Full Validation Flow =====
  describe('VL-G11: Full Validation Flow', () => {
    it('should validate a correct expression fully', async () => {
      const result = await pipeline.validate(
        "#order.amount > 1000 and #order.tags.contains('VIP')",
        schema,
      );
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should collect all errors from all stages', async () => {
      const result = await pipeline.validate(
        '#order.amount === 1000 && #order.unknown > 100',
        schema,
      );
      expect(result.errors.length).toBeGreaterThan(1);
      expect(result.valid).toBe(false);
    });

    it('should mark errors as requiring LLM re-generation', async () => {
      const result = await pipeline.validate('#order.amount === 1000', schema);
      const parseErrors = result.errors.filter(e => e.stage === 'parse');
      expect(parseErrors.some(e => e.requiresLLM)).toBe(true);
    });
  });

  // ===== VL-G12: Custom Evaluator =====
  describe('VL-G12: Custom SpelEvaluator', () => {
    it('should use provided evaluator for parse validation', async () => {
      const evaluator = new MockEvaluator(['#order.amount > 1000']);
      const pipeline = new ValidationPipeline(evaluator);
      const result = await pipeline.validate('#order.amount > 1000', schema);
      expect(result.stages.parse.passed).toBe(true);
    });

    it('should report parse errors from evaluator', async () => {
      const evaluator = new MockEvaluator();
      const pipeline = new ValidationPipeline(evaluator);
      const result = await pipeline.validate('#invalid expression!', schema);
      expect(result.stages.parse.passed).toBe(false);
      expect(result.stages.parse.errors.length).toBeGreaterThan(0);
    });

    it('should set evaluator after construction', async () => {
      const pipeline = new ValidationPipeline();
      pipeline.setEvaluator(new MockEvaluator(['#order.amount > 1000']));
      const result = await pipeline.validate('#order.amount > 1000', schema);
      expect(result.stages.parse.passed).toBe(true);
    });
  });
});
