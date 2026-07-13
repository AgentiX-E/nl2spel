import type { PatternDefinition } from './pattern-definition.js';
import { ChineseNumberParser } from '../utils/chinese-number-parser.js';

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
}

/**
 * PatternMatcher — Layer 0 pattern matching core.
 */
export class PatternMatcher {
  private _patterns: PatternDefinition[];

  constructor(patterns: PatternDefinition[] = []) {
    this._patterns = [...patterns];
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

      const spel = this.fillTemplate(pattern, slots, normalized, matchResult);
      const latencyMs = Date.now() - startTime;

      return { matched: true, pattern, spel, confidence: pattern.confidence, latencyMs, slots };
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

      results.push({
        matched: true,
        pattern,
        spel: this.fillTemplate(pattern, slots, normalized, matchResult),
        confidence: pattern.confidence,
        latencyMs: 0,
        slots,
      });
    }

    return results;
  }

  /**
   * Input normalization
   */
  private normalize(input: string): string {
    return input
      .trim()
      .replace(/[\uFF01-\uFF5E]/g, ch => String.fromCharCode(ch.charCodeAt(0) - 0xfee0))
      .replace(/\s+/g, ' ')
      .replace(/[，,。.!！?？;；:：]+$/, '');
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
   * Extract Chinese field names from input and map to SpEL fields
   */
  private extractChineseField(input: string): string {
    // Extract first word chunk as field identifier
    const m = input.match(/^[^\s，,、]+/);
    if (!m) return 'value';

    const first = m[0]!;

    // If input already contains a SpEL field name, return it directly
    // Otherwise preserve the original word for template filling
    // Common Chinese → English mapping
    const cnMap: Record<string, string> = {
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

    return cnMap[first] ?? first;
  }

  /**
   * Template filling and value transformation
   */
  private fillTemplate(
    pattern: PatternDefinition,
    slots: Record<string, string>,
    originalInput: string,
    _matchResult: RegExpExecArray,
  ): string {
    let result = pattern.spelTemplate;
    const hasFieldSlot = 'field' in slots;

    // field: prefer capture group 'field', otherwise infer from input
    const field = hasFieldSlot
      ? this.inferFieldFromCapture(slots['field']!)
      : this.extractChineseField(originalInput);

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

    return result.trim();
  }

  /**
   * Infer SpEL field name from capture group
   */
  private inferFieldFromCapture(captured: string): string {
    // If already an English identifier, return as-is
    if (/^[a-zA-Z_]\w*$/.test(captured)) return captured;
    // Chinese, attempt mapping
    return this.extractChineseField(captured);
  }
}
