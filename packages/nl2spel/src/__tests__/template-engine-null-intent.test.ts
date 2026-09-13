import { describe, it, expect } from 'vitest';
import { SpelExpressionParser } from '@agentix-e/spel-ts';
import { IntentClassifier } from '../template/intent-classifier.js';
import { TemplateEngine } from '../template/template-engine.js';
import { NLIntent } from '../template/nl-intent.js';

/**
 * Regression suite for null/emptiness intent handling.
 *
 * Three defects are pinned here:
 *   1. the template-selection heuristic matched the negated phrase as well as
 *      the affirmative one ("不为空" contains "为空"), so "== null" was emitted
 *      for negated inputs;
 *   2. the unfilled field slot fell back to the literal placeholder word
 *      "field", so "#order.field == null" reached callers;
 *   3. the classifier scored "remark is not empty" as a boolean property
 *      (the BOOLEAN "no" keyword is a substring of "not").
 *
 * Every case asserts the exact emitted SpEL, that it parses, and that no
 * placeholder residue survives.
 */

interface NullCase {
  /** Natural-language input. */
  input: string;
  /** Exact SpEL the engine must emit. */
  expected: string;
  /** True when the phrase negates the null/emptiness check. */
  negated: boolean;
}

const CASES: NullCase[] = [
  // ── Chinese, explicit subject: "备注" resolves to the field "remark" ──
  { input: '备注为空', expected: '#order.remark == null', negated: false },
  { input: '备注是空的', expected: '#order.remark == null', negated: false },
  { input: '备注不存在', expected: '#order.remark == null', negated: false },
  { input: '备注无值', expected: '#order.remark == null', negated: false },
  { input: '备注为null', expected: '#order.remark == null', negated: false },
  { input: '备注不为空', expected: '#order.remark != null', negated: true },
  { input: '备注不是空的', expected: '#order.remark != null', negated: true },
  { input: '备注有值', expected: '#order.remark != null', negated: true },
  { input: '备注存在', expected: '#order.remark != null', negated: true },
  { input: '备注不为null', expected: '#order.remark != null', negated: true },
  { input: '备注非空', expected: '#order.remark != null', negated: true },

  // ── Chinese, bare predicate: no subject, so the neutral default applies ──
  { input: '为空', expected: '#order.value == null', negated: false },
  { input: '是空的', expected: '#order.value == null', negated: false },
  { input: '不存在', expected: '#order.value == null', negated: false },
  { input: '无值', expected: '#order.value == null', negated: false },
  { input: '为null', expected: '#order.value == null', negated: false },
  { input: '不为空', expected: '#order.value != null', negated: true },
  { input: '不是空的', expected: '#order.value != null', negated: true },
  { input: '有值', expected: '#order.value != null', negated: true },
  { input: '存在', expected: '#order.value != null', negated: true },
  { input: '不为null', expected: '#order.value != null', negated: true },
  { input: '非空', expected: '#order.value != null', negated: true },

  // ── English, explicit subject ──
  { input: 'remark is null', expected: '#order.remark == null', negated: false },
  { input: 'remark is empty', expected: '#order.remark == null', negated: false },
  { input: 'remark is not null', expected: '#order.remark != null', negated: true },
  { input: 'remark is not empty', expected: '#order.remark != null', negated: true },

  // ── English, bare predicate ──
  { input: 'is null', expected: '#order.value == null', negated: false },
  { input: 'is empty', expected: '#order.value == null', negated: false },
  { input: 'is not null', expected: '#order.value != null', negated: true },
  { input: 'is not empty', expected: '#order.value != null', negated: true },
];

const classifier = new IntentClassifier();
const parser = new SpelExpressionParser();

// A plain loop rather than describe.each: the runner's Vitest shim supports
// only the ordinary describe/it API.
for (const { input, expected, negated } of CASES) {
  describe(`null intent: "${input}"`, () => {
    const intent = classifier.classify(input);
    const result = new TemplateEngine().generate(input, intent);

    it('is classified as a null check', () => {
      expect(intent.primaryIntent).toBe(NLIntent.NULL_CHECK);
    });

    it('emits the exact expected expression', () => {
      expect(result).not.toBeNull();
      expect(result!.expression).toBe(expected);
    });

    it('selects the template matching the predicate polarity', () => {
      expect(result).not.toBeNull();
      expect(result!.templateName).toBe(negated ? 'NULL-IS_NOT_NULL' : 'NULL-IS_NULL');
    });

    it('leaves no unfilled slot', () => {
      expect(result).not.toBeNull();
      expect(result!.unfilledSlots).toHaveLength(0);
    });

    it('contains no placeholder residue', () => {
      expect(result).not.toBeNull();
      const expression = result!.expression;
      expect(expression).not.toContain('{');
      expect(expression).not.toContain('}');
      expect(expression).not.toContain('$');
    });

    it('parses as valid SpEL', () => {
      expect(result).not.toBeNull();
      expect(() => parser.parseExpression(result!.expression)).not.toThrow();
    });
  });
}
