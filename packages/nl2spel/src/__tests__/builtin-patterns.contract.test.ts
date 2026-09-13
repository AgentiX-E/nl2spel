import { describe, it, expect } from 'vitest';
import { SpelExpressionParser } from '@agentix-e/spel-ts';
import { PatternMatcher } from '../pattern/pattern-matcher.js';
import { BUILTIN_PATTERNS } from '../pattern/builtin-patterns.js';

/**
 * Contract for the built-in pattern library.
 *
 * Each pattern declares its own `examples`; this suite treats those as the
 * oracle and holds the implementation to them. Every example is checked against
 * an *isolated* matcher (`new PatternMatcher([pattern])`) because
 * `PatternMatcher.match()` returns the single highest-priority match across the
 * whole library, which may be a different pattern than the one under test.
 * Isolation makes each assertion about that pattern's own contract.
 *
 * The parser is imported so that a "successful" match cannot emit SpEL that
 * Spring itself would reject.
 */

const parser = new SpelExpressionParser();

describe('BUILTIN_PATTERNS contract', () => {
  it('declares a unique, non-empty id for every pattern', () => {
    const counts = new Map<string, number>();
    for (const pattern of BUILTIN_PATTERNS) {
      counts.set(pattern.id, (counts.get(pattern.id) ?? 0) + 1);
    }

    const failures: string[] = [];
    for (const pattern of BUILTIN_PATTERNS) {
      if (pattern.id.length === 0) failures.push('(empty id)');
      else if ((counts.get(pattern.id) ?? 0) > 1) failures.push(`${pattern.id} (duplicate)`);
    }
    expect(failures).toEqual([]);
  });

  it('declares at least one example for every pattern', () => {
    const failures = BUILTIN_PATTERNS.filter((pattern) => pattern.examples.length === 0).map(
      (pattern) => pattern.id,
    );
    expect(failures).toEqual([]);
  });

  it('reproduces every example exactly through its own pattern in isolation', () => {
    const failures: string[] = [];
    for (const pattern of BUILTIN_PATTERNS) {
      const isolated = new PatternMatcher([pattern]);
      for (const example of pattern.examples) {
        const result = isolated.match(example.nl);
        const produced = result.matched ? String(result.spel) : '(no match)';
        if (produced !== example.spel) {
          failures.push(
            `${pattern.id}: nl=${JSON.stringify(example.nl)} ` +
              `declared=${JSON.stringify(example.spel)} produced=${JSON.stringify(produced)}`,
          );
        }
      }
    }
    expect(failures).toEqual([]);
  });

  it('emits SpEL that the SpEL parser accepts for every example', () => {
    const failures: string[] = [];
    for (const pattern of BUILTIN_PATTERNS) {
      for (const example of pattern.examples) {
        try {
          parser.parseExpression(example.spel);
        } catch (error) {
          failures.push(`${pattern.id}: ${JSON.stringify(example.spel)} -> ${(error as Error).message}`);
        }
      }
    }
    expect(failures).toEqual([]);
  });

  it('only uses declared slots or the built-in placeholders in spelTemplate', () => {
    const builtinPlaceholders = ['field', 'root', 'op'];
    const failures: string[] = [];
    for (const pattern of BUILTIN_PATTERNS) {
      const substituted = pattern.spelTemplate.replace(/\{(field|root|op)\}/g, 'X');
      const remaining = substituted.match(/\{[a-zA-Z_]+\}/g) ?? [];
      for (const placeholder of remaining) {
        const key = placeholder.slice(1, -1);
        const declared =
          Object.prototype.hasOwnProperty.call(pattern.slots, key) || builtinPlaceholders.includes(key);
        if (!declared) {
          failures.push(`${pattern.id}: ${placeholder} is neither a slot nor a built-in placeholder`);
        }
      }
    }
    expect(failures).toEqual([]);
  });
});
