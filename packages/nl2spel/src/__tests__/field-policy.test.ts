import { describe, it, expect } from 'vitest';
import { PatternMatcher, UnmappedFieldError } from '../pattern/pattern-matcher.js';
import type { FieldPolicy } from '../pattern/pattern-matcher.js';
import { BUILTIN_PATTERNS } from '../pattern/builtin-patterns.js';

/**
 * The field resolver translates a field word it knows into an English identifier,
 * and for a word it does not know it has to choose: emit the word verbatim, or
 * refuse. Emitting it verbatim is legal Spring — `Character.isLetter` accepts any
 * Unicode letter — but it is a guess about the caller's schema, so whichever way
 * it goes the guess must not be silent.
 */
const createMatcher = (fieldPolicy?: FieldPolicy): PatternMatcher =>
  new PatternMatcher(BUILTIN_PATTERNS, fieldPolicy === undefined ? {} : { fieldPolicy });

describe('field policy — passthrough (the default)', () => {
  const matcher = createMatcher();

  it('emits an unknown field word verbatim', () => {
    const result = matcher.match('姓名不为空');
    expect(result.spel).toBe('#姓名 != null');
  });

  it('reports the field word it could not resolve', () => {
    const result = matcher.match('姓名不为空');
    expect(result.unmappedFields).toEqual(['姓名']);
  });

  it('does not report a word the dictionary knows', () => {
    const result = matcher.match('备注为空');
    expect(result.spel).toBe('#remark == null');
    expect(result.unmappedFields).toBeUndefined();
  });

  it('does not report an ASCII identifier, which needs no translation', () => {
    const result = matcher.match('amount > 500');
    expect(result.spel).toBe('#amount > 500');
    expect(result.unmappedFields).toBeUndefined();
  });

  it('reports through matchAll as well as match', () => {
    const results = matcher.matchAll('姓名不为空', 3);
    expect(results.length).toBeGreaterThan(0);
    expect(results[0]!.unmappedFields).toEqual(['姓名']);
  });
});

describe('field policy — strict', () => {
  const matcher = createMatcher('strict');

  it('refuses an unknown field word instead of guessing', () => {
    expect(() => matcher.match('姓名不为空')).toThrow(UnmappedFieldError);
  });

  it('names the field it could not resolve', () => {
    let caught: unknown;
    try {
      matcher.match('姓名不为空');
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(UnmappedFieldError);
    expect((caught as UnmappedFieldError).field).toBe('姓名');
  });

  it('says how to proceed, so the error is actionable', () => {
    let caught: unknown;
    try {
      matcher.match('姓名不为空');
    } catch (error) {
      caught = error;
    }
    expect((caught as UnmappedFieldError).message).toContain('姓名');
    expect((caught as UnmappedFieldError).message).toContain('passthrough');
  });

  it('still resolves a word the dictionary knows', () => {
    const result = matcher.match('备注为空');
    expect(result.spel).toBe('#remark == null');
  });

  it('still accepts an ASCII identifier', () => {
    const result = matcher.match('amount > 500');
    expect(result.spel).toBe('#amount > 500');
  });

  it('applies only to unknown words, not to the rest of the sentence', () => {
    // 金额 is in the dictionary, so a strict matcher resolves it as usual.
    expect(matcher.match('金额大于1000').spel).toBe('#amount > 1000');
  });

  it('reports no unmapped fields when everything resolved', () => {
    expect(matcher.match('金额大于1000').unmappedFields).toBeUndefined();
  });
});
