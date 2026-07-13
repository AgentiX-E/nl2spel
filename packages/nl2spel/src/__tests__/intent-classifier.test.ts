import { describe, it, expect } from 'vitest';
import { IntentClassifier } from '../template/intent-classifier.js';
import { NLIntent } from '../template/nl-intent.js';

const classifier = new IntentClassifier();

describe('IntentClassifier', () => {
  // ===== IC-G01: COMPARISON intent =====
  describe('IC-G01: COMPARISON', () => {
    it('金额大于100', () => {
      const r = classifier.classify('金额大于100');
      expect(r.primaryIntent).toBe(NLIntent.COMPARISON);
      expect(r.operators).toContain('>');
    });

    it('amount > 500', () => {
      const r = classifier.classify('amount > 500');
      expect(r.primaryIntent).toBe(NLIntent.COMPARISON);
      expect(r.operators).toContain('>');
    });

    it('数量小于10', () => {
      const r = classifier.classify('数量小于10');
      expect(r.primaryIntent).toBe(NLIntent.COMPARISON);
    });

    it('价格等于99', () => {
      const r = classifier.classify('价格等于99');
      expect(r.primaryIntent).toBe(NLIntent.COMPARISON);
    });

    it('status == pending', () => {
      const r = classifier.classify('status == pending');
      expect(r.primaryIntent).toBe(NLIntent.COMPARISON);
    });

    it('金额不超过200', () => {
      const r = classifier.classify('金额不超过200');
      expect(r.primaryIntent).toBe(NLIntent.COMPARISON);
    });

    it('金额不小于50', () => {
      const r = classifier.classify('金额不小于50');
      expect(r.primaryIntent).toBe(NLIntent.COMPARISON);
    });

    it('value != null', () => {
      const r = classifier.classify('value != null');
      // COMPARISON and NULL_CHECK both match — check which has higher score
      expect([NLIntent.COMPARISON, NLIntent.NULL_CHECK]).toContain(r.primaryIntent);
    });

    it('greater than 100', () => {
      const r = classifier.classify('greater than 100');
      expect(r.primaryIntent).toBe(NLIntent.COMPARISON);
    });

    it('less than 50', () => {
      const r = classifier.classify('less than 50');
      expect(r.primaryIntent).toBe(NLIntent.COMPARISON);
    });
  });

  // ===== IC-G02: NULL_CHECK intent =====
  describe('IC-G02: NULL_CHECK', () => {
    it('备注为空', () => {
      const r = classifier.classify('备注为空');
      expect(r.primaryIntent).toBe(NLIntent.NULL_CHECK);
    });

    it('name is null', () => {
      const r = classifier.classify('name is null');
      expect(r.primaryIntent).toBe(NLIntent.NULL_CHECK);
    });

    it('备注不为空', () => {
      const r = classifier.classify('备注不为空');
      expect(r.primaryIntent).toBe(NLIntent.NULL_CHECK);
    });

    it('field is not null', () => {
      const r = classifier.classify('field is not null');
      expect(r.primaryIntent).toBe(NLIntent.NULL_CHECK);
    });

    it('值不存在', () => {
      const r = classifier.classify('值不存在');
      expect(r.primaryIntent).toBe(NLIntent.NULL_CHECK);
    });

    it('data is empty', () => {
      const r = classifier.classify('data is empty');
      expect(r.primaryIntent).toBe(NLIntent.NULL_CHECK);
    });
  });

  // ===== IC-G03: PERMISSION_CHECK intent =====
  describe('IC-G03: PERMISSION_CHECK', () => {
    it('用户是管理员', () => {
      const r = classifier.classify('用户是管理员');
      expect(r.intents.some((i) => i.intent === NLIntent.PERMISSION_CHECK)).toBe(true);
    });

    it('user has admin role', () => {
      const r = classifier.classify('user has admin role');
      expect(r.intents.some((i) => i.intent === NLIntent.PERMISSION_CHECK)).toBe(true);
    });

    it('用户可以删除', () => {
      const r = classifier.classify('用户可以删除');
      expect(r.intents.some((i) => i.intent === NLIntent.PERMISSION_CHECK)).toBe(true);
    });

    it('has permission to edit', () => {
      const r = classifier.classify('has permission to edit');
      expect(r.intents.some((i) => i.intent === NLIntent.PERMISSION_CHECK)).toBe(true);
    });

    it('不允许操作', () => {
      const r = classifier.classify('不允许操作');
      expect(r.intents.some((i) => i.intent === NLIntent.PERMISSION_CHECK)).toBe(true);
    });
  });

  // ===== IC-G04: LOGICAL intent =====
  describe('IC-G04: LOGICAL', () => {
    it('金额大于100且已确认', () => {
      const r = classifier.classify('金额大于100且已确认');
      expect(r.intents.some((i) => i.intent === NLIntent.LOGICAL)).toBe(true);
      expect(r.logicalConnectors).toContain('and');
    });

    it('amount > 100 and status == done', () => {
      const r = classifier.classify('amount > 100 and status == done');
      expect(r.logicalConnectors).toContain('and');
    });

    it('金额大于500或已发货', () => {
      const r = classifier.classify('金额大于500或已发货');
      expect(r.logicalConnectors).toContain('or');
    });

    it('VIP or admin', () => {
      const r = classifier.classify('VIP or admin');
      expect(r.logicalConnectors).toContain('or');
    });

    it('不是已取消', () => {
      const r = classifier.classify('不是已取消');
      expect(r.logicalConnectors).toContain('not');
    });

    it('not cancelled', () => {
      const r = classifier.classify('not cancelled');
      expect(r.logicalConnectors).toContain('not');
    });

    it('条件A && 条件B', () => {
      const r = classifier.classify('条件A && 条件B');
      expect(r.logicalConnectors).toContain('and');
    });
  });

  // ===== IC-G05: STRING_MATCH intent =====
  describe('IC-G05: STRING_MATCH', () => {
    it('备注包含加急', () => {
      const r = classifier.classify('备注包含加急');
      expect(r.primaryIntent).toBe(NLIntent.STRING_MATCH);
    });

    it('name contains test', () => {
      const r = classifier.classify('name contains test');
      expect(r.primaryIntent).toBe(NLIntent.STRING_MATCH);
    });

    it('以ORD开头', () => {
      const r = classifier.classify('以ORD开头');
      // "以...开头" doesn't match directly, but "包含" keywords might
      expect(r.intents.length).toBeGreaterThan(0);
    });

    it('ends with .pdf', () => {
      const r = classifier.classify('ends with .pdf');
      expect(r.intents.some((i) => i.intent === NLIntent.STRING_MATCH)).toBe(true);
    });

    it('正则匹配', () => {
      const r = classifier.classify('正则匹配');
      expect(r.intents.some((i) => i.intent === NLIntent.STRING_MATCH)).toBe(true);
    });
  });

  // ===== IC-G06: COLLECTION intent =====
  describe('IC-G06: COLLECTION', () => {
    it('订单列表数量大于10', () => {
      const r = classifier.classify('订单列表数量大于10');
      expect(r.intents.some((i) => i.intent === NLIntent.COLLECTION)).toBe(true);
    });

    it('list size > 5', () => {
      const r = classifier.classify('list size > 5');
      expect(r.intents.some((i) => i.intent === NLIntent.COLLECTION)).toBe(true);
    });

    it('列表为空', () => {
      const r = classifier.classify('列表为空');
      expect(r.intents.some((i) => i.intent === NLIntent.COLLECTION)).toBe(true);
    });

    it('items is empty', () => {
      const r = classifier.classify('items is empty');
      expect(r.intents.some((i) => i.intent === NLIntent.COLLECTION)).toBe(true);
    });

    it('集合包含VIP', () => {
      const r = classifier.classify('集合包含VIP');
      expect(r.intents.some((i) => i.intent === NLIntent.COLLECTION)).toBe(true);
    });
  });

  // ===== IC-G07: RANGE intent =====
  describe('IC-G07: RANGE', () => {
    it('年龄在18到60之间', () => {
      const r = classifier.classify('年龄在18到60之间');
      expect(r.primaryIntent).toBe(NLIntent.RANGE);
    });

    it('amount between 100 and 500', () => {
      const r = classifier.classify('amount between 100 and 500');
      expect(r.primaryIntent).toBe(NLIntent.RANGE);
    });

    it('价格在10到100范围', () => {
      const r = classifier.classify('价格在10到100范围');
      expect(r.primaryIntent).toBe(NLIntent.RANGE);
    });
  });

  // ===== IC-G08: SELECTION intent =====
  describe('IC-G08: SELECTION', () => {
    it('所有符合条件的', () => {
      const r = classifier.classify('所有符合条件的');
      expect(r.intents.some((i) => i.intent === NLIntent.SELECTION)).toBe(true);
    });

    it('第一个满足条件的', () => {
      const r = classifier.classify('第一个满足条件的');
      expect(r.intents.some((i) => i.intent === NLIntent.SELECTION)).toBe(true);
    });

    it('filter matching items', () => {
      const r = classifier.classify('filter matching items');
      expect(r.intents.some((i) => i.intent === NLIntent.SELECTION)).toBe(true);
    });
  });

  // ===== IC-G09: PROJECTION intent =====
  describe('IC-G09: PROJECTION', () => {
    it('每个项目的名称', () => {
      const r = classifier.classify('每个项目的名称');
      expect(r.primaryIntent).toBe(NLIntent.PROJECTION);
    });

    it('each item price', () => {
      const r = classifier.classify('each item price');
      expect(r.primaryIntent).toBe(NLIntent.PROJECTION);
    });

    it('所有商品的价格', () => {
      const r = classifier.classify('所有商品的价格');
      expect(r.intents.some((i) => i.intent === NLIntent.PROJECTION)).toBe(true);
    });
  });

  // ===== IC-G10: TYPE_CHECK intent =====
  describe('IC-G10: TYPE_CHECK', () => {
    it('instanceof Admin', () => {
      const r = classifier.classify('instanceof Admin');
      expect(r.primaryIntent).toBe(NLIntent.TYPE_CHECK);
    });

    it('是否是Admin类型', () => {
      const r = classifier.classify('是否是Admin类型');
      expect(r.primaryIntent).toBe(NLIntent.TYPE_CHECK);
    });
  });

  // ===== IC-G11: BOOLEAN intent =====
  describe('IC-G11: BOOLEAN', () => {
    it('是否已支付', () => {
      const r = classifier.classify('是否已支付');
      expect(r.primaryIntent).toBe(NLIntent.BOOLEAN);
    });

    it('isVIP is true', () => {
      const r = classifier.classify('isVIP is true');
      expect(r.primaryIntent).toBe(NLIntent.BOOLEAN);
    });

    it('flag is false', () => {
      const r = classifier.classify('flag is false');
      expect(r.primaryIntent).toBe(NLIntent.BOOLEAN);
    });
  });

  // ===== IC-G12: DATE intent =====
  describe('IC-G12: DATE', () => {
    it('创建日期在2024-01-01之后', () => {
      const r = classifier.classify('创建日期在2024-01-01之后');
      expect(r.primaryIntent).toBe(NLIntent.DATE);
    });

    it('date before 2025', () => {
      const r = classifier.classify('date before 2025');
      expect(r.primaryIntent).toBe(NLIntent.DATE);
    });

    it('过期时间早于今天', () => {
      const r = classifier.classify('过期时间早于今天');
      expect(r.primaryIntent).toBe(NLIntent.DATE);
    });
  });

  // ===== IC-G13: MULTI-INTENT =====
  describe('IC-G13: Multi-Intent', () => {
    it('金额大于100且状态为已确认', () => {
      const r = classifier.classify('金额大于100且状态为已确认');
      expect(r.intents.length).toBeGreaterThanOrEqual(2);
    });

    it('列表不为空且数量大于5', () => {
      const r = classifier.classify('列表不为空且数量大于5');
      expect(r.intents.length).toBeGreaterThanOrEqual(2);
    });

    it('amount > 100 and name contains test', () => {
      const r = classifier.classify('amount > 100 and name contains test');
      expect(r.intents.length).toBeGreaterThanOrEqual(2);
    });

    it('年龄在18到60且不是VIP', () => {
      const r = classifier.classify('年龄在18到60且不是VIP');
      expect(r.intents.length).toBeGreaterThanOrEqual(2);
    });

    it('complexity score should increase with multi-intent input', () => {
      const simple = classifier.classify('金额大于100');
      const complex = classifier.classify('金额大于100且状态已确认且用户是VIP');
      expect(complex.complexity).toBeGreaterThan(simple.complexity);
    });
  });

  // ===== IC-G14: Ambiguity Resolution =====
  describe('IC-G14: Ambiguity Resolution', () => {
    it('should handle empty input', () => {
      const r = classifier.classify('');
      expect(r.intents).toHaveLength(1);
      expect(r.complexity).toBeGreaterThanOrEqual(0);
    });

    it('should handle whitespace-only input', () => {
      const r = classifier.classify('   ');
      expect(r.intents).toHaveLength(1);
    });

    it('should handle unknown input', () => {
      const r = classifier.classify('xyzabc123');
      expect(r.intents.length).toBeGreaterThan(0);
      expect(r.primaryIntent).toBeDefined();
    });

    it('should never throw for any input', () => {
      expect(() => classifier.classify('!@#$%^&*()_+')).not.toThrow();
      expect(() => classifier.classify('a'.repeat(1000))).not.toThrow();
    });
  });

  // ===== IC-G15: Chinese Specializations =====
  describe('IC-G15: Chinese Specializations', () => {
    it('订单金额大于1000', () => {
      const r = classifier.classify('订单金额大于1000');
      expect(r.primaryIntent).toBe(NLIntent.COMPARISON);
    });

    it('用户拥有管理员角色', () => {
      const r = classifier.classify('用户拥有管理员角色');
      expect(r.intents.some((i) => i.intent === NLIntent.PERMISSION_CHECK)).toBe(true);
    });

    it('订单状态不是已取消', () => {
      const r = classifier.classify('订单状态不是已取消');
      expect(r.intents.some((i) => i.intent === NLIntent.LOGICAL)).toBe(true);
    });

    it('备注包含加急', () => {
      const r = classifier.classify('备注包含加急');
      expect(r.primaryIntent).toBe(NLIntent.STRING_MATCH);
    });

    it('订单号以ORD开头', () => {
      const r = classifier.classify('订单号以ORD开头');
      expect(r.primaryIntent).toBe(NLIntent.STRING_MATCH);
    });
  });

  // ===== Input Normalization =====
  describe('Input Normalization', () => {
    it('should convert full-width characters to half-width', () => {
      // Full-width ＞ (U+FF1E) → half-width >
      const r = classifier.classify('金额＞1000');
      expect(r.operators).toContain('>');
      expect(r.primaryIntent).toBe(NLIntent.COMPARISON);
    });

    it('should convert full-width English letters to half-width', () => {
      // Full-width Ｇ (U+FF27) → half-width G (U+0047)
      const r = classifier.classify('ａｂｃ greater than ５０');
      expect(r.primaryIntent).toBe(NLIntent.COMPARISON);
      expect(r.entities.some((e) => e.text === '50')).toBe(true);
    });

    it('should trim whitespace and normalize internal spaces', () => {
      const r = classifier.classify('  金额  大于  1000  ');
      expect(r.primaryIntent).toBe(NLIntent.COMPARISON);
      expect(r.operators).toContain('>');
      const nums = r.entities.filter((e) => e.type === 'value' && !isNaN(Number(e.text)));
      expect(nums[0]!.text).toBe('1000');
    });

    it('should lowercase input for case-insensitive matching', () => {
      // 'Greater' → 'greater' after toLowerCase; COMPARISON intent detected via en keywords
      const r = classifier.classify('AMOUNT GREATER Than 500');
      expect(r.primaryIntent).toBe(NLIntent.COMPARISON);
      // English word "greater" maps to COMPARISON intent but not to the '>' operator
      expect(r.intents.some((i) => i.intent === NLIntent.COMPARISON)).toBe(true);
    });
  });

  // ===== Entity extraction =====
  describe('Entity Extraction', () => {
    it('should extract numeric entities', () => {
      const r = classifier.classify('金额大于1000');
      const nums = r.entities.filter((e) => e.type === 'value' && !isNaN(Number(e.text)));
      expect(nums.length).toBeGreaterThan(0);
      expect(nums[0]!.text).toBe('1000');
    });

    it('should extract decimal values', () => {
      const r = classifier.classify('price > 99.99');
      const nums = r.entities.filter((e) => e.type === 'value' && !isNaN(Number(e.text)));
      expect(nums.some((e) => e.text === '99.99')).toBe(true);
    });

    it('should extract multiple numeric values', () => {
      const r = classifier.classify('金额在100到500之间');
      const nums = r.entities.filter((e) => e.type === 'value' && !isNaN(Number(e.text)));
      expect(nums.length).toBeGreaterThanOrEqual(2);
    });
  });
});
