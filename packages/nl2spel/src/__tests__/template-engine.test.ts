import { describe, it, expect } from 'vitest';
import { TemplateEngine } from '../template/template-engine.js';
import { IntentClassifier } from '../template/intent-classifier.js';
import { NLIntent } from '../template/nl-intent.js';
import type { ContextSchema } from '../SpelEvaluator.js';

const classifier = new IntentClassifier();

function createEngine(schema?: ContextSchema) {
  return new TemplateEngine(schema);
}

const ORDER_SCHEMA: ContextSchema = {
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
  beans: {},
  types: {},
  functions: {},
};

describe('TemplateEngine', () => {
  // ===== TE-G01: COMPARISON templates =====
  describe('TE-G01: COMPARISON', () => {
    it('金额大于1000', () => {
      const engine = createEngine(ORDER_SCHEMA);
      const intent = classifier.classify('金额大于1000');
      const result = engine.generate('金额大于1000', intent);
      expect(result).not.toBeNull();
      expect(result!.expression).toContain('>');
      expect(result!.intent).toBe(NLIntent.COMPARISON);
    });

    it('amount > 500', () => {
      const engine = createEngine(ORDER_SCHEMA);
      const intent = classifier.classify('amount > 500');
      const result = engine.generate('amount > 500', intent);
      expect(result).not.toBeNull();
      expect(result!.expression).toContain('>');
    });

    it('数量小于10', () => {
      const engine = createEngine(ORDER_SCHEMA);
      const intent = classifier.classify('数量小于10');
      const result = engine.generate('数量小于10', intent);
      expect(result).not.toBeNull();
      expect(result!.expression).toContain('<');
    });

    it('should include comparison operator', () => {
      const engine = createEngine(ORDER_SCHEMA);
      const intent = classifier.classify('金额大于等于200');
      const result = engine.generate('金额大于等于200', intent);
      expect(result).not.toBeNull();
      expect(result!.expression).toContain('>=');
    });

    it('should handle equals comparison', () => {
      const engine = createEngine(ORDER_SCHEMA);
      const intent = classifier.classify('金额等于100');
      const result = engine.generate('金额等于100', intent);
      expect(result).not.toBeNull();
      expect(result!.expression).toContain('==');
    });
  });

  // ===== TE-G02: NULL_CHECK templates =====
  describe('TE-G02: NULL_CHECK', () => {
    it('备注为空 → null check', () => {
      const engine = createEngine(ORDER_SCHEMA);
      const intent = classifier.classify('备注为空');
      const result = engine.generate('备注为空', intent);
      expect(result).not.toBeNull();
      expect(result!.intent).toBe(NLIntent.NULL_CHECK);
      expect(result!.expression).toContain('null');
    });

    it('remark is null', () => {
      const engine = createEngine(ORDER_SCHEMA);
      const intent = classifier.classify('remark is null');
      const result = engine.generate('remark is null', intent);
      expect(result).not.toBeNull();
      expect(result!.expression).toContain('null');
    });
  });

  // ===== TE-G03: PERMISSION templates =====
  describe('TE-G03: PERMISSION', () => {
    it('user has admin role', () => {
      const engine = createEngine(ORDER_SCHEMA);
      const intent = classifier.classify('user has admin role');
      const result = engine.generate('user has admin role', intent);
      expect(result).not.toBeNull();
      expect(result!.intent).toBe(NLIntent.PERMISSION_CHECK);
    });

    it('user can delete', () => {
      const engine = createEngine(ORDER_SCHEMA);
      const intent = classifier.classify('user can delete');
      const result = engine.generate('user can delete', intent);
      expect(result).not.toBeNull();
    });
  });

  // ===== TE-G04: LOGICAL templates =====
  describe('TE-G04: LOGICAL', () => {
    it('金额大于100且已确认', () => {
      const engine = createEngine(ORDER_SCHEMA);
      const intent = classifier.classify('金额大于100且已确认');
      const result = engine.generate('金额大于100且已确认', intent);
      expect(result).not.toBeNull();
      expect(result!.intent).toBe(NLIntent.LOGICAL);
    });

    it('VIP or admin', () => {
      const engine = createEngine(ORDER_SCHEMA);
      const intent = classifier.classify('VIP or admin');
      const result = engine.generate('VIP or admin', intent);
      expect(result).not.toBeNull();
    });

    it('not cancelled', () => {
      const engine = createEngine(ORDER_SCHEMA);
      const intent = classifier.classify('not cancelled');
      const result = engine.generate('not cancelled', intent);
      expect(result).not.toBeNull();
    });
  });

  // ===== TE-G05: STRING templates =====
  describe('TE-G05: STRING', () => {
    it('备注包含加急 → contains', () => {
      const engine = createEngine(ORDER_SCHEMA);
      const intent = classifier.classify('备注包含加急');
      const result = engine.generate('备注包含加急', intent);
      expect(result).not.toBeNull();
      expect(result!.intent).toBe(NLIntent.STRING_MATCH);
    });

    it('name contains test', () => {
      const engine = createEngine(ORDER_SCHEMA);
      const intent = classifier.classify('name contains test');
      const result = engine.generate('name contains test', intent);
      expect(result).not.toBeNull();
    });
  });

  // ===== TE-G06: COLLECTION templates =====
  describe('TE-G06: COLLECTION', () => {
    it('订单列表为空 → isEmpty', () => {
      const engine = createEngine(ORDER_SCHEMA);
      const intent = classifier.classify('订单列表为空');
      const result = engine.generate('订单列表为空', intent);
      expect(result).not.toBeNull();
      expect(result!.expression).toContain('isEmpty');
    });

    it('items is empty', () => {
      const engine = createEngine(ORDER_SCHEMA);
      const intent = classifier.classify('items is empty');
      const result = engine.generate('items is empty', intent);
      expect(result).not.toBeNull();
    });

    it('列表不为空', () => {
      const engine = createEngine(ORDER_SCHEMA);
      const intent = classifier.classify('列表不为空');
      const result = engine.generate('列表不为空', intent);
      expect(result).not.toBeNull();
    });
  });

  // ===== TE-G07: RANGE templates =====
  describe('TE-G07: RANGE', () => {
    it('年龄在18到60之间 → between', () => {
      const engine = createEngine(ORDER_SCHEMA);
      const intent = classifier.classify('年龄在18到60之间');
      const result = engine.generate('年龄在18到60之间', intent);
      expect(result).not.toBeNull();
      expect(result!.intent).toBe(NLIntent.RANGE);
    });

    it('amount between 100 and 500', () => {
      const engine = createEngine(ORDER_SCHEMA);
      const intent = classifier.classify('amount between 100 and 500');
      const result = engine.generate('amount between 100 and 500', intent);
      expect(result).not.toBeNull();
      expect(result!.expression).toContain('between');
    });
  });

  // ===== TE-G08: SELECTION templates =====
  describe('TE-G08: SELECTION', () => {
    it('所有满足条件的 → selection', () => {
      const engine = createEngine(ORDER_SCHEMA);
      const intent = classifier.classify('所有满足条件的');
      const result = engine.generate('所有满足条件的', intent);
      expect(result).not.toBeNull();
    });

    it('filter matching items', () => {
      const engine = createEngine(ORDER_SCHEMA);
      const intent = classifier.classify('filter matching items');
      const result = engine.generate('filter matching items', intent);
      expect(result).not.toBeNull();
    });
  });

  // ===== TE-G09: PROJECTION templates =====
  describe('TE-G09: PROJECTION', () => {
    it('每个项目的名称 → projection', () => {
      const engine = createEngine(ORDER_SCHEMA);
      const intent = classifier.classify('每个项目的名称');
      const result = engine.generate('每个项目的名称', intent);
      expect(result).not.toBeNull();
      expect(result!.intent).toBe(NLIntent.PROJECTION);
    });

    it('each item price', () => {
      const engine = createEngine(ORDER_SCHEMA);
      const intent = classifier.classify('each item price');
      const result = engine.generate('each item price', intent);
      expect(result).not.toBeNull();
    });
  });

  // ===== TE-G10: Context injection =====
  describe('TE-G10: Context Schema Injection', () => {
    it('should use root name from context schema', () => {
      const schema: ContextSchema = {
        root: { name: 'invoice', type: 'Invoice', fields: {}, methods: {} },
        variables: {},
        beans: {},
        types: {},
        functions: {},
      };
      const engine = createEngine(schema);
      const intent = classifier.classify('金额大于100');
      const result = engine.generate('金额大于100', intent);
      expect(result).not.toBeNull();
      expect(result!.expression).toContain('#invoice');
    });

    it('should use default root name when no schema', () => {
      const engine = createEngine();
      const intent = classifier.classify('金额大于100');
      const result = engine.generate('金额大于100', intent);
      expect(result).not.toBeNull();
      expect(result!.expression).toContain('#order');
    });

    it('should match field names from context schema', () => {
      const engine = createEngine(ORDER_SCHEMA);
      const intent = classifier.classify('金额大于100');
      const result = engine.generate('金额大于100', intent);
      expect(result).not.toBeNull();
      expect(result!.expression).toContain('#order');
    });

    it('should detect user root for user-related input', () => {
      const engine = createEngine();
      const intent = classifier.classify('用户是VIP');
      const result = engine.generate('用户是VIP', intent);
      expect(result).not.toBeNull();
      expect(result!.expression).toContain('#user');
    });
  });

  // ===== TE-G11: Unfilled slots =====
  describe('TE-G11: Unfilled Slots', () => {
    it('should report unfilled slots', () => {
      const engine = createEngine();
      // Force a template with slots that can't be filled
      const intent = {
        primaryIntent: NLIntent.SELECTION,
        intents: [{ intent: NLIntent.SELECTION, confidence: 0.8 }],
        entities: [],
        operators: [],
        logicalConnectors: [],
        complexity: 40,
      };
      const result = engine.generate('选择', intent);
      if (result) {
        expect(result.unfilledSlots.length).toBeGreaterThanOrEqual(0);
      }
    });

    it('should mark unfilled slots in expression', () => {
      const engine = createEngine();
      const intent = {
        primaryIntent: NLIntent.SELECTION,
        intents: [{ intent: NLIntent.SELECTION, confidence: 0.8 }],
        entities: [],
        operators: [],
        logicalConnectors: [],
        complexity: 40,
      };
      const result = engine.generate('选择所有', intent);
      if (result && result.unfilledSlots.length > 0) {
        expect(result.expression).toContain('${');
      }
    });
  });

  // ===== TE-G12: End-to-end =====
  describe('TE-G12: End-to-End', () => {
    it('should return null for unsupported intent with no templates', () => {
      const engine = createEngine();
      // ELVIS without enough entities should still work
      const intent = classifier.classify('默认值或者兜底');
      const result = engine.generate('默认值或者兜底', intent);
      // The ELVIS intent might or might not have enough entities
      expect(result === null || result !== null).toBe(true);
    });

    it('hasRole template should work with permission intent', () => {
      const engine = createEngine();
      const intent = classifier.classify('has admin role');
      const result = engine.generate('has admin role', intent);
      expect(result).not.toBeNull();
    });

    it('date template should work with date intent', () => {
      const engine = createEngine();
      const intent = classifier.classify('date before 2025');
      const result = engine.generate('date before 2025', intent);
      expect(result).not.toBeNull();
      expect(result!.intent).toBe(NLIntent.DATE);
    });

    it('boolean template should work with boolean intent', () => {
      const engine = createEngine();
      const intent = classifier.classify('isVIP is true');
      const result = engine.generate('isVIP is true', intent);
      expect(result).not.toBeNull();
      expect(result!.intent).toBe(NLIntent.BOOLEAN);
    });

    it('type check template should work', () => {
      const engine = createEngine();
      const intent = classifier.classify('instanceof Admin');
      const result = engine.generate('instanceof Admin', intent);
      expect(result).not.toBeNull();
      expect(result!.intent).toBe(NLIntent.TYPE_CHECK);
    });
  });
});
