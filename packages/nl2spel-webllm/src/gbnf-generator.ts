import type { ContextSchema } from '@agentix-e/nl2spel';

export interface GBNFGeneratorOptions {
  /** 是否注入 ContextSchema 中的标识符 (默认 true) */
  injectContext?: boolean;
  /** 是否限制表达式类型 (默认不限制) */
  restrictTo?: 'expression' | 'boolean' | 'number' | 'string';
}

/**
 * GBNFGenerator — 动态生成 llama.cpp 兼容的 GBNF 语法约束。
 *
 * GBNF 格式规范:
 * - root ::= "<expression-type>"  (顶层规则)
 * - 规则名: [a-zA-Z_][a-zA-Z0-9_]*
 * - 字面量: "text"
 * - 字符类: [a-z], [0-9], [a-zA-Z]
 * - 分组: (pattern)
 * - 交替: pattern | pattern
 * - 重复: pattern* (0+), pattern+ (1+), pattern? (0-1)
 */
export class GBNFGenerator {
  private contextSchema?: ContextSchema;
  private options: Required<GBNFGeneratorOptions>;

  constructor(options: GBNFGeneratorOptions = {}) {
    this.options = {
      injectContext: options.injectContext ?? true,
      restrictTo: options.restrictTo ?? 'expression',
    };
  }

  /**
   * 设置 ContextSchema
   */
  public setContext(schema: ContextSchema): void {
    this.contextSchema = schema;
  }

  /**
   * 生成完整的 GBNF 语法
   */
  public generate(schema?: ContextSchema): string {
    if (schema) this.contextSchema = schema;

    const rules: string[] = [];

    // 顶层规则（根据 restrictTo 选择）
    if (this.options.restrictTo === 'boolean') {
      rules.push('root ::= boolean-expr');
    } else {
      rules.push('root ::= expression');
    }

    // ===== 基础词法 =====
    rules.push('');
    rules.push('# Lexical rules');
    rules.push('digit ::= [0-9]');
    rules.push('nonzero-digit ::= [1-9]');
    rules.push('letter ::= [a-zA-Z]');
    rules.push('letter-or-digit ::= [a-zA-Z0-9]');
    rules.push('underscore ::= "_"');

    // ===== 数字 =====
    rules.push('');
    rules.push('# Numbers');
    rules.push('integer ::= "0" | nonzero-digit digit*');
    rules.push('decimal ::= integer "." digit+');
    rules.push('number ::= decimal | integer');

    // ===== 字符串 =====
    rules.push('');
    rules.push('# Strings (single-quoted, supports escaped single quotes)');
    rules.push('string-char ::= [^' + "'" + '\\\\] | "\'\'"');
    rules.push('string ::= "\'" string-char* "\'"');

    // ===== 布尔 & null =====
    rules.push('');
    rules.push('# Booleans and null');
    rules.push('boolean-literal ::= "true" | "false"');
    rules.push('null-literal ::= "null"');
    rules.push('literal ::= number | string | boolean-literal | null-literal');

    // ===== 标识符 =====
    rules.push('');
    rules.push('# Identifiers');
    if (this.options.injectContext && this.contextSchema) {
      rules.push(...this.generateIdentifierRules());
    } else {
      rules.push('identifier ::= letter (letter-or-digit | underscore)*');
      rules.push('qualified-identifier ::= identifier ("." identifier)*');
    }

    rules.push('variable-ref ::= "#" identifier');
    rules.push('field-ref ::= "#" identifier ("." identifier)+');

    // ===== 类型引用 =====
    rules.push('');
    rules.push('# Type references (T(ClassName))');
    rules.push('type-ref ::= "T(" qualified-identifier ")"');

    // ===== Bean 引用 =====
    rules.push('');
    rules.push('# Bean references (@beanName)');
    rules.push('bean-ref ::= "@" identifier');

    // ===== 方法调用 =====
    rules.push('');
    rules.push('# Method calls');
    rules.push(
      'method-name ::= "contains" | "isEmpty" | "size" | "startsWith" | "endsWith" | "matches" | "after" | "before" | "valueOf"',
    );
    rules.push('method-call ::= "." method-name "(" (expression ("," expression)*)? ")"');
    rules.push('method-call-chain ::= reference method-call+');
    rules.push('reference ::= variable-ref | field-ref | bean-ref | literal | "(" expression ")"');

    // ===== 集合投影和选择 =====
    rules.push('');
    rules.push('# Collection projection and selection');
    rules.push('selection ::= collection-ref ".?[" expression "]"');
    rules.push('first-selection ::= collection-ref ".^[" expression "]"');
    rules.push('projection ::= collection-ref ".![" expression "]"');
    rules.push('collection-ref ::= field-ref | variable-ref');

    // ===== 函数调用 =====
    rules.push('');
    rules.push('# Function calls');
    rules.push('func-name ::= "hasRole" | "hasPermission"');
    rules.push('function-call ::= func-name "(" string ("," expression)* ")"');

    // ===== 操作符优先级（从低到高，EBNF → GBNF） =====
    rules.push('');
    rules.push('# Operators');

    // primary: 最基本的表达式
    rules.push(
      'primary ::= literal | reference | type-ref | function-call | selection | first-selection | projection | "(" expression ")"',
    );

    // unary: 一元运算符
    rules.push('unary ::= ("!" | "not" ws) primary | primary');
    rules.push('ws ::= [ ]?');

    // multiplicative: 乘除取模
    rules.push('multiplicative ::= unary (ws ("*" | "/" | "%") ws unary)?');

    // additive: 加减
    rules.push('additive ::= multiplicative (ws ("+" | "-") ws multiplicative)?');

    // relational: 比较
    rules.push('relational ::= additive (ws (">=" | "<=" | ">" | "<") ws additive)?');

    // equality: 相等
    rules.push('equality-dot ::= "==" | "!="');
    rules.push('equality ::= relational (ws equality-dot ws relational)?');

    // between: 范围
    rules.push('between ::= relational ws "between" ws "{" ws number ws "," ws number ws "}"');

    // logical-and: 逻辑与
    rules.push('logical-and ::= (between | equality) (ws "and" ws (between | equality))*');

    // logical-or: 逻辑或
    rules.push('logical-or ::= logical-and (ws "or" ws logical-and)*');

    // elvis: 默认值
    rules.push('elvis ::= logical-or (ws "?:" ws logical-or)?');

    // 顶层 expression
    rules.push('expression ::= elvis');

    // boolean expression 类型（用于条件）
    rules.push('');
    rules.push('# Boolean-specific expressions');
    rules.push('boolean-expr ::= logical-or (ws "?:" ws logical-or)?');

    return rules.join('\n');
  }

  /**
   * 生成 ContextSchema 注入的标识符规则
   */
  private generateIdentifierRules(): string[] {
    const rules: string[] = [];
    const schema = this.contextSchema!;

    // 收集所有合法标识符
    const identifiers: string[] = [
      'order',
      'user',
      'amount',
      'status',
      'paid',
      'remark',
      'items',
      'tags',
    ];

    if (schema.root) {
      identifiers.push(schema.root.name);
      for (const field of Object.keys(schema.root.fields)) {
        identifiers.push(field);
      }
    }

    for (const key of Object.keys(schema.variables)) {
      identifiers.push(key);
    }

    for (const key of Object.keys(schema.beans)) {
      identifiers.push(key);
    }

    for (const key of Object.keys(schema.types)) {
      identifiers.push(key);
    }

    // 去重
    const uniqueIds = [...new Set(identifiers)];

    // 生成 identifier 规则（GBNF string alternation）
    if (uniqueIds.length > 0) {
      const idRules = uniqueIds.map(id => `"${id}"`).join(' | ');
      rules.push(`identifier ::= (${idRules}) | general-identifier`);
      rules.push('general-identifier ::= letter (letter-or-digit | underscore)*');
    } else {
      rules.push('identifier ::= letter (letter-or-digit | underscore)*');
    }

    // root-field: 注入 root 对象的字段（使语法约束更精确）
    if (schema.root && schema.root.fields) {
      const fieldNames = Object.keys(schema.root.fields);
      if (fieldNames.length > 0) {
        const fieldRule = fieldNames.map(f => `"${f}"`).join(' | ');
        // GBNF 不支持嵌套引用，所以我们用扁平化的方式
        // root-field 在 expression 中通过 field-ref 使用
      }
    }

    rules.push('qualified-identifier ::= identifier ("." identifier)*');

    return rules;
  }

  /**
   * 生成结构化的 GBNF（含注释和分组）
   */
  public generateStructured(schema?: ContextSchema): GBNFStructure {
    if (schema) this.contextSchema = schema;

    const grammar = this.generate();
    const lines = grammar.split('\n');

    const sections: GBNFSection[] = [];
    let currentSection: GBNFSection | null = null;

    for (const line of lines) {
      if (line.startsWith('# ')) {
        if (currentSection) sections.push(currentSection);
        currentSection = {
          name: line.slice(2).trim(),
          rules: [],
        };
      } else if (line.trim() && currentSection) {
        currentSection.rules.push(line.trim());
      }
    }

    if (currentSection) sections.push(currentSection);

    return {
      rootRule:
        sections.find(s => s.rules.some(r => r.startsWith('root')))?.rules[0] ??
        'root ::= expression',
      sections,
      ruleCount: lines.filter(l => l.includes('::=') && !l.startsWith('#')).length,
    };
  }
}

export interface GBNFSection {
  name: string;
  rules: string[];
}

export interface GBNFStructure {
  rootRule: string;
  sections: GBNFSection[];
  ruleCount: number;
}
