import type { LLMPrompt, FewShotExample } from '../../provider/llm-provider.js';
import type { ContextSchema } from '../../SpelEvaluator.js';
import { SchemaFormatter } from '../../context/schema-formatter.js';

// ============================================================
// System Prompts
// ============================================================

const SYSTEM_PROMPT_ZH = `你是一个 Spring Expression Language (SpEL) 专家。你的任务是将自然语言描述转换为精确的 SpEL 表达式。

## 规则
1. SpEL 使用 #variable 引用变量，使用 #root.field 引用根对象的字段
2. 字符串字面量使用单引号：'value'
3. 空值比较：== null 或 != null
4. 逻辑运算符：and、or、not（不是 &&、||、!）
5. 比较运算符：==、!=、>、<、>=、<=
6. 三元运算符使用 Elvis 语法：value ?: default
7. 方法调用：list.contains('item')、list.size()、list.isEmpty()
8. 集合投影：list.?[condition]、list.^[condition]、list.![projection]
9. 范围检查：value between {min, max}
10. 类型检查：variable instanceof T(ClassName)
11. 权限检查：hasRole('role')、hasPermission('permission')
12. 日期比较：field.after(T(java.util.Date).valueOf('date'))、field.before(...)

## 输出格式
只输出 SpEL 表达式，不要包含任何解释或注释。`;

const SYSTEM_PROMPT_EN = `You are a Spring Expression Language (SpEL) expert. Convert natural language descriptions into precise SpEL expressions.

## Rules
1. SpEL uses #variable for variables, #root.field for root object fields
2. String literals use single quotes: 'value'
3. Null comparison: == null or != null
4. Logical operators: and, or, not (NOT &&, ||, !)
5. Comparison operators: ==, !=, >, <, >=, <=
6. Elvis operator for defaults: value ?: default
7. Method calls: list.contains('item'), list.size(), list.isEmpty()
8. Collection projection: list.?[condition], list.^[condition], list.![projection]
9. Range check: value between {min, max}
10. Type check: variable instanceof T(ClassName)
11. Permission check: hasRole('role'), hasPermission('permission')
12. Date comparison: field.after(T(java.util.Date).valueOf('date')), field.before(...)

## Output Format
Output ONLY the SpEL expression. No explanation, no markdown.`;

// ============================================================
// SpEL EBNF Grammar Block
// ============================================================

const SPEL_EBNF_GRAMMAR = `
## SpEL EBNF (simplified)
expression       := logicalOr
logicalOr        := logicalAnd ('or' logicalAnd)*
logicalAnd       := equality ('and' equality)*
equality         := relational (('==' | '!=') relational)?
relational       := additive (('>' | '<' | '>=' | '<=') additive)?
additive         := multiplicative (('+' | '-') multiplicative)*
multiplicative   := unary (('*' | '/' | '%') unary)*
unary            := ('not' | '!')? primary
primary          := literal | reference | method | '(' expression ')'
                 | projection | selection | elvis | typeExpr
literal          := number | string | 'true' | 'false' | 'null'
string           := "'" (char)* "'"
number           := [0-9]+ ('.' [0-9]+)?
reference        := '#' identifier ('.' identifier)*
method           := reference '.'? identifier '(' args? ')'
projection       := reference '.[' projectionExpr ']'
selection        := reference '.?[' expr ']' | reference '.^[' expr ']'
elvis            := expression '?:' expression
typeExpr         := 'T(' qualifiedName ')'
identifier       := [a-zA-Z_][a-zA-Z0-9_]*
`;

// ============================================================
// Few-Shot Examples (20 examples covering easy/medium/hard)
// ============================================================

const FEWSHOT_EXAMPLES: FewShotExample[] = [
  // Easy (9 examples)
  {
    nl: '订单金额大于1000',
    spel: '#order.amount > 1000',
    difficulty: 'easy',
    category: 'comparison',
  },
  { nl: 'amount > 500', spel: '#order.amount > 500', difficulty: 'easy', category: 'comparison' },
  {
    nl: '订单状态是已发货',
    spel: "#order.status == '已发货'",
    difficulty: 'easy',
    category: 'comparison',
  },
  {
    nl: 'status equals completed',
    spel: "#order.status == 'completed'",
    difficulty: 'easy',
    category: 'comparison',
  },
  { nl: '备注为空', spel: '#order.remark == null', difficulty: 'easy', category: 'null_check' },
  {
    nl: 'remark is null',
    spel: '#order.remark == null',
    difficulty: 'easy',
    category: 'null_check',
  },
  {
    nl: '用户拥有管理员角色',
    spel: "hasRole('管理员')",
    difficulty: 'easy',
    category: 'permission',
  },
  {
    nl: 'user has admin role',
    spel: "hasRole('admin')",
    difficulty: 'easy',
    category: 'permission',
  },
  {
    nl: '标签包含VIP',
    spel: "#order.tags.contains('VIP')",
    difficulty: 'easy',
    category: 'collection',
  },

  // Medium (7 examples)
  {
    nl: '金额大于100且订单已确认',
    spel: "#order.amount > 100 and #order.status == '已确认'",
    difficulty: 'medium',
    category: 'logical',
  },
  {
    nl: 'amount > 100 and status == done',
    spel: "#order.amount > 100 and #order.status == 'done'",
    difficulty: 'medium',
    category: 'logical',
  },
  {
    nl: '金额大于500或已发货',
    spel: "#order.amount > 500 or #order.status == '已发货'",
    difficulty: 'medium',
    category: 'logical',
  },
  {
    nl: '年龄在18到60之间',
    spel: '#user.age between {18, 60}',
    difficulty: 'medium',
    category: 'range',
  },
  {
    nl: 'amount between 100 and 500',
    spel: '#order.amount between {100, 500}',
    difficulty: 'medium',
    category: 'range',
  },
  {
    nl: '订单备注包含加急',
    spel: "#order.remark.contains('加急')",
    difficulty: 'medium',
    category: 'string',
  },
  {
    nl: 'name contains test',
    spel: "#order.name.contains('test')",
    difficulty: 'medium',
    category: 'string',
  },

  // Hard (4 examples)
  {
    nl: '金额大于1000且状态为已发货且用户是VIP',
    spel: "#order.amount > 1000 and #order.status == '已发货' and #user.vip == true",
    difficulty: 'hard',
    category: 'complex_logical',
  },
  {
    nl: '筛选出所有金额大于1000的订单',
    spel: '#order.items.?[#this.amount > 1000]',
    difficulty: 'hard',
    category: 'selection',
  },
  {
    nl: 'amount > 500 and (status == done or status == shipped)',
    spel: "#order.amount > 500 and (#order.status == 'done' or #order.status == 'shipped')",
    difficulty: 'hard',
    category: 'complex_logical',
  },
  {
    nl: '订单中第一个金额大于1000的商品',
    spel: '#order.items.^[#this.amount > 1000]',
    difficulty: 'hard',
    category: 'selection',
  },
];

// ============================================================
// PromptBuilder
// ============================================================

export interface PromptBuilderOptions {
  /** 语言 (zh/en) */
  language?: 'zh' | 'en';
  /** 是否包含 EBNF 语法块 */
  includeEBNF?: boolean;
}

export class PromptBuilder {
  private readonly formatter = new SchemaFormatter();

  /**
   * 构建完整的 LLM Prompt
   */
  public build(
    userInput: string,
    contextSchema?: ContextSchema,
    options: PromptBuilderOptions = {},
  ): LLMPrompt {
    const lang = options.language ?? 'zh';
    const includeEBNF = options.includeEBNF ?? true;

    const systemPrompt = lang === 'zh' ? SYSTEM_PROMPT_ZH : SYSTEM_PROMPT_EN;

    // 构建 user prompt
    const parts: string[] = [this.buildExamples(lang)];

    if (contextSchema && contextSchema.root) {
      parts.push(this.formatter.formatForLLM(contextSchema));
    }

    if (includeEBNF) {
      parts.push(SPEL_EBNF_GRAMMAR);
    }

    parts.push(`## User Input\n${userInput}\n\n## SpEL Expression\n`);

    const user = parts.join('\n\n');

    return {
      system: systemPrompt,
      user,
      contextSchema: contextSchema ?? {
        root: null,
        variables: {},
        beans: {},
        types: {},
        functions: {},
      },
      examples: FEWSHOT_EXAMPLES,
    };
  }

  /**
   * 构建 Few-Shot 示例字符串
   */
  private buildExamples(lang: 'zh' | 'en'): string {
    const lines: string[] = [];

    const examples =
      lang === 'zh'
        ? FEWSHOT_EXAMPLES
        : FEWSHOT_EXAMPLES.filter(
            e =>
              // Include all English-leaning examples
              e.nl === e.nl.toLowerCase() ||
              e.category === 'comparison' ||
              e.category === 'logical',
          );

    if (lang === 'zh') {
      lines.push('## 示例 (Few-Shot Examples)');
    } else {
      lines.push('## Few-Shot Examples');
    }

    for (const example of examples) {
      lines.push(`NL: ${example.nl}`);
      lines.push(`SpEL: ${example.spel}`);
      lines.push('');
    }

    return lines.join('\n');
  }
}
