import type { ContextSchema, SpelEvaluator } from '../SpelEvaluator.js';

// ============================================================
// Validation 类型
// ============================================================

export interface ValidationResult {
  /** 是否通过所有验证阶段 */
  valid: boolean;

  /** 各阶段结果 */
  stages: {
    parse: StageResult;
    type: StageResult;
    semantic: StageResult;
    context: StageResult;
  };

  /** 所有错误 */
  errors: ValidationError[];

  /** 所有警告 */
  warnings: ValidationWarning[];
}

export interface StageResult {
  passed: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export interface ValidationError {
  code: string;
  message: string;
  /** 错误在表达式中的位置 */
  position?: number;
  /** 错误所属阶段 */
  stage: 'parse' | 'type' | 'semantic' | 'context';
  /** 是否需要 LLM 重新生成 */
  requiresLLM?: boolean;
}

export interface ValidationWarning {
  code: string;
  message: string;
  /** 警告在表达式中的位置 */
  position?: number;
  /** 警告所属阶段 */
  stage: 'parse' | 'type' | 'semantic' | 'context';
}

// ============================================================
// ValidationPipeline
// ============================================================

/**
 * ValidationPipeline — 四阶段验证管道。
 *
 * 1. Parse: 语法合法性（依赖 SpelEvaluator）
 * 2. Type: 类型检查（操作符与操作数类型匹配）
 * 3. Semantic: 语义合理性（表达式是否有意义）
 * 4. Context: 上下文引用（所有引用是否存在于 ContextSchema）
 */
export class ValidationPipeline {
  private evaluator: SpelEvaluator | null;

  constructor(evaluator: SpelEvaluator | null = null) {
    this.evaluator = evaluator;
  }

  public setEvaluator(evaluator: SpelEvaluator): void {
    this.evaluator = evaluator;
  }

  /**
   * 运行完整验证管道
   */
  public async validate(
    expression: string,
    contextSchema?: ContextSchema,
  ): Promise<ValidationResult> {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // Stage 1: Parse Check
    const parseStage = await this.validateParse(expression);

    // Stage 2: Type Check
    const typeStage = this.validateTypes(expression, contextSchema);

    // Stage 3: Semantic Check
    const semanticStage = this.validateSemantic(expression);

    // Stage 4: Context Check
    const contextStage = this.validateContext(expression, contextSchema);

    errors.push(
      ...parseStage.errors,
      ...typeStage.errors,
      ...semanticStage.errors,
      ...contextStage.errors,
    );
    warnings.push(
      ...parseStage.warnings,
      ...typeStage.warnings,
      ...semanticStage.warnings,
      ...contextStage.warnings,
    );

    return {
      valid: parseStage.passed && typeStage.passed && semanticStage.passed && contextStage.passed,
      stages: {
        parse: parseStage,
        type: typeStage,
        semantic: semanticStage,
        context: contextStage,
      },
      errors,
      warnings,
    };
  }

  /**
   * Stage 1: Parse Check — 语法验证
   */
  private async validateParse(expression: string): Promise<StageResult> {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // 基本空表达式检查
    if (!expression || expression.trim().length === 0) {
      errors.push({
        code: 'PARSE-EMPTY',
        message: 'Expression is empty',
        stage: 'parse',
        requiresLLM: true,
      });
      return { passed: false, errors, warnings };
    }

    // 括号匹配检查
    if (!this.hasBalancedParentheses(expression)) {
      errors.push({
        code: 'PARSE-UNBALANCED_PARENS',
        message: 'Unbalanced parentheses in expression',
        stage: 'parse',
        requiresLLM: true,
      });
    }

    // 非法字符检查
    if (expression.includes('===') || expression.includes('!==')) {
      errors.push({
        code: 'PARSE-JS_OPERATOR',
        message: 'JavaScript operators detected (=== or !==), use == or != in SpEL',
        stage: 'parse',
        requiresLLM: true,
      });
    }

    // 检查 JS 风格逻辑运算符
    if (expression.includes('&&')) {
      errors.push({
        code: 'PARSE-JS_LOGIC',
        message: 'JavaScript && detected, use "and" in SpEL',
        stage: 'parse',
        requiresLLM: true,
      });
    }

    if (expression.includes('||')) {
      errors.push({
        code: 'PARSE-JS_LOGIC',
        message: 'JavaScript || detected, use "or" in SpEL',
        stage: 'parse',
        requiresLLM: true,
      });
    }

    // 如果配置了 evaluator，进行实际语法解析
    if (this.evaluator) {
      try {
        const parseResult = await this.evaluator.parse(expression);
        if (!parseResult.valid) {
          for (const pe of parseResult.errors) {
            errors.push({
              code: `PARSE-${pe.code ?? 'SYNTAX'}`,
              message: pe.message,
              position: pe.position,
              stage: 'parse',
              requiresLLM: true,
            });
          }
        }
      } catch (err) {
        errors.push({
          code: 'PARSE-EXCEPTION',
          message: `Parse threw exception: ${(err as Error).message}`,
          stage: 'parse',
          requiresLLM: true,
        });
      }
    }

    return {
      passed: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Stage 2: Type Check — 类型验证
   */
  private validateTypes(expression: string, contextSchema?: ContextSchema): StageResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // 字符串与数值比较检查（可能需要严格的上下文Schema支持）
    // 这里做基础启发式检查

    // 检查是否有字符串字面量与数值运算符一起使用
    const strNumMismatch = /'(?:\\.|[^'\\])*'\s*(?:>|<|>=|<=)\s*\d+/;
    if (strNumMismatch.test(expression)) {
      warnings.push({
        code: 'TYPE-STR_NUM_CMP',
        message: 'String literal compared with number using arithmetic operator',
        stage: 'type',
      });
    }

    // 如果提供了 ContextSchema，可以做更深入的检查
    if (contextSchema?.root) {
      for (const [fieldName, field] of Object.entries(contextSchema.root.fields)) {
        if (field.type === 'boolean') {
          // 检查 bool 字段是否与数值比较
          const boolNumPattern = new RegExp(`#\\w+\\.${fieldName}\\s*(?:>|<|>=|<=)\\s*\\d+`);
          if (boolNumPattern.test(expression)) {
            warnings.push({
              code: 'TYPE-BOOL_NUM_CMP',
              message: `Boolean field '${fieldName}' compared with number`,
              stage: 'type',
            });
          }
        }
      }
    }

    return {
      passed: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Stage 3: Semantic Check — 语义合理性验证
   */
  private validateSemantic(expression: string): StageResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // 检查是否有类似于 `x == x` 的恒真/恒假表达式
    const selfCompare = /(#\w+(?:\.\w+)*)\s*==\s*\1/;
    if (selfCompare.test(expression)) {
      warnings.push({
        code: 'SEM-SELF_COMPARE',
        message: 'Self-comparison detected: expression is always true',
        stage: 'semantic',
      });
    }

    // 检查是否有双重否定（`!!`)
    if (expression.includes('!!')) {
      warnings.push({
        code: 'SEM-DOUBLE_NEGATION',
        message: 'Double negation detected, consider simplifying',
        stage: 'semantic',
      });
    }

    return {
      passed: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Stage 4: Context Check — 上下文引用验证
   */
  private validateContext(expression: string, contextSchema?: ContextSchema): StageResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    if (!contextSchema) {
      warnings.push({
        code: 'CTX-NO_SCHEMA',
        message: 'No ContextSchema provided, skipping context validation',
        stage: 'context',
      });
      return { passed: true, errors, warnings };
    }

    // 提取表达式中的所有引用
    const refs = this.extractReferences(expression);

    // 验证 root 引用
    if (contextSchema.root) {
      const rootName = contextSchema.root.name;
      for (const ref of refs) {
        if (ref.startsWith(`#${rootName}`)) {
          const parts = ref.split('.');
          const field = parts[1];
          if (field && !(field in contextSchema.root.fields)) {
            warnings.push({
              code: 'CTX-UNKNOWN_FIELD',
              message: `Field '${field}' not found in root '${rootName}'`,
              stage: 'context',
            });
          }
        }
      }
    }

    // 验证变量引用
    for (const ref of refs) {
      if (ref.startsWith('#') && !ref.includes('.')) {
        const varName = ref.slice(1);
        const isRoot = contextSchema.root?.name === varName;
        const isVariable = varName in contextSchema.variables;
        const isFunction = varName in contextSchema.functions;
        if (!isRoot && !isVariable && !isFunction) {
          warnings.push({
            code: 'CTX-UNKNOWN_REF',
            message: `Unknown reference '${ref}'`,
            stage: 'context',
          });
        }
      }
    }

    // 验证 Bean 引用
    const beanMatch = expression.match(/@(\w+)/g);
    if (beanMatch && contextSchema.beans) {
      for (const b of beanMatch) {
        const beanName = b.slice(1);
        if (!(beanName in contextSchema.beans)) {
          warnings.push({
            code: 'CTX-UNKNOWN_BEAN',
            message: `Bean '${beanName}' not found in ContextSchema`,
            stage: 'context',
          });
        }
      }
    }

    return {
      passed: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * 检查括号是否平衡
   */
  private hasBalancedParentheses(expression: string): boolean {
    const stack: string[] = [];
    const pairs: Record<string, string> = { '(': ')', '[': ']', '{': '}' };

    for (const ch of expression) {
      if (ch in pairs) {
        stack.push(ch);
      } else if (ch === ')' || ch === ']' || ch === '}') {
        const last = stack.pop();
        if (!last || pairs[last] !== ch) return false;
      }
    }

    return stack.length === 0;
  }

  /**
   * 提取表达式中的所有标识符引用
   */
  private extractReferences(expression: string): string[] {
    const refs: string[] = [];

    // #root.field 模式
    const varMatch = expression.matchAll(/#(\w+(?:\.\w+(?:\.\w+)?)?)/g);
    for (const m of varMatch) {
      refs.push(`#${m[1]!}`);
    }

    // #variable 模式
    const simpleMatch = expression.matchAll(/#(\w+)(?!\w*\()/g);
    for (const m of simpleMatch) {
      const ref = `#${m[1]!}`;
      if (!refs.includes(ref)) {
        refs.push(ref);
      }
    }

    return refs;
  }
}
