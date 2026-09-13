import { NLIntent } from './nl-intent.js';
import { detectNullPredicate, type IntentResult } from './intent-classifier.js';
import type { ContextSchema } from '@agentix-e/spel-ts';

export interface TemplateResult {
  /** Generated SpEL expression */
  expression: string;

  /** Intent used */
  intent: NLIntent;

  /** Template name used */
  templateName: string;

  /** Confidence */
  confidence: number;

  /** Unfilled slots needing further LLM processing */
  unfilledSlots: string[];
}

interface TemplateEntry {
  name: string;
  template: string;
  conditions: {
    hasComparison?: boolean;
    hasNull?: boolean;
    hasCollection?: boolean;
    hasLogical?: boolean;
    hasString?: boolean;
    entityCount?: { min?: number };
  };
  confidence: number;
}

/**
 * Chinese field words → SpEL identifiers. Mirrors the pattern layer's mapping
 * so both layers resolve "备注" to the same "#...remark".
 */
const CHINESE_FIELD_MAP: Record<string, string> = {
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

/** Field words ordered longest-first so "文件名" wins over the "文件" prefix. */
const CHINESE_FIELDS_BY_LENGTH = Object.entries(CHINESE_FIELD_MAP).sort(
  (a, b) => b[0].length - a[0].length,
);

/** Identifier-like tokens that are keywords or roots, never field names. */
const FIELD_STOPWORDS = new Set([
  'a',
  'an',
  'account',
  'and',
  'are',
  'be',
  'between',
  'empty',
  'false',
  'file',
  'has',
  'have',
  'is',
  'no',
  'not',
  'null',
  'or',
  'order',
  'product',
  'than',
  'the',
  'true',
  'user',
  'value',
  'yes',
]);

/**
 * SpEL template library — each Intent maps to a set of templates.
 */
const TEMPLATE_LIBRARY: Record<NLIntent, TemplateEntry[]> = {
  [NLIntent.COMPARISON]: [
    {
      name: 'COMPARISON-SIMPLE',
      template: '#{root}.{field} {operator} {value}',
      conditions: { hasComparison: true, entityCount: { min: 1 } },
      confidence: 0.9,
    },
    {
      name: 'COMPARISON-DUAL',
      template:
        '(#{root}.{field1} {operator1} {value1}) {logic} (#{root}.{field2} {operator2} {value2})',
      conditions: { hasComparison: true, hasLogical: true, entityCount: { min: 2 } },
      confidence: 0.8,
    },
  ],

  [NLIntent.NULL_CHECK]: [
    {
      name: 'NULL-IS_NULL',
      template: '#{root}.{field} == null',
      conditions: { hasNull: true },
      confidence: 0.95,
    },
    {
      name: 'NULL-IS_NOT_NULL',
      template: '#{root}.{field} != null',
      conditions: { hasNull: true },
      confidence: 0.95,
    },
  ],

  [NLIntent.PERMISSION_CHECK]: [
    {
      name: 'PERM-HAS_ROLE',
      template: "hasRole('{role}')",
      conditions: {},
      confidence: 0.9,
    },
    {
      name: 'PERM-HAS_PERMISSION',
      template: "hasPermission('{permission}')",
      conditions: {},
      confidence: 0.9,
    },
  ],

  [NLIntent.LOGICAL]: [
    {
      name: 'LOGICAL-AND',
      template: '({left}) and ({right})',
      conditions: { hasLogical: true },
      confidence: 0.75,
    },
    {
      name: 'LOGICAL-OR',
      template: '({left}) or ({right})',
      conditions: { hasLogical: true },
      confidence: 0.75,
    },
    {
      name: 'LOGICAL-NOT',
      template: '!({expr})',
      conditions: { hasLogical: true },
      confidence: 0.85,
    },
  ],

  [NLIntent.STRING_MATCH]: [
    {
      name: 'STR-CONTAINS',
      template: "#{root}.{field}.contains('{substring}')",
      conditions: { hasString: true },
      confidence: 0.9,
    },
    {
      name: 'STR-STARTS_WITH',
      template: "#{root}.{field}.startsWith('{prefix}')",
      conditions: { hasString: true },
      confidence: 0.9,
    },
    {
      name: 'STR-ENDS_WITH',
      template: "#{root}.{field}.endsWith('{suffix}')",
      conditions: { hasString: true },
      confidence: 0.9,
    },
    {
      name: 'STR-MATCHES',
      template: "#{root}.{field} matches '{pattern}'",
      conditions: { hasString: true },
      confidence: 0.8,
    },
  ],

  [NLIntent.COLLECTION]: [
    {
      name: 'COLL-IS_EMPTY',
      template: '#{root}.{list}.isEmpty()',
      conditions: { hasCollection: true },
      confidence: 0.95,
    },
    {
      name: 'COLL-IS_NOT_EMPTY',
      template: '!#{root}.{list}.isEmpty()',
      conditions: { hasCollection: true },
      confidence: 0.9,
    },
    {
      name: 'COLL-SIZE',
      template: '#{root}.{list}.size() {operator} {value}',
      conditions: { hasCollection: true, hasComparison: true },
      confidence: 0.85,
    },
    {
      name: 'COLL-CONTAINS',
      template: "#{root}.{list}.contains('{element}')",
      conditions: { hasCollection: true },
      confidence: 0.9,
    },
  ],

  [NLIntent.RANGE]: [
    {
      name: 'RANGE-BETWEEN',
      template: '#{root}.{field} between {{{min}, {max}}}',
      conditions: { entityCount: { min: 1 } },
      confidence: 0.9,
    },
  ],

  [NLIntent.SELECTION]: [
    {
      name: 'SELECT-ALL',
      template: '#{root}.{list}.?[#{this}.{conditionField} {conditionOp} {conditionValue}]',
      conditions: {},
      confidence: 0.75,
    },
    {
      name: 'SELECT-FIRST',
      template: '#{root}.{list}.^[#{this}.{conditionField} {conditionOp} {conditionValue}]',
      conditions: {},
      confidence: 0.75,
    },
  ],

  [NLIntent.PROJECTION]: [
    {
      name: 'PROJ-FIELD',
      template: '#{root}.{list}.![#{this}.{field}]',
      conditions: {},
      confidence: 0.75,
    },
  ],

  [NLIntent.TYPE_CHECK]: [
    {
      name: 'TYPE-INSTANCEOF',
      template: '#{root}.{field} instanceof T({typeName})',
      conditions: {},
      confidence: 0.85,
    },
  ],

  [NLIntent.BOOLEAN]: [
    {
      name: 'BOOL-IS_TRUE',
      template: '#{root}.{field} == true',
      conditions: {},
      confidence: 0.9,
    },
    {
      name: 'BOOL-IS_FALSE',
      template: '#{root}.{field} == false',
      conditions: {},
      confidence: 0.9,
    },
    {
      name: 'BOOL-FIELD',
      template: '#{root}.{field}',
      conditions: {},
      confidence: 0.85,
    },
  ],

  [NLIntent.DATE]: [
    {
      name: 'DATE-AFTER',
      template: "#{root}.{field}.after(T(java.util.Date).valueOf('{date}'))",
      conditions: {},
      confidence: 0.85,
    },
    {
      name: 'DATE-BEFORE',
      template: "#{root}.{field}.before(T(java.util.Date).valueOf('{date}'))",
      conditions: {},
      confidence: 0.85,
    },
  ],

  [NLIntent.ELVIS]: [
    {
      name: 'ELVIS-DEFAULT',
      template: "#{root}.{field} ?: '{defaultValue}'",
      conditions: {},
      confidence: 0.8,
    },
  ],

  [NLIntent.ASSIGNMENT]: [
    {
      name: 'ASSIGN-SIMPLE',
      template: '#{root}.{field} = {value}',
      conditions: {},
      confidence: 0.8,
    },
  ],

  [NLIntent.ARITHMETIC]: [
    {
      name: 'ARITH-OP',
      template: '#{root}.{field1} {operator} #{root}.{field2}',
      conditions: {},
      confidence: 0.75,
    },
  ],
};

export class TemplateEngine {
  private contextSchema?: ContextSchema;

  constructor(contextSchema?: ContextSchema) {
    this.contextSchema = contextSchema;
  }

  public setContext(schema: ContextSchema): void {
    this.contextSchema = schema;
  }

  /**
   * Generate a SpEL expression based on intent classification results
   */
  public generate(input: string, intentResult: IntentResult): TemplateResult | null {
    const templates = TEMPLATE_LIBRARY[intentResult.primaryIntent];
    if (!templates || templates.length === 0) return null;

    const bestTemplate = this.selectBestTemplate(templates, intentResult, input);
    if (!bestTemplate) return null;

    const { expression, unfilledSlots } = this.fillTemplate(
      bestTemplate.template,
      input,
      intentResult,
    );

    return {
      expression,
      intent: intentResult.primaryIntent,
      templateName: bestTemplate.name,
      confidence: bestTemplate.confidence * (intentResult.intents[0]?.confidence ?? 0.5),
      unfilledSlots,
    };
  }

  private selectBestTemplate(
    templates: TemplateEntry[],
    intentResult: IntentResult,
    input: string,
  ): TemplateEntry | null {
    let bestScore = -1;
    let bestTemplate: TemplateEntry | null = null;

    // Input-specific heuristics.
    //
    // The previous regexes matched the negated phrase as well ("不为空" contains
    // "为空", and "not empty" contains "empty"), so both IS_NULL and
    // IS_NOT_NULL were boosted equally, they tied, and the first library entry
    // ("== null") always won. The predicate polarity is the only signal that
    // separates an affirmative check from a negated one.
    const polarity = detectNullPredicate(input);
    const isAffirmative = polarity === 'affirmative';
    const isNegated = polarity === 'negated';

    for (const template of templates) {
      const conditions = template.conditions;
      let score = 0;

      if (conditions.hasComparison && intentResult.operators.length > 0) score += 1;
      if (conditions.hasLogical && intentResult.logicalConnectors.length > 0) score += 1;
      if (conditions.hasCollection) score += 0.5;
      if (conditions.hasNull) score += 0.5;
      if (conditions.hasString) score += 1;

      // Boost the emptiness template whose polarity matches the input.
      if (template.name.includes('IS_EMPTY') && isAffirmative) score += 2;
      if (template.name.includes('IS_NOT_EMPTY') && isNegated) score += 2;

      // The two NULL templates carry identical conditions, so polarity is the
      // only thing that separates "== null" from "!= null".
      if (template.name === 'NULL-IS_NULL' && isAffirmative) score += 2;
      if (template.name === 'NULL-IS_NOT_NULL' && isNegated) score += 2;

      if (conditions.entityCount) {
        if (
          conditions.entityCount.min &&
          intentResult.entities.length < conditions.entityCount.min
        ) {
          continue;
        }
      }

      if (score > bestScore) {
        bestScore = score;
        bestTemplate = template;
      }
    }

    return bestTemplate;
  }

  private fillTemplate(
    template: string,
    input: string,
    intentResult: IntentResult,
  ): { expression: string; unfilledSlots: string[] } {
    let expression = template;
    const unfilledSlots: string[] = [];

    const rootName = this.resolveRootName(input);
    const fieldName = this.resolveFieldName(input);

    // Fill root
    expression = expression.replace(/\{root\}/g, rootName);
    expression = expression.replace(/\{field\}/g, fieldName);
    // Extract field entities for dual-field templates
    const fieldEntities = intentResult.entities.filter((e) => e.type === 'field');
    const field1Name = fieldEntities[0]?.text ?? fieldName;
    const field2Name = fieldEntities[1]?.text ?? fieldName;
    expression = expression.replace(/\{field1\}/g, field1Name);
    expression = expression.replace(/\{field2\}/g, field2Name);
    expression = expression.replace(/\{conditionField\}/g, 'condition');
    expression = expression.replace(/\{list\}/g, 'items');

    // Extract numeric entities
    const numberEntities = intentResult.entities.filter(
      (e) => e.type === 'value' && !isNaN(Number(e.text)),
    );
    const stringEntities = intentResult.entities.filter(
      (e) => e.type === 'value' && isNaN(Number(e.text)),
    );

    // Fill numeric values
    if (numberEntities.length > 0) {
      expression = expression.replace(/\{value\}/, numberEntities[0]!.text);
      expression = expression.replace(/\{value1\}/, numberEntities[0]!.text);
      expression = expression.replace(/\{value2\}/, (numberEntities[1] ?? numberEntities[0])!.text);
      expression = expression.replace(/\{min\}/, numberEntities[0]!.text);
      expression = expression.replace(/\{max\}/, (numberEntities[1] ?? numberEntities[0])!.text);
      expression = expression.replace(/\{conditionValue\}/, numberEntities[0]!.text);
    }

    // Fill string values
    if (stringEntities.length > 0) {
      expression = expression.replace(/\{substring\}/, stringEntities[0]!.text);
      expression = expression.replace(/\{element\}/, stringEntities[0]!.text);
      expression = expression.replace(/\{role\}/, stringEntities[0]!.text);
      expression = expression.replace(/\{permission\}/, stringEntities[0]!.text);
      expression = expression.replace(/\{prefix\}/, stringEntities[0]!.text);
      expression = expression.replace(/\{suffix\}/, stringEntities[0]!.text);
      expression = expression.replace(/\{pattern\}/, stringEntities[0]!.text);
      expression = expression.replace(/\{defaultValue\}/, stringEntities[0]!.text);
      expression = expression.replace(/\{date\}/, stringEntities[0]!.text);
      expression = expression.replace(/\{typeName\}/, stringEntities[0]!.text);
    }

    // Operator filling
    if (intentResult.operators.length > 0) {
      expression = expression.replace(/\{operator\}/g, intentResult.operators[0]!);
      expression = expression.replace(/\{operator1\}/g, intentResult.operators[0]!);
      expression = expression.replace(
        /\{operator2\}/g,
        intentResult.operators[1] ?? intentResult.operators[0]!,
      );
      expression = expression.replace(/\{conditionOp\}/g, intentResult.operators[0]!);
    }

    // Logical connectors
    if (intentResult.logicalConnectors.length > 0) {
      expression = expression.replace(/\{logic\}/g, intentResult.logicalConnectors[0]!);
    } else {
      expression = expression.replace(/\{logic\}/g, 'and');
    }

    // Detect unfilled slots
    const unfilledMatches = expression.matchAll(/\{(\w+)\}/g);
    for (const m of unfilledMatches) {
      const slot = m[1]!;
      const defaults: Record<string, string> = {
        operator: '==',
        operator1: '==',
        operator2: '==',
        logic: 'and',
        conditionOp: '==',
      };
      // Only fill with defaults in offline mode; keep as ${...} for LLM to handle
      if (defaults[slot]) {
        expression = expression.replace(new RegExp(`\\{${slot}\\}`, 'g'), defaults[slot]!);
      } else {
        unfilledSlots.push(slot);
        expression = expression.replace(new RegExp(`\\{${slot}\\}`, 'g'), `\${${slot}}`);
      }
    }

    return { expression, unfilledSlots };
  }

  /**
   * Resolve the SpEL root name for `input`: the configured schema root when one
   * exists, otherwise a keyword heuristic over the well-known roots.
   */
  private resolveRootName(input: string): string {
    if (this.contextSchema?.root) {
      return this.contextSchema.root.name;
    }

    const rootMap: Record<string, string> = {
      订单: 'order',
      order: 'order',
      用户: 'user',
      user: 'user',
      文件: 'file',
      file: 'file',
      账号: 'account',
      account: 'account',
      商品: 'item',
      product: 'item',
    };
    for (const [key, val] of Object.entries(rootMap)) {
      if (input.includes(key)) return val;
    }
    return 'order';
  }

  /**
   * Resolve the field name for `input`.
   *
   * The previous implementation only compared schema *keys* and otherwise left
   * the literal placeholder default in place, which is how "#order.field == null"
   * reached callers. The lookup now falls back in order: schema key, schema
   * field description (Chinese inputs name the field by its description),
   * Chinese field word, first English identifier, and finally "value" — the
   * neutral default the pattern layer already uses for an unknown field.
   */
  private resolveFieldName(input: string): string {
    const fields = this.contextSchema?.root?.fields;
    if (fields) {
      for (const [key, schema] of Object.entries(fields)) {
        if (input.includes(key)) return key;
        if (schema.description && input.includes(schema.description)) return key;
      }
    }

    for (const [word, field] of CHINESE_FIELDS_BY_LENGTH) {
      if (input.includes(word)) return field;
    }

    const tokens = input.match(/[A-Za-z_][A-Za-z0-9_]*/g) ?? [];
    for (const token of tokens) {
      if (!FIELD_STOPWORDS.has(token.toLowerCase())) return token;
    }

    return 'value';
  }
}
