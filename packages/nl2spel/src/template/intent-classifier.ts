import { NLIntent } from './nl-intent.js';

/**
 * Intent classification result
 */
export interface IntentResult {
  /** Primary intent (highest confidence) */
  primaryIntent: NLIntent;

  /** All possible intents with confidence scores */
  intents: Array<{ intent: NLIntent; confidence: number }>;

  /** Extracted entities */
  entities: IntentEntity[];

  /** Recognized operators */
  operators: string[];

  /** Recognized logical connectors */
  logicalConnectors: string[];

  /** Complexity score (0-100) */
  complexity: number;
}

export interface IntentEntity {
  text: string;
  type: 'field' | 'value' | 'operator' | 'logic' | 'quantifier';
  position: { start: number; end: number };
}

/**
 * Intent keyword mapping table
 */
const INTENT_KEYWORDS: Record<NLIntent, { zh: string[]; en: string[] }> = {
  [NLIntent.COMPARISON]: {
    zh: [
      '大于',
      '小于',
      '等于',
      '超过',
      '低于',
      '不小于',
      '不大于',
      '大于等于',
      '小于等于',
      '不等于',
    ],
    en: ['greater', 'less', 'equal', 'above', 'below', 'exceed', '>', '<', '==', '!=', '>=', '<='],
  },
  [NLIntent.NULL_CHECK]: {
    zh: ['为空', '不为空', '是空', '存在', '不存在', 'null', '没有值'],
    en: ['null', 'empty', 'is null', 'is not null', 'is empty', 'is not empty'],
  },
  [NLIntent.PERMISSION_CHECK]: {
    zh: ['角色', '权限', '管理员', '可以', '允许', '禁止', '拒绝'],
    en: ['role', 'permission', 'can', 'allow', 'deny', 'has role', 'has permission'],
  },
  [NLIntent.LOGICAL]: {
    zh: ['且', '并且', '同时', '或', '或者', '非', '不是', '也不'],
    en: ['and', 'or', 'not', '&&', '||', '!'],
  },
  [NLIntent.STRING_MATCH]: {
    zh: ['包含', '含有', '包括', '以...开头', '以...结尾', '匹配', '符合', '正则', '开头', '结尾'],
    en: ['contains', 'includes', 'starts with', 'ends with', 'matches', 'regex'],
  },
  [NLIntent.COLLECTION]: {
    zh: ['列表', '数组', '集合', '大小', '长度', 'isEmpty', '为空', '不为空', '项', 'items'],
    en: ['list', 'array', 'collection', 'size', 'length', 'count', 'isempty', 'empty', 'items'],
  },
  [NLIntent.RANGE]: {
    zh: ['之间', '范围', '介于', 'between'],
    en: ['between', 'range', 'from...to'],
  },
  [NLIntent.SELECTION]: {
    zh: ['筛选', '选择', '所有满足', '第一个满足', '符合条件的'],
    en: ['select', 'filter', 'first', 'matching'],
  },
  [NLIntent.PROJECTION]: {
    zh: ['每个', '所有', '全部', '投影'],
    en: ['each', 'every', 'project'],
  },
  [NLIntent.TYPE_CHECK]: {
    zh: ['是否是', '类型', 'instanceof'],
    en: ['instanceof', 'type of', 'is a'],
  },
  [NLIntent.BOOLEAN]: {
    zh: ['是否', '真假', 'true', 'false', '是', '否'],
    en: ['true', 'false', 'yes', 'no', 'is', 'is not'],
  },
  [NLIntent.DATE]: {
    zh: ['日期', '时间', '之后', '之前', '早于', '晚于'],
    en: ['date', 'time', 'after', 'before', 'earlier', 'later'],
  },
  [NLIntent.ELVIS]: {
    zh: ['或者', '默认值', '兜底', '默认', '否则'],
    en: ['default', 'fallback', 'or', 'otherwise'],
  },
  [NLIntent.ASSIGNMENT]: {
    zh: ['设置', '赋值', '赋予', '设定'],
    en: ['set', 'assign', 'put'],
  },
  [NLIntent.ARITHMETIC]: {
    zh: ['加', '减', '乘', '除', '取模', '求和', '平均值', '总和'],
    en: ['plus', 'minus', 'multiply', 'divide', 'mod', 'sum', 'average'],
  },
};

export class IntentClassifier {
  /**
   * Main method for classifying natural language input
   */
  public classify(input: string): IntentResult {
    const normalized = this.normalize(input);

    // Step 1: Keyword matching → intent scoring
    const intentScores = new Map<NLIntent, number>();
    for (const intent of Object.keys(INTENT_KEYWORDS) as NLIntent[]) {
      const keywords = INTENT_KEYWORDS[intent];
      let score = 0;
      for (const kw of keywords.zh) {
        if (normalized.includes(kw)) score += 3;
      }
      for (const kw of keywords.en) {
        if (normalized.toLowerCase().includes(kw.toLowerCase())) score += 2;
      }
      if (score > 0) intentScores.set(intent, score);
    }

    // Pattern-based boosting
    // If both LOGICAL and COMPARISON detected, LOGICAL gets bonus (combination intent)
    if (intentScores.has(NLIntent.LOGICAL) && intentScores.has(NLIntent.COMPARISON)) {
      intentScores.set(NLIntent.LOGICAL, (intentScores.get(NLIntent.LOGICAL) ?? 0) + 2);
    }
    // Boost RANGE if "between X and Y" pattern found
    if (/between\s+\S+\s+(and|,)\s+\S+/i.test(normalized)) {
      intentScores.set(NLIntent.RANGE, (intentScores.get(NLIntent.RANGE) ?? 0) + 3);
    }
    // Boost TYPE_CHECK if "instanceof" or type keywords present
    if (/instanceof/i.test(normalized) || (/是否是/.test(normalized) && /类型/.test(normalized))) {
      intentScores.set(NLIntent.TYPE_CHECK, (intentScores.get(NLIntent.TYPE_CHECK) ?? 0) + 3);
    }
    // Boost PROJECTION if explicit projection keywords
    if (/每个/.test(normalized) || /each/.test(normalized)) {
      intentScores.set(NLIntent.PROJECTION, (intentScores.get(NLIntent.PROJECTION) ?? 0) + 2);
    }
    // COLLECTION boost if collection-specific keywords present
    if (/isempty|\.isEmpty|列表|数组|集合/.test(normalized)) {
      intentScores.set(NLIntent.COLLECTION, (intentScores.get(NLIntent.COLLECTION) ?? 0) + 1);
    }

    // Step 2: Entity extraction
    const entities = this.extractEntities(normalized);

    // Step 3: Operator recognition
    const operators = this.extractOperators(normalized);

    // Step 4: Logical connector recognition
    const logicalConnectors = this.extractLogicalConnectors(normalized);

    // Step 5: Complexity scoring
    const complexity = this.calculateComplexity(
      normalized,
      intentScores,
      entities,
      operators,
      logicalConnectors,
    );

    // Step 6: Sort intents
    const sortedIntents = Array.from(intentScores.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([intent, score]) => ({
        intent,
        confidence: Math.min(score / 15, 1.0),
      }));

    return {
      primaryIntent: sortedIntents[0]?.intent ?? NLIntent.COMPARISON,
      intents:
        sortedIntents.length > 0
          ? sortedIntents
          : [{ intent: NLIntent.COMPARISON, confidence: 0.3 }],
      entities,
      operators,
      logicalConnectors,
      complexity,
    };
  }

  /**
   * Entity extraction
   */
  private extractEntities(normalized: string): IntentEntity[] {
    const entities: IntentEntity[] = [];

    // Numeric value extraction
    const numRegex = /\b(\d+(?:\.\d+)?)\b/g;
    let match;
    while ((match = numRegex.exec(normalized)) !== null) {
      entities.push({
        text: match[1]!,
        type: 'value',
        position: { start: match.index, end: match.index + match[1]!.length },
      });
    }

    // Quoted string extraction
    const strRegex = /['""]([^'""]*)['""]/g;
    while ((match = strRegex.exec(normalized)) !== null) {
      entities.push({
        text: match[1]!,
        type: 'value',
        position: { start: match.index, end: match.index + match[0]!.length },
      });
    }

    // Operator position extraction
    for (const op of ['>=', '<=', '!=', '==', '>', '<', '=']) {
      let idx = normalized.indexOf(op);
      if (idx >= 0) {
        entities.push({
          text: op,
          type: 'operator',
          position: { start: idx, end: idx + op.length },
        });
      }
    }

    return entities;
  }

  /**
   * Operator recognition
   */
  private extractOperators(normalized: string): string[] {
    const operators: string[] = [];

    const OP_MAP: Array<{ pattern: RegExp; op: string }> = [
      { pattern: /大于等于|>=|≥/, op: '>=' },
      { pattern: /小于等于|<=|≤/, op: '<=' },
      { pattern: /不等于|!=|≠/, op: '!=' },
      { pattern: /等于|==/, op: '==' },
      { pattern: /大于|>/, op: '>' },
      { pattern: /小于|</, op: '<' },
      { pattern: /匹配|match/, op: 'matches' },
      { pattern: /之间|between/, op: 'between' },
      { pattern: /包含|contains/, op: 'contains' },
    ];

    for (const { pattern, op } of OP_MAP) {
      if (pattern.test(normalized)) {
        operators.push(op);
      }
    }

    return operators;
  }

  /**
   * Logical connector recognition
   */
  private extractLogicalConnectors(normalized: string): string[] {
    const connectors: string[] = [];

    // Skip "and" detection when it's part of "between X and Y"
    const isBetween = /between\s+\d+(\s*,\s*|\s+and\s+)\d+/i.test(normalized);

    if (/且|并且|and|&&/i.test(normalized) && !isBetween) connectors.push('and');
    if (/或|或者|or|\|\|/i.test(normalized)) connectors.push('or');
    if (/非|不是|不|not|!/i.test(normalized)) connectors.push('not');

    return connectors;
  }

  /**
   * Complexity calculation
   */
  private calculateComplexity(
    input: string,
    intentScores: Map<NLIntent, number>,
    entities: IntentEntity[],
    operators: string[],
    logicalConnectors: string[],
  ): number {
    let complexity = 0;

    // Base: input length
    complexity += Math.min(input.length / 5, 15);

    // Multiple intents hit → higher complexity
    complexity += (intentScores.size - 1) * 10;

    // Logical connectors
    complexity += logicalConnectors.length * 15;

    // Entity count
    complexity += entities.length * 5;

    // Operator count
    complexity += operators.length * 8;

    return Math.max(0, Math.min(complexity, 100));
  }

  /**
   * Input normalization
   */
  private normalize(input: string): string {
    return (
      input
        .trim()
        .toLowerCase()
        // Full-width to half-width
        .replace(/[\uFF01-\uFF5E]/g, ch => String.fromCharCode(ch.charCodeAt(0) - 0xfee0))
        .replace(/\s+/g, ' ')
    );
  }
}
