/**
 * Clause decomposition for compound natural-language rules.
 *
 * A single comparison pattern matches a prefix and ignores the rest, so a
 * sentence that joins two conditions is silently answered with only the first
 * one: `金额大于1000且订单已确认` used to produce `#amount > 1000`, dropping the
 * confirmation requirement entirely. The result parses, so nothing downstream
 * notices — a materially weaker rule than the one that was asked for.
 *
 * This module splits such a sentence on its top-level logical connectors, has the
 * caller convert each clause independently, and joins the results with SpEL's
 * `and`/`or`. A clause that cannot be converted is reported rather than dropped:
 * a partial rule is never emitted.
 */

/**
 * The connectors this module recognises, and the SpEL operator each maps to.
 *
 * These are sticky so they can be matched at an exact offset in the *whole*
 * input: matching against a slice would make the `\b` in `\band\b` evaluate
 * against the slice boundary instead of the real preceding character, and
 * `ampersand` would then contain a conjunction. Longer alternatives come first
 * so that `或者` is not consumed as `或` followed by a stray `者`.
 */
const CONNECTORS: ReadonlyArray<{ pattern: RegExp; operator: 'and' | 'or' }> = [
  // Chinese conjunctions. `和` is deliberately absent: it is a range separator in
  // `价格在10和20之间`, not a conjunction.
  { pattern: /(?:并且|且|同时|而且|、)/y, operator: 'and' },
  { pattern: /(?:或者|或|要么)/y, operator: 'or' },
  // English conjunctions, matched as whole words.
  { pattern: /\band\b/iy, operator: 'and' },
  { pattern: /\bor\b/iy, operator: 'or' },
];

export interface Clause {
  /** Clause text, trimmed. */
  text: string;
  /**
   * How this clause attaches to the previous one. The first clause carries
   * `'and'`, which is never used because a single clause needs no join.
   */
  connector: 'and' | 'or';
}

/** Raised when a compound sentence contains a clause that cannot be converted. */
export class UnconvertibleClauseError extends Error {
  /** The clause texts that could not be converted. */
  public readonly unconvertible: readonly string[];

  /** The full input that was being decomposed. */
  public readonly input: string;

  constructor(input: string, unconvertible: readonly string[]) {
    const detail = unconvertible.map((clause) => `'${clause}'`).join(', ');
    super(
      `Cannot decompose '${input}': no conversion for ${detail}. ` +
        'Refusing to emit a partial rule.',
    );
    this.name = 'UnconvertibleClauseError';
    this.input = input;
    this.unconvertible = unconvertible;
  }
}

const QUOTES = new Set(["'", '"']);
const OPENERS: Record<string, string> = { '(': ')', '[': ']', '{': '}' };
const CLOSERS = new Set([')', ']', '}']);

/** True when `ch` is a digit, used to protect the `and` inside `between 1 and 5`. */
const isDigit = (ch: string | undefined): boolean => ch !== undefined && ch >= '0' && ch <= '9';

/**
 * Find the next top-level connector at or after `from`.
 *
 * Quote state and bracket depth are tracked so that a connector inside a string
 * literal such as `'A and B'`, or inside a bracketed sub-expression such as
 * `(a and b) or c`, is not treated as a split point.
 */
function nextConnector(
  input: string,
  from: number,
): { index: number; length: number; operator: 'and' | 'or' } | null {
  let depth = 0;
  let quote: string | null = null;

  for (let i = from; i < input.length; i += 1) {
    const ch = input[i]!;

    if (quote !== null) {
      if (ch === quote) {
        // SpEL escapes a quote by doubling it: 'it''s'.
        if (input[i + 1] === quote) {
          i += 1;
          continue;
        }
        quote = null;
      }
      continue;
    }
    if (QUOTES.has(ch)) {
      quote = ch;
      continue;
    }
    if (ch in OPENERS) {
      depth += 1;
      continue;
    }
    if (CLOSERS.has(ch)) {
      depth = Math.max(0, depth - 1);
      continue;
    }
    if (depth > 0) continue;

    for (const { pattern, operator } of CONNECTORS) {
      pattern.lastIndex = i;
      const match = pattern.exec(input);
      if (!match || match.index !== i) continue;
      // An `and` directly between two numbers belongs to a range expression
      // (`amount between 100 and 500`), not to a conjunction.
      if (operator === 'and') {
        let before = i - 1;
        while (before >= 0 && input[before] === ' ') before -= 1;
        let after = i + match[0].length;
        while (after < input.length && input[after] === ' ') after += 1;
        if (isDigit(input[before]) && isDigit(input[after])) continue;
      }
      return { index: i, length: match[0].length, operator };
    }
  }

  return null;
}

/**
 * Split `input` on its top-level logical connectors.
 *
 * Returns a single clause when there is no top-level connector, so the caller can
 * treat "one clause" and "no decomposition needed" identically.
 */
export function splitClauses(input: string): Clause[] {
  const clauses: Clause[] = [];
  let start = 0;
  let connector: 'and' | 'or' = 'and';
  let cursor = 0;

  for (;;) {
    const found = nextConnector(input, cursor);
    if (found === null) break;
    clauses.push({ text: input.slice(start, found.index).trim(), connector });
    connector = found.operator;
    start = found.index + found.length;
    cursor = start;
  }

  const tail = input.slice(start).trim();
  // A trailing connector leaves the final fragment empty: `金额大于1000且`.
  // Recording it as a clause makes the emptiness explicit to the caller instead
  // of silently discarding the operator.
  if (clauses.length > 0 || tail.length > 0) {
    clauses.push({ text: tail, connector });
  }
  if (clauses.length === 0) {
    clauses.push({ text: '', connector: 'and' });
  }

  return clauses;
}

/**
 * Group clauses so that `and` binds tighter than `or`, matching SpEL's grammar
 * where `or_expression` is a sequence of `and_expression`s.
 *
 * Without this, left-to-right chaining would render `a or b and c` as
 * `(a or b) and c`, which is a different rule.
 */
function groupByPrecedence<T extends { connector: 'and' | 'or' }>(clauses: readonly T[]): T[][] {
  const groups: T[][] = [];
  let current: T[] = [];
  for (const clause of clauses) {
    if (clause.connector === 'or' && current.length > 0) {
      groups.push(current);
      current = [];
    }
    current.push(clause);
  }
  if (current.length > 0) groups.push(current);
  return groups;
}

export interface Decomposition {
  /** The joined expression, with every operand parenthesised. */
  expression: string;
  /** The clause texts, in order. */
  clauses: string[];
}

/**
 * Decompose `input` and convert every clause with `convert`.
 *
 * Returns `null` when the input has no top-level connector — the caller should
 * run its ordinary single-pass conversion instead. Throws
 * {@link UnconvertibleClauseError} when any clause cannot be converted, so a
 * partially understood sentence is never answered with a partial rule.
 */
export function decompose(
  input: string,
  convert: (clause: string) => string | null,
): Decomposition | null {
  const clauses = splitClauses(input);
  if (clauses.length <= 1) return null;

  const unconvertible: string[] = [];
  const resolved = clauses.map((clause) => {
    const expression = clause.text.length === 0 ? null : convert(clause.text);
    if (expression === null) {
      unconvertible.push(clause.text);
      return { ...clause, expression: '' };
    }
    return { ...clause, expression };
  });

  if (unconvertible.length > 0) {
    throw new UnconvertibleClauseError(input, unconvertible);
  }

  const groups = groupByPrecedence(resolved);
  // When an `or` is present the parenthesisation is made explicit, so the
  // emitted rule does not depend on the reader knowing that SpEL binds `and`
  // tighter than `or`.
  const mixed = groups.length > 1;
  const rendered = groups.map((group) => {
    const parts = group.map((clause) => `(${clause.expression})`);
    const joined = parts.join(' and ');
    return mixed && group.length > 1 ? `(${joined})` : joined;
  });

  return {
    expression: rendered.join(' or '),
    clauses: clauses.map((clause) => clause.text),
  };
}
