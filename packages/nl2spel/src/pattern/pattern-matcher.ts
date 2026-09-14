import type { PatternDefinition } from './pattern-definition.js';
import { ChineseNumberParser } from '../utils/chinese-number-parser.js';

/**
 * How to treat a field word the dictionary does not know.
 *
 * `passthrough` emits the word verbatim, which is legal Spring — `Character.isLetter`
 * accepts any Unicode letter — and is the default, because a caller whose schema
 * uses Chinese property names depends on it. `strict` refuses instead, for callers
 * who would rather see an error than an unresolved name.
 */
export type FieldPolicy = 'passthrough' | 'strict';

/** Thrown under `strict` when a field word has no dictionary entry. */
export class UnmappedFieldError extends Error {
  /** The field word that could not be resolved. */
  public readonly field: string;

  constructor(field: string) {
    super(
      `No field mapping for '${field}'. Add a mapping, or use fieldPolicy ` +
        `'passthrough' to emit it verbatim.`,
    );
    this.name = 'UnmappedFieldError';
    this.field = field;
  }
}

export interface PatternMatcherOptions {
  /** How to treat a field word with no dictionary entry. Default `passthrough`. */
  fieldPolicy?: FieldPolicy;
}

export interface PatternMatchResult {
  /** Whether matched */
  matched: boolean;
  /** The matching PatternDefinition */
  pattern?: PatternDefinition;
  /** Generated SpEL expression (if matched) */
  spel?: string;
  /** Confidence (0-1) */
  confidence: number;
  /** Match latency (ms) */
  latencyMs: number;
  /** Extracted slot values */
  slots?: Record<string, string>;

  /**
   * Field words emitted verbatim because the dictionary had no entry, in
   * encounter order. Populated under either policy, so a caller can always see
   * what was not resolved rather than having to infer it.
   */
  unmappedFields?: string[];
}

/**
 * PatternMatcher — Layer 0 pattern matching core.
 */
/**
 * The Chinese → English field dictionary.
 *
 * A word listed here is emitted as its English identifier. A word that is not
 * listed is emitted verbatim and reported as unmapped — see `resolveField`.
 *
 * This dictionary is a convenience, not a specification: it cannot know the
 * caller's schema. Callers who would rather fail than guess should use
 * `fieldPolicy: 'strict'`, and callers whose schema really does use Chinese
 * property names should use the default `passthrough`.
 */
const CN_FIELD_MAP: Readonly<Record<string, string>> = {
  备注: 'remark',
  说明: 'description',
  描述: 'description',
  金额: 'amount',
  数量: 'count',
  个数: 'count',
  状态: 'status',
  类型: 'type',
  名称: 'name',
  标题: 'title',
  地址: 'address',
  邮箱: 'email',
  手机: 'phone',
  电话: 'phone',
  日期: 'date',
  时间: 'time',
  年龄: 'age',
  价格: 'price',
  用户名: 'name',
  权限: 'role',
  标签: 'tags',
  列表: 'list',
  数组: 'items',
  文件: 'file',
  文件名: 'name',
  过期: 'expiryDate',
  创建: 'createdAt',
  有效: 'valid',
  活跃: 'active',
  激活: 'active',
};

/** Punctuation that carries no meaning at the end of an input, stripped during normalization. */
const TRAILING_PUNCTUATION = /[，,。.!！?？;；:：]/;

/**
 * Remove trailing punctuation by scanning from the end.
 *
 * The obvious `replace(/[...]+$/, '')` is quadratic on input that does not end in a run of
 * punctuation: the engine retries the quantified class from every offset before the anchor
 * finally fails, which measured 2.5 ms at 2 000 characters and 155 ms at 16 000 — four times the
 * work for twice the input — on natural-language text, which is not under this library's
 * control. This visits each character once and is in a loop rather than a regex for that reason.
 */
function stripTrailingPunctuation(text: string): string {
  let end = text.length;
  while (end > 0 && TRAILING_PUNCTUATION.test(text.charAt(end - 1))) {
    end--;
  }
  return end === text.length ? text : text.slice(0, end);
}

export class PatternMatcher {
  private _patterns: PatternDefinition[];
  private readonly fieldPolicy: FieldPolicy;

  constructor(patterns: PatternDefinition[] = [], options: PatternMatcherOptions = {}) {
    this._patterns = [...patterns];
    this.fieldPolicy = options.fieldPolicy ?? 'passthrough';
    this.sortByPriority();
  }

  public get patternCount(): number {
    return this._patterns.length;
  }

  public register(pattern: PatternDefinition): void {
    this._patterns.push(pattern);
    this.sortByPriority();
  }

  public registerAll(patterns: PatternDefinition[]): void {
    this._patterns.push(...patterns);
    this.sortByPriority();
  }

  private sortByPriority(): void {
    this._patterns.sort((a, b) => b.priority - a.priority);
  }

  /**
   * Match natural language input, return the best match
   */
  public match(nl: string): PatternMatchResult {
    const startTime = Date.now();
    const normalized = this.normalize(nl);

    for (const pattern of this._patterns) {
      const matchResult = pattern.match.exec(normalized);
      if (!matchResult) continue;

      const slots: Record<string, string> = {};
      if (matchResult.groups) {
        for (const [key, value] of Object.entries(matchResult.groups)) {
          if (value !== undefined) {
            slots[key] = value;
          }
        }
      }

      const { expression, unmappedFields } = this.fillTemplate(
        pattern,
        slots,
        normalized,
        matchResult,
      );
      const latencyMs = Date.now() - startTime;

      return {
        matched: true,
        pattern,
        spel: expression,
        confidence: pattern.confidence,
        latencyMs,
        slots,
        ...(unmappedFields.length > 0 ? { unmappedFields } : {}),
      };
    }

    const latencyMs = Date.now() - startTime;
    return { matched: false, confidence: 0, latencyMs };
  }

  /**
   * Batch match
   */
  public matchAll(nl: string, maxResults: number = 5): PatternMatchResult[] {
    const normalized = this.normalize(nl);
    const results: PatternMatchResult[] = [];

    for (const pattern of this._patterns) {
      if (results.length >= maxResults) break;

      const matchResult = pattern.match.exec(normalized);
      if (!matchResult) continue;

      const slots: Record<string, string> = {};
      if (matchResult.groups) {
        for (const [key, value] of Object.entries(matchResult.groups)) {
          if (value !== undefined) slots[key] = value;
        }
      }

      const { expression, unmappedFields } = this.fillTemplate(
        pattern,
        slots,
        normalized,
        matchResult,
      );
      results.push({
        matched: true,
        pattern,
        spel: expression,
        confidence: pattern.confidence,
        latencyMs: 0,
        slots,
        ...(unmappedFields.length > 0 ? { unmappedFields } : {}),
      });
    }

    return results;
  }

  /**
   * Input normalization
   */
  private normalize(input: string): string {
    return stripTrailingPunctuation(
      input
        .trim()
        .replace(/[\uFF01-\uFF5E]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xfee0))
        .replace(/\s+/g, ' '),
    );
  }

  /**
   * Infer SpEL root object name from Chinese input
   */
  private inferRoot(input: string): string {
    if (/^(?:订单|order)/i.test(input)) return 'order';
    if (/^(?:用户|user)/i.test(input)) return 'user';
    if (/^(?:文件|file)/i.test(input)) return 'file';
    if (/^(?:账号|account)/i.test(input)) return 'account';
    if (/^(?:商品|product|item)/i.test(input)) return 'product';
    return 'order';
  }

  /**
   * The first whitespace- or punctuation-delimited chunk of `input`.
   */
  private firstWord(input: string): string {
    const m = input.match(/^[^\s，,、]+/);
    return m ? m[0]! : 'value';
  }

  /**
   * Extract Chinese field names from input and map to SpEL fields
   */
  private extractChineseField(input: string): string {
    const first = this.firstWord(input);
    return CN_FIELD_MAP[first] ?? first;
  }

  /**
   * Resolve a captured field word into the identifier to emit, and report whether
   * the dictionary recognised it.
   *
   * An ASCII word is already an identifier and is emitted unchanged. Anything else
   * is looked up: a word the dictionary knows becomes its English identifier, and a
   * word it does not know is emitted verbatim and reported as unmapped. Emitting it
   * verbatim is legal Spring, but it is a guess about the caller's schema, so the
   * guess is never silent.
   */
  private resolveField(captured: string): { field: string; mapped: boolean } {
    if (/^[a-zA-Z_]\w*$/.test(captured)) {
      return { field: captured, mapped: true };
    }
    const first = this.firstWord(captured);
    const mapped = CN_FIELD_MAP[first];
    return { field: mapped ?? first, mapped: mapped !== undefined };
  }

  /**
   * Template filling and value transformation
   */
  private fillTemplate(
    pattern: PatternDefinition,
    slots: Record<string, string>,
    originalInput: string,
    _matchResult: RegExpExecArray,
  ): { expression: string; unmappedFields: string[] } {
    let result = pattern.spelTemplate;
    const hasFieldSlot = 'field' in slots;
    const unmappedFields: string[] = [];

    // field: prefer capture group 'field', otherwise infer from input. An inferred
    // field is a guess at the whole sentence rather than a field the caller named,
    // so only a captured word is held to the field policy.
    let field: string;
    if (hasFieldSlot) {
      const resolved = this.resolveField(slots['field']!);
      if (!resolved.mapped) {
        if (this.fieldPolicy === 'strict') {
          throw new UnmappedFieldError(resolved.field);
        }
        unmappedFields.push(resolved.field);
      }
      field = resolved.field;
    } else {
      field = this.extractChineseField(originalInput);
    }

    // root: infer from input
    const root = this.inferRoot(originalInput);

    result = result.replace(/\{field\}/g, field);
    result = result.replace(/\{root\}/g, root);

    // Replace operator placeholder {op}
    if (originalInput.includes('>=') || originalInput.includes('≥')) {
      result = result.replace(/\{op\}/g, '>=');
    } else if (originalInput.includes('<=') || originalInput.includes('≤')) {
      result = result.replace(/\{op\}/g, '<=');
    } else if (originalInput.includes('!=') || originalInput.includes('≠')) {
      result = result.replace(/\{op\}/g, '!=');
    } else if (
      originalInput.includes('>') ||
      originalInput.includes('大于') ||
      originalInput.includes('超过')
    ) {
      result = result.replace(/\{op\}/g, '>');
    } else if (
      originalInput.includes('<') ||
      originalInput.includes('小于') ||
      originalInput.includes('低于')
    ) {
      result = result.replace(/\{op\}/g, '<');
    } else {
      result = result.replace(/\{op\}/g, '>');
    }

    // Replace specific slots
    for (const [key, value] of Object.entries(slots)) {
      if (key === 'field') continue; // field already handled
      const def = pattern.slots[key];
      let transformedValue = value;

      if (def?.transform === 'toNumber') {
        const cnNumber = ChineseNumberParser.parseSafe(value);
        transformedValue = cnNumber !== null ? String(cnNumber) : value;
      }

      result = result.replace(`{${key}}`, transformedValue ?? '');
    }

    // Clean up unfilled placeholders
    result = result.replace(/\{[a-zA-Z_]+\}/g, '');

    return { expression: result.trim(), unmappedFields };
  }
}
