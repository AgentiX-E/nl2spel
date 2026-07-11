import type { ContextSchema, SpelEvaluator } from '../SpelEvaluator.js';

// ============================================================
// Validation types
// ============================================================

export interface ValidationResult {
  /** Whether all validation stages passed */
  valid: boolean;

  /** Stage results */
  stages: {
    parse: StageResult;
    type: StageResult;
    semantic: StageResult;
    context: StageResult;
  };

  /** All errors */
  errors: ValidationError[];

  /** All warnings */
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
  /** Error position in expression */
  position?: number;
  /** Stage the error belongs to */
  stage: 'parse' | 'type' | 'semantic' | 'context';
  /** Whether LLM regeneration is needed */
  requiresLLM?: boolean;
}

export interface ValidationWarning {
  code: string;
  message: string;
  /** Warning position in expression */
  position?: number;
  /** Stage the warning belongs to */
  stage: 'parse' | 'type' | 'semantic' | 'context';
}

// ============================================================
// ValidationPipeline
// ============================================================

/**
 * ValidationPipeline — four-stage validation pipeline.
 *
 * 1. Parse: syntax validity (depends on SpelEvaluator)
 * 2. Type: type checking (operator-operand type matching)
 * 3. Semantic: semantic reasonableness (is the expression meaningful)
 * 4. Context: context references (do all references exist in ContextSchema)
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
   * Run the full validation pipeline
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
   * Stage 1: Parse Check — syntax validation
   */
  private async validateParse(expression: string): Promise<StageResult> {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // Basic empty expression check
    if (!expression || expression.trim().length === 0) {
      errors.push({
        code: 'PARSE-EMPTY',
        message: 'Expression is empty',
        stage: 'parse',
        requiresLLM: true,
      });
      return { passed: false, errors, warnings };
    }

    // Parentheses balance check
    if (!this.hasBalancedParentheses(expression)) {
      errors.push({
        code: 'PARSE-UNBALANCED_PARENS',
        message: 'Unbalanced parentheses in expression',
        stage: 'parse',
        requiresLLM: true,
      });
    }

    // Illegal character check
    if (expression.includes('===') || expression.includes('!==')) {
      errors.push({
        code: 'PARSE-JS_OPERATOR',
        message: 'JavaScript operators detected (=== or !==), use == or != in SpEL',
        stage: 'parse',
        requiresLLM: true,
      });
    }

    // Check for JS-style logical operators
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

    // If an evaluator is configured, perform actual syntax parsing
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
   * Stage 2: Type Check — type validation
   */
  private validateTypes(expression: string, contextSchema?: ContextSchema): StageResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // Check string vs number comparison (may require full ContextSchema support)
    // Here we do basic heuristic checks

    // Check if string literals are used with numeric operators
    const strNumMismatch = /'(?:\\.|[^'\\])*'\s*(?:>|<|>=|<=)\s*\d+/;
    if (strNumMismatch.test(expression)) {
      warnings.push({
        code: 'TYPE-STR_NUM_CMP',
        message: 'String literal compared with number using arithmetic operator',
        stage: 'type',
      });
    }

    // If ContextSchema is provided, do deeper checks
    if (contextSchema?.root) {
      for (const [fieldName, field] of Object.entries(contextSchema.root.fields)) {
        if (field.type === 'boolean') {
          // Check boolean field compared with number
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
   * Stage 3: Semantic Check — semantic reasonableness validation
   */
  private validateSemantic(expression: string): StageResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // Check for tautology/contradiction like `x == x`
    const selfCompare = /(#\w+(?:\.\w+)*)\s*==\s*\1/;
    if (selfCompare.test(expression)) {
      warnings.push({
        code: 'SEM-SELF_COMPARE',
        message: 'Self-comparison detected: expression is always true',
        stage: 'semantic',
      });
    }

    // Check for double negation (`!!`)
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
   * Stage 4: Context Check — context reference validation
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

    // Extract all references from expression
    const refs = this.extractReferences(expression);

    // Validate root references
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

    // Validate variable references
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

    // Validate Bean references
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
   * Check if parentheses are balanced
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
   * Extract all identifier references from expression
   */
  private extractReferences(expression: string): string[] {
    const refs: string[] = [];

    // #root.field pattern
    const varMatch = expression.matchAll(/#(\w+(?:\.\w+(?:\.\w+)?)?)/g);
    for (const m of varMatch) {
      refs.push(`#${m[1]!}`);
    }

    // #variable pattern
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
