import { describe, it, expect } from 'vitest';
import { SpelExpressionParser } from '@agentix-e/spel-ts';
import { NL2SpelEngine } from '../engine/nl2spel-engine.js';
import { UnconvertibleClauseError } from '../pattern/clause-splitter.js';

/**
 * End-to-end corpus: the expression a caller actually receives for a natural
 * language rule.
 *
 * This complements `builtin-patterns.contract.test.ts`. That suite asserts each
 * pattern reproduces its own declared examples in isolation; this one asserts the
 * result of the whole offline pipeline, where pattern priorities and clause
 * decomposition decide what wins. The two can disagree — a pattern can satisfy
 * its isolated contract and still never be reached end-to-end — so both are
 * needed.
 */

const parser = new SpelExpressionParser();

/** True when the expression contains no non-ASCII character at all. */
const isAscii = (expression: string): boolean => !/[^\x00-\x7f]/.test(expression);

describe('NL to SpEL corpus', () => {
  const engine = new NL2SpelEngine();

  const convertible: Array<[string, string]> = [
    ['年龄在18到60之间', '#age between {18, 60}'],
    ['amount between 100 and 500', '#amount between {100, 500}'],
    ['价格在10和20之间', '#price between {10, 20}'],
    ['a and b', '(a) and (b)'],
    ['价格大于5000', '#price > 5000'],
    ['年龄大于18', '#age > 18'],
    ['姓名不为空', '#姓名 != null'],
    ['备注为空', '#remark == null'],
    ['订单号以ORD开头', '#订单号.startsWith(\'ORD\')'],
    ['标题包含促销', "#title.contains('促销')"],
    ['是否已支付', '#已支付'],
    ['用户是VIP', "hasRole('VIP')"],
  ];

  for (const [nl, expected] of convertible) {
    it(`converts ${JSON.stringify(nl)}`, async () => {
      const result = await engine.generate(nl, { offlineOnly: true });
      expect(result.expression).toBe(expected);
      expect(result.strategy).toBe('pattern');
    });
  }

  for (const [nl, expected] of convertible) {
    it(`emits parseable SpEL for ${JSON.stringify(nl)}`, async () => {
      const result = await engine.generate(nl, { offlineOnly: true });
      if (!isAscii(result.expression)) {
        // These name a field in Chinese. They are legal Spring — `Character.isLetter`
        // accepts any Unicode letter — but the engine version this package currently
        // depends on rejects them, so parsing is asserted only for the ASCII subset
        // until that dependency is released. See the audit's D17.
        return;
      }
      expect(() => parser.parseExpression(result.expression)).not.toThrow();
    });
  }

  describe('compound sentences', () => {
    it('converts a sentence whose clauses are all convertible', async () => {
      const result = await engine.generate('金额大于1000且金额小于5000', { offlineOnly: true });
      expect(result.expression).toBe('(#amount > 1000) and (#amount < 5000)');
    });

    it('converts an English compound sentence', async () => {
      const result = await engine.generate('amount > 1000 and amount < 5000', {
        offlineOnly: true,
      });
      expect(result.expression).toBe('(#amount > 1000) and (#amount < 5000)');
    });

    it('prefers a logic pattern over decomposition', async () => {
      // Decomposing `a and b` would yield the clauses `a` and `b`, neither of
      // which any pattern converts, so the sentence would be refused. The logic
      // pattern expresses it in one expression and must win.
      const result = await engine.generate('a and b', { offlineOnly: true });
      expect(result.expression).toBe('(a) and (b)');
    });
  });

  describe('refusal', () => {
    const refused = ['金额大于1000且订单已确认', '金额大于100且已确认'];

    for (const nl of refused) {
      it(`refuses ${JSON.stringify(nl)} rather than dropping a clause`, async () => {
        // Each of these used to return `#amount > 1000` / `#amount > 100`. The
        // comparison pattern matched the prefix and the conjunction was silently
        // discarded, so the caller received a weaker rule than they asked for.
        await expect(engine.generate(nl, { offlineOnly: true })).rejects.toThrow(
          UnconvertibleClauseError,
        );
      });
    }

    it('names the clause it could not convert', async () => {
      let caught: unknown;
      try {
        await engine.generate('金额大于1000且订单已确认', { offlineOnly: true });
      } catch (error) {
        caught = error;
      }
      expect(caught).toBeInstanceOf(UnconvertibleClauseError);
      expect((caught as UnconvertibleClauseError).unconvertible).toEqual(['订单已确认']);
    });
  });

  describe('range expressions are not mistaken for conjunctions', () => {
    it('does not split the `and` of a between range', async () => {
      const result = await engine.generate('amount between 100 and 500', { offlineOnly: true });
      expect(result.expression).toBe('#amount between {100, 500}');
    });

    it('does not split the 和 of a Chinese range', async () => {
      const result = await engine.generate('价格在10和20之间', { offlineOnly: true });
      expect(result.expression).toBe('#price between {10, 20}');
    });
  });
});
