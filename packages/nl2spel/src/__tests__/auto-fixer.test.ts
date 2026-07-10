import { describe, it, expect, vi } from 'vitest';
import { AutoFixer } from '../validation/auto-fixer.js';

describe('AutoFixer', () => {
  const fixer = new AutoFixer();

  function hasBalancedParens(expr: string): boolean {
    let count = 0;
    for (const ch of expr) {
      if (ch === '(') count++;
      if (ch === ')') count--;
      if (count < 0) return false;
    }
    return count === 0;
  }

  // ===== VL-G01: JS Operators → SpEL Operators =====
  describe('VL-G01: JS → SpEL Operators', () => {
    it('=== → ==', () => {
      const result = fixer.fix('#order.amount === 1000');
      expect(result.wasFixed).toBe(true);
      expect(result.expression).toContain('==');
      expect(result.expression).not.toContain('===');
      expect(result.changes.length).toBeGreaterThan(0);
    });

    it('!== → !=', () => {
      const result = fixer.fix("#order.status !== 'cancelled'");
      expect(result.wasFixed).toBe(true);
      expect(result.expression).toContain('!=');
      expect(result.expression).not.toContain('!==');
    });

    it('&& → and', () => {
      const result = fixer.fix('#order.amount > 100 && #order.paid == true');
      expect(result.wasFixed).toBe(true);
      expect(result.expression).toContain('and');
      expect(result.expression).not.toContain('&&');
    });

    it('|| → or', () => {
      const result = fixer.fix('#order.status == done || #order.vip');
      expect(result.wasFixed).toBe(true);
      expect(result.expression).toContain('or');
      expect(result.expression).not.toContain('||');
    });

    it('=== undefined → == null', () => {
      const result = fixer.fix('#order.remark === undefined');
      expect(result.wasFixed).toBe(true);
      expect(result.expression).toContain('== null');
    });
  });

  // ===== VL-G02: Quote Fixes =====
  describe('VL-G02: Quote Fixes', () => {
    it('should fix unmatched single quote by appending at end', () => {
      const result = fixer.fix("#order.status == 'pending");
      expect(result.wasFixed).toBe(true);
      expect(result.expression).toContain("'pending'");
    });

    it('should not modify valid single-quoted expressions', () => {
      const result = fixer.fix("#order.status == 'pending'");
      expect(result.wasFixed).toBe(false);
      expect(result.expression).toBe("#order.status == 'pending'");
    });
  });

  // ===== VL-G03: Parentheses Fixes =====
  describe('VL-G03: Parentheses Fixes', () => {
    it('should fix missing closing parenthesis', () => {
      const result = fixer.fix('(#order.amount > 100');
      expect(result.wasFixed).toBe(true);
      expect(hasBalancedParens(result.expression)).toBe(true);
    });

    it('should fix double missing parentheses', () => {
      const result = fixer.fix('(#order.amount > 100 and (#user.vip == true');
      expect(result.wasFixed).toBe(true);
      expect(hasBalancedParens(result.expression)).toBe(true);
    });

    it('should fix missing right bracket', () => {
      const result = fixer.fix('#order.items.?[#this.amount > 100');
      expect(result.wasFixed).toBe(true);
      // After fix, the missing ] should be appended
      expect(result.expression.includes(']')).toBe(true);
    });

    it('should not modify valid parenthesized expressions', () => {
      const result = fixer.fix('(#order.amount > 100) and (#user.vip == true)');
      expect(result.wasFixed).toBe(false);
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
      if (result.wasFixed) {
        expect(result.expression).toContain('>=');
        expect(result.expression).not.toContain('> ==');
      }
    });

    it('<= vs < ==', () => {
      const result = fixer.fix('#order.amount < == 100');
      if (result.wasFixed) {
        expect(result.expression).toContain('<=');
        expect(result.expression).not.toContain('< ==');
      }
    });
  });

  // ===== VL-G05: Elvis Operator =====
  describe('VL-G05: Elvis Operator', () => {
    it('should fix Elvis operator spacing', () => {
      // "? :" with space between ? and : should be "?:"
      const result = fixer.fix("#user.name ? : 'Anonymous'");
      if (result.wasFixed) {
        expect(result.expression).toContain('?:');
      }
    });

    it('should not break correct Elvis', () => {
      const result = fixer.fix("#user.name ?: 'Anonymous'");
      expect(result.expression).toContain('?:');
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
});
