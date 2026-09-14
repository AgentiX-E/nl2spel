/**
 * Contract tests for input normalization.
 *
 * `normalize` strips punctuation from the end of the input so that `金额大于100。` and `金额大于100`
 * reach the patterns as the same text. It used to do that with
 * `replace(/[，,。.!！?？;；:：]+$/, '')`, which is quadratic on input that does **not** end in a run
 * of punctuation: the engine retries the quantified class from every offset before the anchor
 * finally fails. It measured 2.5 ms at 2 000 characters and 155 ms at 16 000 — four times the work
 * for twice the input — on natural-language text, which no part of this library controls.
 *
 * The characters below are the class the normalizer strips, listed explicitly so the test fails if
 * the two drift apart. An early draft of this file added the enumeration comma `、`, which the code
 * deliberately does not strip, and the first assertion below is what caught it.
 */
import { describe, expect, it } from 'vitest';
import { BUILTIN_PATTERNS } from '../pattern/builtin-patterns.js';
import { PatternMatcher } from '../pattern/pattern-matcher.js';

/** Exactly the characters `normalize` removes from the end, in both widths. */
const TRAILING = ['，', ',', '。', '.', '！', '!', '？', '?', '；', ';', '：', ':'];

/** The expression a matcher produces, or a marker when it does not match. */
function produced(result: { matched: boolean; spel: unknown }): string {
  return result.matched ? String(result.spel) : '(no match)';
}

describe('trailing punctuation', () => {
  it('does not change what any builtin pattern produces', () => {
    const failures: string[] = [];
    for (const pattern of BUILTIN_PATTERNS) {
      const isolated = new PatternMatcher([pattern]);
      for (const example of pattern.examples) {
        const plain = produced(isolated.match(example.nl));
        for (const suffix of TRAILING) {
          const decorated = produced(isolated.match(`${example.nl}${suffix}`));
          if (decorated !== plain) {
            failures.push(
              `${pattern.id}: ${JSON.stringify(`${example.nl}${suffix}`)} -> ${decorated}`,
            );
          }
        }
      }
    }
    expect(failures).toEqual([]);
  });

  it('removes a whole run of them, not just one', () => {
    const matcher = new PatternMatcher([BUILTIN_PATTERNS[0]!]);
    const example = BUILTIN_PATTERNS[0]!.examples[0]!.nl;
    expect(produced(matcher.match(`${example}。！？`))).toBe(produced(matcher.match(example)));
  });
});

describe('a long run of punctuation that is not at the end', () => {
  it('is absorbed in one pass rather than retried at every offset', { timeout: 2000 }, () => {
    // One pattern, so the time measured is the normalizer's rather than the matcher's, over the
    // shape the old pattern was quadratic on: a long run that the end anchor then rejects. The old
    // code needed about six seconds here and the scan needs about a millisecond, so the timeout is
    // the assertion — this fails if the quadratic shape comes back.
    const matcher = new PatternMatcher([BUILTIN_PATTERNS[0]!]);
    expect(() => matcher.match(`${'!'.repeat(100_000)}a`)).not.toThrow();
  });
});
