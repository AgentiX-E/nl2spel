import type { ContextSchema, SpelEvaluator } from '@agentix-e/spel-ts';
import { TokenKind, Tokenizer } from '@agentix-e/spel-ts';
import { maskStringLiterals } from './auto-fixer.js';

// ============================================================
// Validation types
// ============================================================

/** Stage a diagnostic was produced by. */
export type ValidationStage = 'parse' | 'type' | 'semantic' | 'context' | 'final';

/** Whether a diagnostic rejects the expression or merely observes it. */
export type ValidationSeverity = 'error' | 'warning';

export interface ValidationResult {
  /** Whether all validation stages passed */
  valid: boolean;

  /** Stage results */
  stages: {
    parse: StageResult;
    type: StageResult;
    semantic: StageResult;
    context: StageResult;
    final: StageResult;
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
  /** Severity of this diagnostic — always `error`. */
  severity?: ValidationSeverity;
  /** Error position in expression */
  position?: number;
  /** Stage the error belongs to */
  stage: ValidationStage;
  /** Whether LLM regeneration is needed */
  requiresLLM?: boolean;
}

export interface ValidationWarning {
  code: string;
  message: string;
  /** Severity of this diagnostic — always `warning`. */
  severity?: ValidationSeverity;
  /** Warning position in expression */
  position?: number;
  /** Stage the warning belongs to */
  stage: ValidationStage;
}

// ============================================================
// ValidationPipeline
// ============================================================

/**
 * ValidationPipeline — five-stage validation pipeline.
 *
 * 1. Parse: syntax validity (empty, delimiter balance, JS operators, evaluator)
 *    2. Type: type checking (operator-operand type matching) — advisory
 *    3. Semantic: semantic reasonableness — advisory
 *    4. Context: context references (do all references exist in ContextSchema)
 *    5. Final: the expression must parse — structural completeness gate
 *
 * Stages 1, 4 and 5 can reject an expression; the type and semantic stages only
 * observe. Reference checks are only meaningful when a schema is supplied,
 * because without one an undeclared `#unknownRef` and a legitimate runtime
 * variable are indistinguishable.
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

    // Stage 5: Final Check — the generated expression must parse
    const finalStage = this.validateFinal(expression);

    errors.push(
      ...parseStage.errors,
      ...typeStage.errors,
      ...semanticStage.errors,
      ...contextStage.errors,
      ...finalStage.errors,
    );
    warnings.push(
      ...parseStage.warnings,
      ...typeStage.warnings,
      ...semanticStage.warnings,
      ...contextStage.warnings,
      ...finalStage.warnings,
    );

    return {
      valid: errors.length === 0,
      stages: {
        parse: parseStage,
        type: typeStage,
        semantic: semanticStage,
        context: contextStage,
        final: finalStage,
      },
      errors,
      warnings,
    };
  }

  /**
   * Stage 1: Parse Check — syntax validation
   *
   * Delimiter balance and JavaScript operators are checked against a copy of
   * the expression with string literals blanked out, so literal text can never
   * be mistaken for syntax.
   */
  private async validateParse(expression: string): Promise<StageResult> {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    const structural = maskStringLiterals(expression);

    // Basic empty expression check
    if (!expression || expression.trim().length === 0) {
      errors.push({
        code: 'PARSE-EMPTY',
        message: 'Expression is empty',
        severity: 'error',
        stage: 'parse',
        requiresLLM: true,
      });
      return { passed: false, errors, warnings };
    }

    // Parentheses balance check
    if (!this.hasBalancedParentheses(structural)) {
      errors.push({
        code: 'PARSE-UNBALANCED_PARENS',
        message: 'Unbalanced parentheses in expression',
        severity: 'error',
        stage: 'parse',
        requiresLLM: true,
      });
    }

    // Illegal character check
    if (structural.includes('===') || structural.includes('!==')) {
      errors.push({
        code: 'PARSE-JS_OPERATOR',
        message: 'JavaScript operators detected (=== or !==), use == or != in SpEL',
        severity: 'error',
        stage: 'parse',
        requiresLLM: true,
      });
    }

    // Check for JS-style logical operators
    if (structural.includes('&&')) {
      errors.push({
        code: 'PARSE-JS_LOGIC',
        message: 'JavaScript && detected, use "and" in SpEL',
        severity: 'error',
        stage: 'parse',
        requiresLLM: true,
      });
    }

    if (structural.includes('||')) {
      errors.push({
        code: 'PARSE-JS_LOGIC',
        message: 'JavaScript || detected, use "or" in SpEL',
        severity: 'error',
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
              severity: 'error',
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
          severity: 'error',
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
   * Stage 2: Type Check — advisory type validation
   */
  private validateTypes(expression: string, contextSchema?: ContextSchema): StageResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    const structural = maskStringLiterals(expression);

    // Check string vs number comparison. A string literal compared with a
    // numeric literal in either order is almost certainly a mistake, but it is
    // only ever reported — it never rejects the expression.
    const strNumMismatch =
      /'(?:\\.|[^'\\])*'\s*(?:>|<|>=|<=)\s*\d+|\d+\s*(?:>|<|>=|<=)\s*'(?:\\.|[^'\\])*'/;
    if (strNumMismatch.test(expression)) {
      warnings.push({
        code: 'TYPE-STR_NUM_CMP',
        message: 'String literal compared with number using arithmetic operator',
        severity: 'warning',
        stage: 'type',
      });
    }

    // If ContextSchema is provided, do deeper checks
    if (contextSchema?.root) {
      const rootRef = escapeRegExp(contextSchema.root.name);
      for (const [fieldName, field] of Object.entries(contextSchema.root.fields)) {
        const fieldRef = `#(?:${rootRef}\\.)?${escapeRegExp(fieldName)}`;
        if (field.type === 'boolean') {
          // Check boolean field compared with number
          const boolNumPattern = new RegExp(`${fieldRef}\\s*(?:>|<|>=|<=)\\s*\\d+`);
          if (boolNumPattern.test(structural)) {
            warnings.push({
              code: 'TYPE-BOOL_NUM_CMP',
              message: `Boolean field '${fieldName}' compared with number`,
              severity: 'warning',
              stage: 'type',
            });
          }
        }
        if (field.type === 'number') {
          // Check a numeric field compared with a string literal
          const numStrPattern = new RegExp(`${fieldRef}\\s*(?:>|<|>=|<=)\\s*'(?:\\\\.|[^'\\\\])*'`);
          if (numStrPattern.test(expression)) {
            warnings.push({
              code: 'TYPE-STR_NUM_CMP',
              message: `Numeric field '${fieldName}' compared with a string literal`,
              severity: 'warning',
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
   * Stage 3: Semantic Check — advisory semantic validation
   */
  private validateSemantic(expression: string): StageResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    const structural = maskStringLiterals(expression);

    // Check for tautology/contradiction like `x == x`
    const selfCompare = /(#\w+(?:\.\w+)*)\s*==\s*\1/;
    if (selfCompare.test(structural)) {
      warnings.push({
        code: 'SEM-SELF_COMPARE',
        message: 'Self-comparison detected: expression is always true',
        severity: 'warning',
        stage: 'semantic',
      });
    }

    // Check for double negation (`!!`)
    if (structural.includes('!!')) {
      warnings.push({
        code: 'SEM-DOUBLE_NEGATION',
        message: 'Double negation detected, consider simplifying',
        severity: 'warning',
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
   *
   * A supplied schema turns this stage into a real gate: an undeclared bean,
   * a missing root field or an undeclared variable is an error. Without a
   * schema nothing can be judged, so the stage stays advisory.
   */
  private validateContext(expression: string, contextSchema?: ContextSchema): StageResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    // References inside string literals are text, not references.
    const structural = maskStringLiterals(expression);

    if (!contextSchema) {
      warnings.push({
        code: 'CTX-NO_SCHEMA',
        message: 'No ContextSchema provided, skipping context validation',
        severity: 'warning',
        stage: 'context',
      });
      return { passed: true, errors, warnings };
    }

    const variables = contextSchema.variables ?? {};
    const functions = contextSchema.functions ?? {};
    const beans = contextSchema.beans ?? {};
    const root = contextSchema.root;
    const rootFields = root?.fields ?? {};

    // Extract all references from expression
    const refs = this.extractReferences(structural);

    // Validate root references: `#<rootName>.<field>` must name a real field.
    if (root) {
      for (const ref of refs) {
        if (!ref.startsWith(`#${root.name}.`)) continue;
        const field = ref.split('.')[1];
        if (field && !(field in rootFields)) {
          errors.push({
            code: 'CTX-UNKNOWN_FIELD',
            message: `Field '${field}' not found in root '${root.name}'`,
            severity: 'error',
            stage: 'context',
            requiresLLM: true,
          });
        }
      }
    }

    // Validate variable references.
    for (const ref of refs) {
      if (!ref.startsWith('#') || ref.includes('.')) continue;
      const varName = ref.slice(1);
      const known =
        varName === 'this' ||
        varName === 'root' ||
        root?.name === varName ||
        varName in variables ||
        varName in functions ||
        // A bare `#name` may also name a root field, which the generator emits
        // as shorthand for `#root.name`.
        varName in rootFields;
      if (!known) {
        errors.push({
          code: 'CTX-UNKNOWN_REF',
          message: `Unknown reference '${ref}'`,
          severity: 'error',
          stage: 'context',
          requiresLLM: true,
        });
      }
    }

    // Validate Bean references
    const beanMatch = structural.match(/@(\w+)/g);
    if (beanMatch) {
      for (const b of beanMatch) {
        const beanName = b.slice(1);
        if (!(beanName in beans)) {
          errors.push({
            code: 'CTX-UNKNOWN_BEAN',
            message: `Bean '${beanName}' not found in ContextSchema`,
            severity: 'error',
            stage: 'context',
            requiresLLM: true,
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
   * Stage 5: Final Check — the generated expression must parse.
   *
   * When an evaluator is configured the parse stage already performed a real
   * parse; this mandatory final gate adds the structural check that a truncated
   * tail (an expression ending on an operator) is never accepted, even when no
   * engine is wired in. It is deliberately conservative: only a trailing
   * operator or an unterminated literal fails, so no well-formed expression is
   * rejected.
   */
  private validateFinal(expression: string): StageResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    if (this.isManifestlyIncomplete(expression)) {
      errors.push({
        code: 'FINAL-TRUNCATED',
        message: 'Expression is incomplete: it ends with an operator or is not terminated',
        severity: 'error',
        stage: 'final',
        requiresLLM: true,
      });
    }

    return { passed: errors.length === 0, errors, warnings };
  }

  /**
   * Whether the expression is obviously incomplete.
   *
   * The last token is obtained from spel-ts's tokenizer, so a trailing
   * operator keyword or an unterminated string literal is detected exactly,
   * and text inside a literal is never read as a trailing operator.
   */
  private isManifestlyIncomplete(expression: string): boolean {
    if (expression.trim().length === 0) return true;

    const tokenizer = new Tokenizer(expression);
    let lastKind: TokenKind | null = null;
    let lastLiteral: string | undefined;
    let previousKind: TokenKind | null = null;
    try {
      for (;;) {
        const token = tokenizer.nextToken();
        if (token.kind === TokenKind.EOF) break;
        previousKind = lastKind;
        lastKind = token.kind;
        lastLiteral = token.literal;
      }
    } catch {
      // An unterminated string literal: the expression cannot be complete.
      return true;
    }

    if (lastKind === null) return true;
    if (INCOMPLETE_TRAILING_TOKENS.has(lastKind)) return true;

    // The textual operators `and`, `or`, `matches`, `between` and `instanceof`
    // stay IDENTIFIER tokens; only their position makes them operators. A
    // property such as `#order.and` is a name, so a preceding dot clears it.
    if (lastKind === TokenKind.IDENTIFIER && lastLiteral !== undefined) {
      const isWordOperator = WORD_OPERATORS.has(lastLiteral.toLowerCase());
      if (isWordOperator && previousKind !== TokenKind.DOT && previousKind !== TokenKind.SAFE_NAV) {
        return true;
      }
    }

    return false;
  }

  /**
   * Check if parentheses are balanced. Expects a literal-masked expression.
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
   * Extract all identifier references from expression.
   *
   * A bare `#x` that is only the head of a dotted reference (`#x.y`) is not
   * emitted on its own: a dotted reference names a property of some object,
   * not a variable of that name.
   */
  private extractReferences(expression: string): string[] {
    const refs: string[] = [];
    const dottedHeads = new Set<string>();

    // #root.field pattern
    const varMatch = expression.matchAll(/#(\w+(?:\.\w+(?:\.\w+)?)?)/g);
    for (const m of varMatch) {
      const ref = `#${m[1]!}`;
      if (!refs.includes(ref)) {
        refs.push(ref);
      }
      if (ref.includes('.')) {
        dottedHeads.add(ref.split('.')[0]!);
      }
    }

    // #variable pattern
    const simpleMatch = expression.matchAll(/#(\w+)(?!\w*\()/g);
    for (const m of simpleMatch) {
      const ref = `#${m[1]!}`;
      if (dottedHeads.has(ref)) continue;
      if (!refs.includes(ref)) {
        refs.push(ref);
      }
    }

    return refs;
  }
}

/**
 * Token kinds that cannot legally end a complete expression.
 *
 * A binary operator with no right-hand operand, an opening delimiter that is
 * never closed, or an assignment/selector prefix with nothing after it all
 * mean the expression was truncated.
 */
const INCOMPLETE_TRAILING_TOKENS: ReadonlySet<TokenKind> = new Set([
  TokenKind.PLUS,
  TokenKind.MINUS,
  TokenKind.STAR,
  TokenKind.SLASH,
  TokenKind.PERCENT,
  TokenKind.DIV,
  TokenKind.MOD,
  TokenKind.POWER,
  TokenKind.INC,
  TokenKind.DEC,
  TokenKind.EQ,
  TokenKind.NE,
  TokenKind.LT,
  TokenKind.LE,
  TokenKind.GT,
  TokenKind.GE,
  TokenKind.AND,
  TokenKind.OR,
  TokenKind.NOT,
  TokenKind.ASSIGN,
  TokenKind.MATCHES,
  TokenKind.BETWEEN,
  TokenKind.INSTANCEOF,
  TokenKind.LPAREN,
  TokenKind.LBRACKET,
  TokenKind.LBRACE,
  TokenKind.COMMA,
  TokenKind.COLON,
  TokenKind.DOT,
  TokenKind.SAFE_NAV,
  TokenKind.QMARK,
  TokenKind.ELVIS,
  TokenKind.HASH,
  TokenKind.AT,
  TokenKind.AMP_AT,
  TokenKind.PROJECTION,
  TokenKind.SELECTION,
  TokenKind.SELECT_FIRST,
  TokenKind.SELECT_LAST,
  TokenKind.TYPE_START,
  TokenKind.NEW,
  TokenKind.DOTDOT,
]);

/** Textual operators that the tokenizer leaves as IDENTIFIER tokens. */
const WORD_OPERATORS: ReadonlySet<string> = new Set([
  'and',
  'or',
  'not',
  'matches',
  'between',
  'instanceof',
]);

/** Escape a field or root name so it can be embedded in a RegExp source. */
function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
