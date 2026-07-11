import type { ContextSchema } from '@agentix-e/nl2spel';

export interface GBNFGeneratorOptions {
  /** Whether to inject identifiers from ContextSchema (default true) */
  injectContext?: boolean;
  /** Whether to restrict expression type (default: no restriction) */
  restrictTo?: 'expression' | 'boolean' | 'number' | 'string';
}

/**
 * GBNFGenerator — dynamically generates llama.cpp compatible GBNF grammar constraints.
 *
 * GBNF format specification:
 * - root ::= "<expression-type>"  (top-level rule)
 * - Rule names: [a-zA-Z_][a-zA-Z0-9_]*
 * - Literals: "text"
 * - Character classes: [a-z], [0-9], [a-zA-Z]
 * - Groups: (pattern)
 * - Alternation: pattern | pattern
 * - Repetition: pattern* (0+), pattern+ (1+), pattern? (0-1)
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
   * Set the ContextSchema
   */
  public setContext(schema: ContextSchema): void {
    this.contextSchema = schema;
  }

  /**
   * Generate the full GBNF grammar
   */
  public generate(schema?: ContextSchema): string {
    if (schema) this.contextSchema = schema;

    const rules: string[] = [];

    // Top-level rule (selected based on restrictTo)
    if (this.options.restrictTo === 'boolean') {
      rules.push('root ::= boolean-expr');
    } else {
      rules.push('root ::= expression');
    }

    // ===== Basic Lexical =====
    rules.push('');
    rules.push('# Lexical rules');
    rules.push('digit ::= [0-9]');
    rules.push('nonzero-digit ::= [1-9]');
    rules.push('letter ::= [a-zA-Z]');
    rules.push('letter-or-digit ::= [a-zA-Z0-9]');
    rules.push('underscore ::= "_"');

    // ===== Numbers =====
    rules.push('');
    rules.push('# Numbers');
    rules.push('integer ::= "0" | nonzero-digit digit*');
    rules.push('decimal ::= integer "." digit+');
    rules.push('number ::= decimal | integer');

    // ===== Strings =====
    rules.push('');
    rules.push('# Strings (single-quoted, supports escaped single quotes)');
    rules.push('string-char ::= [^' + "'" + '\\\\] | "\'\'"');
    rules.push('string ::= "\'" string-char* "\'"');

    // ===== Booleans and null =====
    rules.push('');
    rules.push('# Booleans and null');
    rules.push('boolean-literal ::= "true" | "false"');
    rules.push('null-literal ::= "null"');
    rules.push('literal ::= number | string | boolean-literal | null-literal');

    // ===== Identifiers =====
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

    // ===== Type references =====
    rules.push('');
    rules.push('# Type references (T(ClassName))');
    rules.push('type-ref ::= "T(" qualified-identifier ")"');

    // ===== Bean references =====
    rules.push('');
    rules.push('# Bean references (@beanName)');
    rules.push('bean-ref ::= "@" identifier');

    // ===== Method calls =====
    rules.push('');
    rules.push('# Method calls');
    rules.push(
      'method-name ::= "contains" | "isEmpty" | "size" | "startsWith" | "endsWith" | "matches" | "after" | "before" | "valueOf"',
    );
    rules.push('method-call ::= "." method-name "(" (expression ("," expression)*)? ")"');
    rules.push('method-call-chain ::= reference method-call+');
    rules.push('reference ::= variable-ref | field-ref | bean-ref | literal | "(" expression ")"');

    // ===== Collection projection and selection =====
    rules.push('');
    rules.push('# Collection projection and selection');
    rules.push('selection ::= collection-ref ".?[" expression "]"');
    rules.push('first-selection ::= collection-ref ".^[" expression "]"');
    rules.push('projection ::= collection-ref ".![" expression "]"');
    rules.push('collection-ref ::= field-ref | variable-ref');

    // ===== Function calls =====
    rules.push('');
    rules.push('# Function calls');
    rules.push('func-name ::= "hasRole" | "hasPermission"');
    rules.push('function-call ::= func-name "(" string ("," expression)* ")"');

    // ===== Operator precedence (lowest to highest, EBNF → GBNF) =====
    rules.push('');
    rules.push('# Operators');

    // primary: the most basic expression
    rules.push(
      'primary ::= literal | reference | type-ref | function-call | selection | first-selection | projection | "(" expression ")"',
    );

    // unary: unary operators
    rules.push('unary ::= ("!" | "not" ws) primary | primary');
    rules.push('ws ::= [ ]?');

    // multiplicative: multiplication, division, modulus
    rules.push('multiplicative ::= unary (ws ("*" | "/" | "%") ws unary)?');

    // additive: addition, subtraction
    rules.push('additive ::= multiplicative (ws ("+" | "-") ws multiplicative)?');

    // relational: comparison
    rules.push('relational ::= additive (ws (">=" | "<=" | ">" | "<") ws additive)?');

    // equality: equality/inequality
    rules.push('equality-dot ::= "==" | "!="');
    rules.push('equality ::= relational (ws equality-dot ws relational)?');

    // between: range
    rules.push('between ::= relational ws "between" ws "{" ws number ws "," ws number ws "}"');

    // logical-and: logical AND
    rules.push('logical-and ::= (between | equality) (ws "and" ws (between | equality))*');

    // logical-or: logical OR
    rules.push('logical-or ::= logical-and (ws "or" ws logical-and)*');

    // elvis: default value
    rules.push('elvis ::= logical-or (ws "?:" ws logical-or)?');

    // Top-level expression
    rules.push('expression ::= elvis');

    // Boolean expression type (used for conditions)
    rules.push('');
    rules.push('# Boolean-specific expressions');
    rules.push('boolean-expr ::= logical-or (ws "?:" ws logical-or)?');

    return rules.join('\n');
  }

  /**
   * Generate identifier rules injected from ContextSchema
   */
  private generateIdentifierRules(): string[] {
    const rules: string[] = [];
    const schema = this.contextSchema!;

    // Collect all valid identifiers
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

    // Deduplicate
    const uniqueIds = [...new Set(identifiers)];

    // Generate identifier rule (GBNF string alternation)
    const idRules = uniqueIds.map(id => `"${id}"`).join(' | ');
    rules.push(`identifier ::= (${idRules}) | general-identifier`);
    rules.push('general-identifier ::= letter (letter-or-digit | underscore)*');

    // root-field: inject root object fields (makes grammar constraints more precise)

    rules.push('qualified-identifier ::= identifier ("." identifier)*');

    return rules;
  }

  /**
   * Generate structured GBNF (with comments and sections)
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
