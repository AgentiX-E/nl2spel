import { NLIntent } from './nl-intent.js';
import type { IntentResult } from './intent-classifier.js';
import type { ContextSchema } from '../SpelEvaluator.js';

export interface TemplateResult {
  /** 生成的 SpEL 表达式 */
  expression: string;

  /** 使用的意图 */
  intent: NLIntent;

  /** 使用的模板名称 */
  templateName: string;

  /** 置信度 */
  confidence: number;

  /** 需要进一步 LLM 处理的未填充槽位 */
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
    entityCount?: { min?: number; max?: number };
  };
  confidence: number;
}

/**
 * SpEL 模板库 —— 每个 Intent 对应一组模板。
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
   * 根据意图分类结果生成 SpEL 表达式
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

    // Input-specific heuristics
    const hasEmptyKeyword = /为空|empty|null/i.test(input);
    const hasNotEmptyKeyword = /不为空|not empty|not null/i.test(input);

    for (const template of templates) {
      const conditions = template.conditions;
      let score = 0;

      if (conditions.hasComparison && intentResult.operators.length > 0) score += 1;
      if (conditions.hasLogical && intentResult.logicalConnectors.length > 0) score += 1;
      if (conditions.hasCollection) score += 0.5;
      if (conditions.hasNull) score += 0.5;
      if (conditions.hasString) score += 1;

      // Boost isEmpty template when input has empty keywords
      if (template.name.includes('IS_EMPTY') && hasEmptyKeyword) score += 2;
      if (template.name.includes('IS_NOT_EMPTY') && hasNotEmptyKeyword) score += 2;

      if (conditions.entityCount) {
        if (
          conditions.entityCount.min &&
          intentResult.entities.length < conditions.entityCount.min
        ) {
          continue;
        }
        if (
          conditions.entityCount.max &&
          intentResult.entities.length > conditions.entityCount.max
        ) {
          score -= 1;
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

    // 从 contextSchema 提取 root 名称
    let rootName = 'order';
    let fieldName = 'field';

    if (this.contextSchema?.root) {
      rootName = this.contextSchema.root.name;
      const fields = Object.keys(this.contextSchema.root.fields ?? {});
      for (const f of fields) {
        if (input.includes(f)) {
          fieldName = f;
          break;
        }
      }
    } else {
      // 启发式 root name 提取
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
        if (input.includes(key)) {
          rootName = val;
          break;
        }
      }
    }

    // 填充 root
    expression = expression.replace(/\{root\}/g, rootName);
    expression = expression.replace(/\{field\}/g, fieldName);
    expression = expression.replace(/\{field1\}/g, 'field1');
    expression = expression.replace(/\{field2\}/g, 'field2');
    expression = expression.replace(/\{conditionField\}/g, 'condition');
    expression = expression.replace(/\{list\}/g, 'items');

    // 提取数值实体
    const numberEntities = intentResult.entities.filter(
      e => e.type === 'value' && !isNaN(Number(e.text)),
    );
    const stringEntities = intentResult.entities.filter(
      e => e.type === 'value' && isNaN(Number(e.text)),
    );

    // 填充数值
    if (numberEntities.length > 0) {
      expression = expression.replace(/\{value\}/, numberEntities[0]!.text);
      expression = expression.replace(/\{value1\}/, numberEntities[0]!.text);
      expression = expression.replace(/\{value2\}/, (numberEntities[1] ?? numberEntities[0])!.text);
      expression = expression.replace(/\{min\}/, numberEntities[0]!.text);
      expression = expression.replace(/\{max\}/, (numberEntities[1] ?? numberEntities[0])!.text);
      expression = expression.replace(/\{conditionValue\}/, numberEntities[0]!.text);
    }

    // 填充字符串
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

    // 运算符填充
    if (intentResult.operators.length > 0) {
      expression = expression.replace(/\{operator\}/g, intentResult.operators[0]!);
      expression = expression.replace(/\{operator1\}/g, intentResult.operators[0]!);
      expression = expression.replace(
        /\{operator2\}/g,
        intentResult.operators[1] ?? intentResult.operators[0]!,
      );
      expression = expression.replace(/\{conditionOp\}/g, intentResult.operators[0]!);
    }

    // 逻辑连接词
    if (intentResult.logicalConnectors.length > 0) {
      expression = expression.replace(/\{logic\}/g, intentResult.logicalConnectors[0]!);
    } else {
      expression = expression.replace(/\{logic\}/g, 'and');
    }

    // 检测未填充槽位
    const unfilledMatches = expression.matchAll(/\{(\w+)\}/g);
    for (const m of unfilledMatches) {
      const slot = m[1]!;
      unfilledSlots.push(slot);
      expression = expression.replace(new RegExp(`\\{${slot}\\}`, 'g'), `\${${slot}}`);
    }

    return { expression, unfilledSlots };
  }
}
