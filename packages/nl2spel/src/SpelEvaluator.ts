/**
 * SpEL 求值器抽象接口
 *
 * nl2spel 核心包通过此接口进行：
 *   1. 语法验证（Parse Check）
 *   2. 类型验证（Type Check）
 *   3. 上下文验证（Context Check）
 *   4. 表达式求值（用于语义验证）
 *
 * nl2spel 本身不实现此接口，也不依赖任何具体实现。
 * 用户注入 spel-ts Adapter 或远程 API Adapter 或 mock。
 */
export interface SpelEvaluator {
  /**
   * 解析 SpEL 表达式并返回语法验证结果。
   * 对于语法错误的表达式，errors 数组非空。
   */
  parse(expression: string): ParseResult | Promise<ParseResult>;

  /**
   * 获取可用的上下文 Schema。
   * 返回 null 表示无上下文信息可用（仅语法验证，不做类型/上下文验证）。
   */
  getContextSchema(): ContextSchema | null | Promise<ContextSchema | null>;

  /**
   * 求值表达式（可选）。
   * 用于语义验证：用测试输入验证生成的表达式是否产生预期结果。
   * 不需要语义验证的场景可以不实现。
   */
  evaluate?(expression: string, context: Record<string, unknown>): unknown | Promise<unknown>;
}

/** 解析结果 */
export interface ParseResult {
  valid: boolean;
  errors: ParseError[];
  /** 解析成功时的 AST 表示（可选） */
  ast?: unknown;
}

export interface ParseError {
  message: string;
  position: number;
  /** 错误类型（可选，用于分类处理） */
  code?: string;
}

/**
 * 上下文 Schema —— 描述 SpEL 求值上下文的元数据。
 *
 * 用于：
 * 1. PromptBuilder: 构造 LLM Prompt 中的上下文信息
 * 2. ValidationPipeline: 验证表达式中的引用是否合法
 * 3. TemplateEngine: 槽位填充时匹配正确的字段名
 * 4. GBNFGenerator: 生成包含所有合法标识符的 GBNF 语法
 */
export interface ContextSchema {
  /** 根对象元信息 */
  root: RootObjectSchema | null;

  /** 变量声明 */
  variables: Record<string, VariableSchema>;

  /** Bean 声明 */
  beans: Record<string, BeanSchema>;

  /** 类型声明 */
  types: Record<string, TypeSchema>;

  /** 函数声明 */
  functions: Record<string, FunctionSchema>;
}

export interface RootObjectSchema {
  /** 根对象名称 (在 SpEL 中作为 #rootName 引用) */
  name: string;

  /** 根对象类型 */
  type: string;

  /** 根对象的字段 */
  fields: Record<string, FieldSchema>;

  /** 根对象的方法 */
  methods: Record<string, MethodSchema>;
}

export interface FieldSchema {
  /** SpEL 类型 */
  type: 'string' | 'number' | 'boolean' | 'date' | 'object' | 'array' | 'map';

  /** 字段描述（中文，用于语义匹配） */
  description?: string;

  /** 子字段 (如 type 为 object) */
  fields?: Record<string, FieldSchema>;

  /** 是否为集合 */
  isCollection?: boolean;

  /** 集合元素类型 */
  elementType?: string;

  /** 是否可为 null */
  nullable?: boolean;

  /** 示例值 */
  example?: unknown;
}

export interface VariableSchema {
  type: string;
  description?: string;
  nullable?: boolean;
  value?: unknown;
}

export interface BeanSchema {
  type: string;
  description?: string;
  singleton?: boolean;
}

export interface TypeSchema {
  className?: string;
  description?: string;
  methods?: Record<string, MethodSchema>;
  staticMethods?: Record<string, MethodSchema>;
}

export interface MethodSchema {
  returnType: string;
  params?: Array<{ name: string; type: string }>;
  description?: string;
}

export interface FunctionSchema {
  returnType: string;
  params: Array<{ name: string; type: string }>;
  description?: string;
}
