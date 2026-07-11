/**
 * SpEL evaluator abstract interface
 *
 * The nl2spel core package uses this interface for:
 *   1. Syntax validation (Parse Check)
 *   2. Type validation (Type Check)
 *   3. Context validation (Context Check)
 *   4. Expression evaluation (for semantic validation)
 *
 * nl2spel does not implement this interface, nor does it depend on any concrete implementation.
 * Users inject a spel-ts Adapter, remote API Adapter, or mock.
 */
export interface SpelEvaluator {
  /**
   * Parse a SpEL expression and return syntax validation results.
   * For syntactically invalid expressions, the errors array is non-empty.
   */
  parse(expression: string): ParseResult | Promise<ParseResult>;

  /**
   * Get the available context schema.
   * Returns null if no context information is available (syntax-only validation, no type/context check).
   */
  getContextSchema(): ContextSchema | null | Promise<ContextSchema | null>;

  /**
   * Evaluate an expression (optional).
   * Used for semantic validation: verify the generated expression produces expected results with test inputs.
   * Can be left unimplemented if semantic validation is not needed.
   */
  evaluate?(expression: string, context: Record<string, unknown>): unknown | Promise<unknown>;
}

/** Parse result */
export interface ParseResult {
  valid: boolean;
  errors: ParseError[];
  /** AST representation on successful parse (optional) */
  ast?: unknown;
}

export interface ParseError {
  message: string;
  position: number;
  /** Error type (optional, for classification) */
  code?: string;
}

/**
 * Context Schema — describes metadata of the SpEL evaluation context.
 *
 * Used for:
 * 1. PromptBuilder: constructing context information in LLM prompts
 * 2. ValidationPipeline: verifying expression references are valid
 * 3. TemplateEngine: matching correct field names during slot filling
 * 4. GBNFGenerator: generating GBNF grammar containing all valid identifiers
 */
export interface ContextSchema {
  /** Root object metadata */
  root: RootObjectSchema | null;

  /** Variable declarations */
  variables: Record<string, VariableSchema>;

  /** Bean declarations */
  beans: Record<string, BeanSchema>;

  /** Type declarations */
  types: Record<string, TypeSchema>;

  /** Function declarations */
  functions: Record<string, FunctionSchema>;
}

export interface RootObjectSchema {
  /** Root object name (referenced as #rootName in SpEL) */
  name: string;

  /** Root object type */
  type: string;

  /** Root object fields */
  fields: Record<string, FieldSchema>;

  /** Root object methods */
  methods: Record<string, MethodSchema>;
}

export interface FieldSchema {
  /** SpEL type */
  type: 'string' | 'number' | 'boolean' | 'date' | 'object' | 'array' | 'map';

  /** Field description (for semantic matching) */
  description?: string;

  /** Child fields (if type is object) */
  fields?: Record<string, FieldSchema>;

  /** Whether it is a collection */
  isCollection?: boolean;

  /** Collection element type */
  elementType?: string;

  /** Whether nullable */
  nullable?: boolean;

  /** Example value */
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
