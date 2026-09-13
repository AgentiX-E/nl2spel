import { describe, it, expect } from 'vitest';
import { SpelExpressionParser } from '@agentix-e/spel-ts';
import { AutoFixer } from '../validation/auto-fixer.js';

describe('AutoFixer', () => {
  const fixer = new AutoFixer();

  // ===== D10: string literals are never rewritten =====
  describe('D10: literal protection', () => {
    // Every one of these is already valid SpEL, so fix() must return it
    // byte-identical. Before D10 the whole-string regexes rewrote four of them.
    const validExpressions: Array<[string, string]> = [
      ["#msg == 'A && B'", 'literal contains &&'],
      ["#note == 'x === y'", 'literal contains ==='],
      ["#tpl == 'a || b'", 'literal contains ||'],
      ["#s == 'it''s'", 'escaped quote'],
      ["#re matches '^a{2}$'", 'regex braces'],
      ["#re matches '\\d+('", 'unbalanced paren inside a literal'],
      ["#a == 'don''t' and #b == 'won''t'", 'two escaped quotes'],
      ['#x > 5', 'already valid'],
      ["#name == 'O''Brien'", 'apostrophe surname'],
    ];

    for (const [input, why] of validExpressions) {
      it(`leaves ${input} byte-identical (${why})`, () => {
        const result = fixer.fix(input);
        expect(result.expression).toBe(input);
        expect(result.wasFixed).toBe(false);
        expect(result.changes).toHaveLength(0);
      });
    }

    it('still rewrites JS operators that are outside every literal', () => {
      const result = fixer.fix('#a === 1 && #b');
      expect(result.wasFixed).toBe(true);
      expect(result.expression).toBe('#a == 1 and #b');
    });

    it('rewrites outside the literals while preserving their contents exactly', () => {
      const result = fixer.fix("#x == 'a && b' && #y === 1");
      expect(result.expression).toBe("#x == 'a && b' and #y == 1");
      expect(result.changes).toContain('Replaced 1x && with and');
      expect(result.changes).toContain('Replaced 1x === with ==');
    });

    it('does not append a closing quote for a quote inside a literal', () => {
      const result = fixer.fix("#a == 'don''t' and #b == 'won''t'");
      expect(result.expression).toBe("#a == 'don''t' and #b == 'won''t'");
    });
  });

  // ===== VL-G01: JS Operators → SpEL Operators =====
  describe('VL-G01: JS → SpEL Operators', () => {
    it('=== → ==', () => {
      const result = fixer.fix('#order.amount === 1000');
      expect(result.wasFixed).toBe(true);
      expect(result.expression).toBe('#order.amount == 1000');
      expect(result.changes.length).toBeGreaterThan(0);
    });

    it('!== → !=', () => {
      const result = fixer.fix("#order.status !== 'cancelled'");
      expect(result.wasFixed).toBe(true);
      expect(result.expression).toBe("#order.status != 'cancelled'");
    });

    it('&& → and', () => {
      const result = fixer.fix('#order.amount > 100 && #order.paid == true');
      expect(result.wasFixed).toBe(true);
      expect(result.expression).toBe('#order.amount > 100 and #order.paid == true');
    });

    it('|| → or', () => {
      const result = fixer.fix('#order.status == done || #order.vip');
      expect(result.wasFixed).toBe(true);
      expect(result.expression).toBe('#order.status == done or #order.vip');
    });

    it('=== undefined → == null', () => {
      const result = fixer.fix('#order.remark === undefined');
      expect(result.wasFixed).toBe(true);
      expect(result.expression).toBe('#order.remark == null');
      expect(result.changes).toContain('Replaced === undefined with == null');
    });
  });

  // ===== VL-G02: Quote completion =====
  describe('VL-G02: Quote completion', () => {
    it('completes an unterminated single quote', () => {
      const result = fixer.fix("#order.status == 'pending");
      expect(result.wasFixed).toBe(true);
      expect(result.expression).toBe("#order.status == 'pending'");
      expect(result.changes).toContain('Added missing closing single quote');
    });

    it('completes an unterminated double quote', () => {
      const result = fixer.fix('#order.status == "pending');
      expect(result.wasFixed).toBe(true);
      expect(result.expression).toBe('#order.status == "pending"');
      expect(result.changes).toContain('Added missing closing double quote');
    });

    it('does not modify a valid single-quoted expression', () => {
      const result = fixer.fix("#order.status == 'pending'");
      expect(result.wasFixed).toBe(false);
      expect(result.expression).toBe("#order.status == 'pending'");
    });

    it('combines quote completion with the operator rewrites', () => {
      const result = fixer.fix("#order.amount === 1000 && #order.status == 'done");
      expect(result.expression).toBe("#order.amount == 1000 and #order.status == 'done'");
      expect(result.changes).toHaveLength(3);
    });
  });

  // ===== D10: delimiter-counting repair is gone =====
  describe('D10: no delimiter-counting repair', () => {
    // These append-closer behaviours were deleted: counting delimiters over the
    // whole string cannot tell a `(` inside a regex literal from a genuinely
    // unbalanced one, and it turned valid input into a syntax error. The fixer
    // now leaves an unbalanced expression alone rather than guessing.
    const unbalanced = [
      '(#order.amount > 100',
      '(#order.amount > 100 and (#user.vip == true',
      '#order.items.?[#this.amount > 100',
      '{a: {b: 1}',
      '{#a, #b',
    ];

    for (const input of unbalanced) {
      it(`leaves unbalanced input ${input} unchanged`, () => {
        const result = fixer.fix(input);
        expect(result.expression).toBe(input);
        expect(result.wasFixed).toBe(false);
      });
    }

    it('never emits the removed bracket-repair change message', () => {
      const result = fixer.fix('(#order.amount > 100');
      expect(result.changes).not.toContain('Fixed unbalanced brackets');
    });
  });

  // ===== VL-G04: Multi-Error Fixes =====
  describe('VL-G04: Multi-Error Fixes', () => {
    it('should fix multiple errors in one pass', () => {
      const result = fixer.fix("#order.amount === 1000 && #order.status == 'done");
      expect(result.wasFixed).toBe(true);
      expect(result.expression).not.toContain('===');
      expect(result.expression).not.toContain('&&');
      expect(result.changes.length).toBeGreaterThanOrEqual(2);
    });

    it('should report all changes', () => {
      const result = fixer.fix('#x === 1 || #y === 2 && #z === 3');
      expect(result.changes.length).toBeGreaterThanOrEqual(3);
    });

    it('>= vs > ==', () => {
      const result = fixer.fix('#order.amount > == 100');
      expect(result.wasFixed).toBe(true);
      expect(result.expression).toBe('#order.amount >= 100');
      expect(result.changes).toContain('Replaced > == with >=');
    });

    it('<= vs < ==', () => {
      const result = fixer.fix('#order.amount < == 100');
      expect(result.wasFixed).toBe(true);
      expect(result.expression).toBe('#order.amount <= 100');
      expect(result.changes).toContain('Replaced < == with <=');
    });
  });

  // ===== VL-G05: Elvis Operator =====
  describe('VL-G05: Elvis Operator', () => {
    it('should fix Elvis operator spacing', () => {
      const result = fixer.fix("#user.name ? : 'Anonymous'");
      expect(result.wasFixed).toBe(true);
      expect(result.expression).toBe("#user.name ?: 'Anonymous'");
      expect(result.changes).toContain('Fixed Elvis operator spacing');
    });

    it('should not break correct Elvis', () => {
      const result = fixer.fix("#user.name ?: 'Anonymous'");
      expect(result.wasFixed).toBe(false);
      expect(result.expression).toBe("#user.name ?: 'Anonymous'");
    });
  });

  // ===== VL-G06: Valid Expressions (No Fix Needed) =====
  describe('VL-G06: Valid Expressions', () => {
    it('simple comparison', () => {
      const result = fixer.fix('#order.amount > 1000');
      expect(result.wasFixed).toBe(false);
      expect(result.changes).toHaveLength(0);
    });

    it('string comparison', () => {
      const result = fixer.fix("#order.status == '已发货'");
      expect(result.wasFixed).toBe(false);
    });

    it('null check', () => {
      const result = fixer.fix('#order.remark == null');
      expect(result.wasFixed).toBe(false);
    });

    it('logical and', () => {
      const result = fixer.fix('#order.amount > 100 and #order.paid == true');
      expect(result.wasFixed).toBe(false);
    });

    it('collection contains', () => {
      const result = fixer.fix("#order.tags.contains('VIP')");
      expect(result.wasFixed).toBe(false);
    });

    it('between', () => {
      const result = fixer.fix('#user.age between {18, 60}');
      expect(result.wasFixed).toBe(false);
    });
  });

  // ===== Property: every expression that already parses is a fixed point =====
  describe('fixed point on the parseable corpus', () => {
    const parser = new SpelExpressionParser();
    const corpus = [
      '#order.amount > 1000',
      "#order.status == 'done'",
      "#msg == 'A && B'",
      "#note == 'x === y'",
      "#tpl == 'a || b'",
      "#s == 'it''s'",
      "#re matches '^a{2}$'",
      "#re matches '\\d+('",
      "#name == 'O''Brien'",
      '#order.items.?[#this.amount > 100]',
      '#order.items.^[#this.amount > 1000]',
      '#user.age between {18, 60}',
      '#order.remark == null',
      "#order.tags.contains('VIP')",
      "#user.name ?: 'Anonymous'",
      "#a == 'x' and #b == 'y'",
      '!#order.paid',
      '#order.amount > 100 and #order.paid == true',
      'T(java.lang.Math).abs(-1)',
      '{1, 2, 3}',
      "'literal only'",
      '#value == 1.5',
      '#x > 100 and (#y < 50 or #z == 0)',
      '@discountService.calculate(100)',
      "#order.status != 'cancelled'",
      '#list[0]',
      "#map['key']",
    ];

    for (const expression of corpus) {
      it(`does not alter ${expression}`, () => {
        // Guard the premise: the corpus really is already valid SpEL.
        parser.parseExpression(expression);
        const result = fixer.fix(expression);
        expect(result.expression).toBe(expression);
        expect(result.wasFixed).toBe(false);
      });
    }
  });

  // ===== Additional Coverage =====
  describe('Additional Coverage', () => {
    it('!== undefined → != null (without === undefined)', () => {
      const result = fixer.fix('#x !== undefined or #y != null');
      expect(result.wasFixed).toBe(true);
      expect(result.expression).toBe('#x != null or #y != null');
      expect(result.changes).toContain('Replaced !== undefined with != null');
    });

    it('empty string input (no-op)', () => {
      const result = fixer.fix('');
      expect(result.wasFixed).toBe(false);
      expect(result.changes).toHaveLength(0);
      expect(result.expression).toBe('');
    });

    it('expression with NO changes needed but wasFixed returns false', () => {
      const result = fixer.fix('#x > 0');
      expect(result.wasFixed).toBe(false);
      expect(result.changes).toHaveLength(0);
      expect(result.expression).toBe('#x > 0');
    });

    it('all fixes combined in one expression', () => {
      const result = fixer.fix('#x === undefined && #y !== undefined || #z > == 5');
      expect(result.wasFixed).toBe(true);
      expect(result.expression).toBe('#x == null and #y != null or #z >= 5');
      expect(result.changes.length).toBeGreaterThanOrEqual(4);
    });
  });

  // ===== Rule bookkeeping =====
  describe('change reporting', () => {
    it('reports !== and === separately, in that order', () => {
      const result = fixer.fix('#x !== 5 && #y === 0');
      expect(result.changes).toContain('Replaced 1x !== with !=');
      expect(result.changes).toContain('Replaced 1x === with ==');
      expect(result.expression).toBe('#x != 5 and #y == 0');
    });

    it('reports a count per rule across literal-separated chunks', () => {
      const result = fixer.fix("#a !== 'x' || #b !== 'y'");
      expect(result.changes).toContain('Replaced 2x !== with !=');
      expect(result.changes).toContain('Replaced 1x || with or');
      expect(result.expression).toBe("#a != 'x' or #b != 'y'");
    });

    it('does not fire the Elvis rule without whitespace around the colon', () => {
      const result = fixer.fix("#x ?: 'default'");
      expect(result.wasFixed).toBe(false);
      expect(result.expression).toBe("#x ?: 'default'");
    });

    it('leaves a lone operator rewrite untouched when nothing else changes', () => {
      const result = fixer.fix('#x === 5');
      expect(result.changes).toEqual(['Replaced 1x === with ==']);
      expect(result.expression).toBe('#x == 5');
    });
  });
});
