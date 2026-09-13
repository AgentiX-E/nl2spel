import { describe, it, expect } from 'vitest';
import { splitClauses, decompose, UnconvertibleClauseError } from '../pattern/clause-splitter.js';
import { PatternMatcher } from '../pattern/pattern-matcher.js';
import { BUILTIN_PATTERNS } from '../pattern/builtin-patterns.js';

const texts = (input: string): string[] => splitClauses(input).map((clause) => clause.text);

describe('splitClauses', () => {
  it('returns a single clause when there is no connector', () => {
    expect(texts('金额大于1000')).toEqual(['金额大于1000']);
    expect(splitClauses('金额大于1000')).toHaveLength(1);
  });

  it('splits on each Chinese conjunction', () => {
    expect(texts('甲且乙')).toEqual(['甲', '乙']);
    expect(texts('甲并且乙')).toEqual(['甲', '乙']);
    expect(texts('甲同时乙')).toEqual(['甲', '乙']);
    expect(texts('甲而且乙')).toEqual(['甲', '乙']);
  });

  it('splits on the Chinese disjunctions and records the operator', () => {
    const clauses = splitClauses('甲或乙');
    expect(clauses.map((clause) => clause.text)).toEqual(['甲', '乙']);
    expect(clauses[1]!.connector).toBe('or');

    // 或者 must be consumed whole; a bare-或 alternative would leave a stray 者.
    expect(texts('甲或者乙')).toEqual(['甲', '乙']);
    expect(texts('甲要么乙')).toEqual(['甲', '乙']);
  });

  it('splits on English conjunctions only at word boundaries', () => {
    expect(texts('amount > 1000 and amount < 5000')).toEqual(['amount > 1000', 'amount < 5000']);
    // `android` and `ampersand` merely contain the letters of "and" and must not
    // split. Matching a slice rather than the whole input would lose the
    // preceding character and turn these into conjunctions.
    expect(texts('android')).toEqual(['android']);
    expect(texts('autofixtest double ampersand')).toEqual(['autofixtest double ampersand']);
    expect(texts('record')).toEqual(['record']);
  });

  it('does not treat 和 as a conjunction', () => {
    // A range separator, not a conjunction.
    expect(texts('价格在10和20之间')).toEqual(['价格在10和20之间']);
  });

  it('does not split the `and` of an English range expression', () => {
    expect(texts('amount between 100 and 500')).toEqual(['amount between 100 and 500']);
  });

  it('ignores connectors inside string literals', () => {
    const clauses = splitClauses("#msg == 'A and B' and #count > 1");
    expect(clauses.map((clause) => clause.text)).toEqual(["#msg == 'A and B'", '#count > 1']);
  });

  it('handles a doubled quote escape inside a literal', () => {
    // SpEL escapes a quote by doubling it, so the scanner must not treat the
    // second `'` of `it''s` as the end of the literal.
    expect(texts("#s == 'it''s and that' and #n > 1")).toEqual([
      "#s == 'it''s and that'",
      '#n > 1',
    ]);
  });

  it('handles an unterminated literal without splitting into it', () => {
    expect(texts("#s == 'A and B")).toEqual(["#s == 'A and B"]);
  });

  it('ignores connectors inside brackets', () => {
    expect(texts('(a and b) or c')).toEqual(['(a and b)', 'c']);
  });

  it('recovers from an unmatched closing bracket', () => {
    // A stray closer must not drive the depth negative and swallow the split.
    expect(texts('a) and b')).toEqual(['a)', 'b']);
  });

  it('reports an empty input as a single empty clause', () => {
    expect(texts('')).toEqual(['']);
    expect(texts('   ')).toEqual(['']);
  });

  it('records a trailing connector as an empty clause', () => {
    // The operator was written but its right operand is missing. Recording the
    // empty text lets the caller reject the input instead of dropping the
    // operator silently.
    expect(texts('金额大于1000且')).toEqual(['金额大于1000', '']);
  });
});

describe('decompose', () => {
  const upper = (clause: string): string | null => clause.toUpperCase();

  it('returns null when there is no top-level connector', () => {
    expect(decompose('金额大于1000', upper)).toBeNull();
  });

  it('parenthesises every operand', () => {
    const result = decompose('a且b', upper);
    expect(result?.expression).toBe('(A) and (B)');
  });

  it('binds and tighter than or, and says so explicitly', () => {
    // `a or b and c` means `a or (b and c)`, not `(a or b) and c`. The grouping
    // is made explicit so the rule does not rely on the reader knowing SpEL's
    // precedence between `and` and `or`.
    expect(decompose('a or b and c', upper)?.expression).toBe('(A) or ((B) and (C))');
    expect(decompose('a and b or c', upper)?.expression).toBe('((A) and (B)) or (C)');
  });

  it('does not add redundant grouping when only one operator is used', () => {
    expect(decompose('a or b or c', upper)?.expression).toBe('(A) or (B) or (C)');
  });

  it('joins three clauses of one operator with a single conjunction', () => {
    expect(decompose('a且b且c', upper)?.expression).toBe('(A) and (B) and (C)');
  });

  it('reports every clause it cannot convert', () => {
    const convert = (clause: string): string | null =>
      clause === 'b' || clause === 'd' ? null : clause.toUpperCase();
    let caught: unknown;
    try {
      decompose('a且b且c且d', convert);
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(UnconvertibleClauseError);
    expect((caught as UnconvertibleClauseError).unconvertible).toEqual(['b', 'd']);
    expect((caught as UnconvertibleClauseError).message).toContain("'b'");
  });

  it('rejects an empty trailing clause rather than dropping its operator', () => {
    expect(() => decompose('a且', upper)).toThrow(UnconvertibleClauseError);
  });
});

describe('decompose with the builtin pattern library', () => {
  const matcher = new PatternMatcher(BUILTIN_PATTERNS);
  const convert = (clause: string): string | null => {
    const result = matcher.match(clause);
    return result.matched ? result.spel! : null;
  };

  it('converts both halves of a Chinese conjunction', () => {
    // Before this stage the comparison pattern matched the prefix and the
    // `且` half was silently discarded.
    expect(decompose('金额大于1000且金额小于5000', convert)?.expression).toBe(
      '(#amount > 1000) and (#amount < 5000)',
    );
  });

  it('converts both halves of a Chinese disjunction', () => {
    expect(decompose('年龄大于18或年龄小于60', convert)?.expression).toBe(
      '(#age > 18) or (#age < 60)',
    );
  });

  it('converts an English conjunction', () => {
    expect(decompose('amount > 1000 and amount < 5000', convert)?.expression).toBe(
      '(#amount > 1000) and (#amount < 5000)',
    );
  });

  it('converts three clauses', () => {
    expect(decompose('金额大于1000且金额小于5000且状态等于已发货', convert)?.expression).toBe(
      "(#amount > 1000) and (#amount < 5000) and (#status == '已发货')",
    );
  });

  it('refuses a sentence whose second half has no conversion', () => {
    // `金额大于1000且订单已确认` used to yield `#amount > 1000`, a materially
    // weaker rule than the one asked for. It must refuse instead.
    let caught: unknown;
    try {
      decompose('金额大于1000且订单已确认', convert);
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(UnconvertibleClauseError);
    expect((caught as UnconvertibleClauseError).unconvertible).toEqual(['订单已确认']);
  });

  it('leaves a conjunction-free range expression alone', () => {
    expect(decompose('价格在10和20之间', convert)).toBeNull();
    expect(decompose('amount between 100 and 500', convert)).toBeNull();
  });
});
