
/** Half-open character range `[start, end)` in the source expression. */
interface Span {
  start: number;
  end: number;
}

interface LiteralScan {
  spans: Span[];
  /** The quote that opened an unterminated string literal, if there was one. */
  unterminatedQuote: string | null;
}

/**
 * Locate every string literal in the expression using spel-ts's tokenizer.
 *
 * Ranges are half-open and cover the quotes, so callers can keep the literal
 * text intact (the fixer) or blank it out (structural checks). The tokenizer
 * reports an unterminated literal as an error rather than as a token: in that
 * case the whole remainder is treated as one protected range up to the end of
 * the input, and the opening quote is returned so it can be closed.
 */
function scanStringLiterals(expression: string): LiteralScan {
  const spans: Span[] = [];
  let unterminatedQuote: string | null = null;

  let i = 0;
  while (i < expression.length) {
    const quote = expression[i];
    if (quote !== "'" && quote !== '"') {
      i += 1;
      continue;
    }

    const start = i;
    i += 1;
    let closed = false;
    while (i < expression.length) {
      if (expression[i] === quote) {
        // SpEL escapes a quote by doubling it: 'it''s'.
        if (expression[i + 1] === quote) {
          i += 2;
          continue;
        }
        i += 1;
        closed = true;
        break;
      }
      i += 1;
    }

    spans.push({ start, end: i });
    if (!closed) {
      unterminatedQuote = quote;
      break;
    }
  }

  return { spans, unterminatedQuote };
}

/**
 * Whether the expression ends inside a string literal.
 *
 * Exported for the validation pipeline's completeness gate, which needs to tell
 * an unterminated literal from input it simply could not lex.
 */
export function hasUnterminatedStringLiteral(expression: string): boolean {
  return scanStringLiterals(expression).unterminatedQuote !== null;
}

/**
 * Replace the contents of every string literal with spaces of the same length.
 *
 * Structural checks — delimiter balance, operator detection, reference
 * extraction — must not read literal text as syntax. Sharing the tokenizer's
 * own boundaries here is what keeps "inside a string literal" from drifting
 * between the parser, the fixer and the validator.
 */
export function maskStringLiterals(expression: string): string {
  const { spans } = scanStringLiterals(expression);
  if (spans.length === 0) return expression;

  const chars = expression.split('');
  for (const span of spans) {
    for (let i = span.start; i < span.end && i < chars.length; i++) {
      chars[i] = ' ';
    }
  }
  return chars.join('');
}

/**
 * AutoFixer — rewrites the JavaScript spellings an LLM commonly emits into the
 * SpEL equivalents, without ever touching the contents of a string literal.
 *
 * Literal boundaries come from a quote-state scan. In SpEL a quote character is
 * always a string-literal delimiter — the language has no comments and no other
 * construct that uses `'` or `"` — so the scan is exact by construction rather
 * than an approximation of the parser. It is also independent of the engine
 * build: deriving the boundaries from the lexer made every structural check
 * depend on the lexer being able to tokenize the *whole* expression, which fails
 * for input the engine cannot lex at all, such as a field name in Chinese on a
 * build without Unicode identifier support. A whole-string regex (the previous
 * implementation) rewrote literal contents and appended closers for delimiters
 * it could only see inside literals, turning valid expressions into broken
 * ones.
 */
export class AutoFixer {
  public fix(expression: string): AutoFixResult {
    const { chunks, unterminatedQuote } = this.split(expression);
    const changes: string[] = [];

    // Only the unprotected chunks are rewritten. Each chunk is independent, so
    // a length-changing rule cannot shift the ranges the next rule sees, and
    // the rules keep their original order (`=== undefined` before `===`, and
    // `!==` before `===`, so neither is double-processed).
    this.applyRule(
      chunks,
      /=== undefined/g,
      '== null',
      () => 'Replaced === undefined with == null',
      changes,
    );
    this.applyRule(
      chunks,
      /!== undefined/g,
      '!= null',
      () => 'Replaced !== undefined with != null',
      changes,
    );
    this.applyRule(chunks, /!==/g, '!=', (n) => `Replaced ${n}x !== with !=`, changes);
    this.applyRule(chunks, /===/g, '==', (n) => `Replaced ${n}x === with ==`, changes);
    this.applyRule(chunks, /&&/g, 'and', (n) => `Replaced ${n}x && with and`, changes);
    this.applyRule(chunks, /\|\|/g, 'or', (n) => `Replaced ${n}x || with or`, changes);
    this.applyRule(chunks, /> ==/g, '>=', () => 'Replaced > == with >=', changes);
    this.applyRule(chunks, /< ==/g, '<=', () => 'Replaced < == with <=', changes);
    this.applyElvisRule(chunks, changes);

    let fixed = chunks.map((chunk) => chunk.text).join('');

    // An unterminated string literal is the one case the tokenizer reports as
    // an error rather than as a token: close it with the quote that opened it.
    if (unterminatedQuote !== null && !fixed.endsWith(unterminatedQuote)) {
      fixed += unterminatedQuote;
      changes.push(
        unterminatedQuote === "'"
          ? 'Added missing closing single quote'
          : 'Added missing closing double quote',
      );
    }

    const wasFixed = changes.length > 0;
    return {
      wasFixed,
      expression: wasFixed ? fixed : expression,
      changes,
    };
  }

  /**
   * Apply one global replacement rule to every unprotected chunk.
   *
   * The replacement is only reported when it actually matched, and the count
   * is the number of matches across all chunks, so the human-readable change
   * log is unchanged from the previous implementation.
   */
  private applyRule(
    chunks: Chunk[],
    pattern: RegExp,
    replacement: string,
    describe: (count: number) => string,
    changes: string[],
  ): void {
    let count = 0;
    for (const chunk of chunks) {
      if (chunk.protected) continue;
      const matches = chunk.text.match(pattern);
      if (matches === null) continue;
      count += matches.length;
      chunk.text = chunk.text.replace(pattern, replacement);
    }
    if (count > 0) {
      changes.push(describe(count));
    }
  }

  /**
   * Normalise the Elvis operator only when it was written with whitespace
   * between `?` and `:`. A correctly written `?:` must be left untouched so
   * that `fix()` is a no-op on already-valid input.
   */
  private applyElvisRule(chunks: Chunk[], changes: string[]): void {
    let touched = false;
    for (const chunk of chunks) {
      if (chunk.protected || !chunk.text.includes('? :')) continue;
      const next = chunk.text.replace(/\s*\?\s*:\s*/g, ' ?: ');
      if (next !== chunk.text) {
        chunk.text = next;
        touched = true;
      }
    }
    if (touched) {
      changes.push('Fixed Elvis operator spacing');
    }
  }

  /**
   * Split the expression into alternating protected (string literal) and
   * unprotected chunks. Ranges come from spel-ts's tokenizer so they agree
   * exactly with what the parser considers opaque.
   */
  private split(expression: string): SplitResult {
    const { spans, unterminatedQuote } = scanStringLiterals(expression);
    return { chunks: this.toChunks(expression, spans), unterminatedQuote };
  }

  /**
   * Turn protected spans into a chunk list covering the whole expression.
   */
  private toChunks(expression: string, spans: Span[]): Chunk[] {
    const ordered = [...spans].sort((a, b) => a.start - b.start);
    const chunks: Chunk[] = [];
    let cursor = 0;

    for (const span of ordered) {
      const start = Math.max(span.start, cursor);
      const end = Math.max(span.end, start);
      if (start > cursor) {
        chunks.push({ protected: false, text: expression.slice(cursor, start) });
      }
      if (end > start) {
        chunks.push({ protected: true, text: expression.slice(start, end) });
      }
      cursor = end;
    }

    if (cursor < expression.length) {
      chunks.push({ protected: false, text: expression.slice(cursor) });
    }
    if (chunks.length === 0) {
      chunks.push({ protected: false, text: '' });
    }

    return chunks;
  }
}

/** A maximal run of the expression that is either protected or rewritable. */
interface Chunk {
  protected: boolean;
  text: string;
}

interface SplitResult {
  chunks: Chunk[];
  /** The quote that opened an unterminated string literal, if there was one. */
  unterminatedQuote: string | null;
}

export interface AutoFixResult {
  expression: string;
  wasFixed: boolean;
  changes: string[];
}
