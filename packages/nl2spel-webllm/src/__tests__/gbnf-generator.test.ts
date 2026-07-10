import { describe, it, expect } from 'vitest';
import { GBNFGenerator } from '../gbnf-generator.js';
import type { ContextSchema } from '@agentix-e/nl2spel';

const TEST_SCHEMA: ContextSchema = {
  root: {
    name: 'order',
    type: 'Order',
    fields: {
      amount: { type: 'number', description: 'Order amount' },
      status: { type: 'string', description: 'Order status' },
      paid: { type: 'boolean', description: 'Payment status' },
      tags: { type: 'array', isCollection: true, elementType: 'string' },
    },
    methods: {},
  },
  variables: { user: { type: 'object', description: 'Current user' } },
  beans: { authService: { type: 'AuthService' } },
  types: { Admin: { className: 'com.example.Admin' } },
  functions: {},
};

describe('GBNFGenerator', () => {
  // ===== WL-G01: Basic grammar generation =====
  describe('WL-G01: Basic Grammar Generation', () => {
    it('should generate valid GBNF grammar', () => {
      const gen = new GBNFGenerator();
      const grammar = gen.generate();
      expect(grammar).toContain('root ::=');
      expect(grammar).toContain('expression');
    });

    it('should start with root rule', () => {
      const gen = new GBNFGenerator();
      const grammar = gen.generate();
      const lines = grammar.trim().split('\n');
      expect(lines[0]).toMatch(/^root ::=/);
    });

    it('should contain lexical rules', () => {
      const gen = new GBNFGenerator();
      const grammar = gen.generate();
      expect(grammar).toContain('digit ::=');
      expect(grammar).toContain('letter ::=');
    });

    it('should contain number rules', () => {
      const gen = new GBNFGenerator();
      const grammar = gen.generate();
      expect(grammar).toContain('integer ::=');
      expect(grammar).toContain('decimal ::=');
      expect(grammar).toContain('number ::=');
    });

    it('should contain string rules', () => {
      const gen = new GBNFGenerator();
      const grammar = gen.generate();
      expect(grammar).toContain('string ::=');
      expect(grammar).toContain('string-char ::=');
    });

    it('should contain boolean and null literals', () => {
      const gen = new GBNFGenerator();
      const grammar = gen.generate();
      expect(grammar).toContain('boolean-literal ::=');
      expect(grammar).toContain('"true"');
      expect(grammar).toContain('"false"');
      expect(grammar).toContain('null-literal ::=');
      expect(grammar).toContain('"null"');
    });
  });

  // ===== WL-G02: Operator grammar =====
  describe('WL-G02: Operators', () => {
    it('should contain comparison operators', () => {
      const gen = new GBNFGenerator();
      const grammar = gen.generate();
      expect(grammar).toContain('">=" | "<=" | ">" | "<"');
    });

    it('should contain equality operators', () => {
      const gen = new GBNFGenerator();
      const grammar = gen.generate();
      expect(grammar).toContain('equality-dot ::=');
      expect(grammar).toContain('"=="');
      expect(grammar).toContain('"!="');
    });

    it('should contain logical operators', () => {
      const gen = new GBNFGenerator();
      const grammar = gen.generate();
      expect(grammar).toContain('"and"');
      expect(grammar).toContain('"or"');
    });

    it('should contain between expression', () => {
      const gen = new GBNFGenerator();
      const grammar = gen.generate();
      expect(grammar).toContain('between');
      expect(grammar).toContain('"{"');
      expect(grammar).toContain('"}"');
    });
  });

  // ===== WL-G03: Context injection =====
  describe('WL-G03: Context Schema Injection', () => {
    it('should inject context identifiers when schema is set', () => {
      const gen = new GBNFGenerator({ injectContext: true });
      gen.setContext(TEST_SCHEMA);
      const grammar = gen.generate();
      expect(grammar).toContain('"order"');
      expect(grammar).toContain('"amount"');
    });

    it('should not inject context when disabled', () => {
      const gen = new GBNFGenerator({ injectContext: false });
      gen.setContext(TEST_SCHEMA);
      const grammar = gen.generate();
      expect(grammar).not.toContain('"order"');
    });

    it('should work without ContextSchema', () => {
      const gen = new GBNFGenerator();
      const grammar = gen.generate();
      expect(grammar).toContain('root ::=');
      expect(grammar).toContain('identifier ::=');
    });

    it('should inject via generate() parameter', () => {
      const gen = new GBNFGenerator();
      const grammar = gen.generate(TEST_SCHEMA);
      expect(grammar).toContain('"order"');
      expect(grammar).toContain('"authService"');
    });

    it('should inject bean identifiers', () => {
      const gen = new GBNFGenerator();
      const grammar = gen.generate({
        root: null,
        variables: {},
        beans: { discountService: { type: 'DiscountService' } },
        types: {},
        functions: {},
      });
      expect(grammar).toContain('"discountService"');
    });

    it('should inject type identifiers', () => {
      const gen = new GBNFGenerator();
      const grammar = gen.generate({
        root: null,
        variables: {},
        beans: {},
        types: { Admin: { className: 'com.example.Admin' } },
        functions: {},
      });
      expect(grammar).toContain('"Admin"');
    });
  });

  // ===== WL-G04: Struct output =====
  describe('WL-G04: Structured Output', () => {
    it('should generate structured output', () => {
      const gen = new GBNFGenerator();
      const struct = gen.generateStructured();
      expect(struct.rootRule).toBeTruthy();
      expect(struct.sections.length).toBeGreaterThan(0);
      expect(struct.ruleCount).toBeGreaterThan(10);
    });

    it('structured output should have named sections', () => {
      const gen = new GBNFGenerator();
      const struct = gen.generateStructured();
      const sectionNames = struct.sections.map(s => s.name);
      expect(sectionNames).toContain('Lexical rules');
      expect(sectionNames).toContain('Numbers');
    });
  });

  // ===== WL-G05: llama.cpp compatibility =====
  describe('WL-G05: llama.cpp Compatibility', () => {
    it('should only use supported GBNF constructs', () => {
      const gen = new GBNFGenerator();
      const grammar = gen.generate();

      // GBNF does not support lookahead, backreferences, or {n,m} quantifiers (outside quotes)
      expect(grammar).not.toMatch(/\(\?[=!]/); // No lookahead/lookbehind
      expect(grammar).not.toMatch(/\\\d/); // No backreferences

      // Curly braces are ONLY valid inside "quoted literals" (e.g. "{" and "}")
      // Unquoted { or } with numbers inside would be quantifiers
      const unquotedBraces = grammar.replace(/"[^"]*"/g, ''); // Remove quoted strings
      expect(unquotedBraces).not.toMatch(/\{\d/); // No {n} quantifiers
    });

    it('should use valid GBNF rule names', () => {
      const gen = new GBNFGenerator();
      const grammar = gen.generate();
      const rules = grammar
        .split('\n')
        .filter(l => l.includes('::='))
        .map(l => l.split('::=')[0]!.trim());

      for (const rule of rules) {
        // Rule names must match [a-zA-Z_][a-zA-Z0-9_-]*
        expect(rule).toMatch(/^[a-zA-Z_][a-zA-Z0-9_-]*$/);
      }
    });

    it('should have all referenced rules defined', () => {
      const gen = new GBNFGenerator();
      const grammar = gen.generate();
      const lines = grammar.split('\n');

      // Collect all defined rules
      const definedRules = new Set<string>();
      for (const line of lines) {
        const match = line.match(/^([a-zA-Z][a-zA-Z0-9_-]*)\s*::=/);
        if (match) {
          definedRules.add(match[1]!);
        }
      }

      // Check all referenced rules exist
      // GBNF rules reference other rules as bare identifiers in patterns
      const ruleRefs: string[] = [];
      for (const rule of definedRules) {
        // Skip built-in rules like "digit", "letter" etc — they might appear in char classes
        const escaped = rule.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
        const refPattern = new RegExp(`\\b${escaped}\\b`, 'g');

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i]!;
          // Skip the rule's own definition line
          if (line.startsWith(`${rule} ::=`)) continue;
          // Skip comment lines
          if (line.startsWith('#')) continue;

          // Only check after ::= (i.e., in pattern part)
          const parts = line.split('::=');
          if (parts.length >= 2 && parts[1]!.match(refPattern)) {
            ruleRefs.push(rule);
          }
        }
      }

      // All referenced rules should be defined
      const uniqueRefs = [...new Set(ruleRefs)];
      for (const ref of uniqueRefs) {
        expect(definedRules.has(ref)).toBe(true);
      }
    });
  });

  // ===== WL-G06: restrictTo modes =====
  describe('WL-G06: Restrict To', () => {
    it('should generate expression root by default', () => {
      const gen = new GBNFGenerator();
      const grammar = gen.generate();
      expect(grammar).toMatch(/^root ::= expression/m);
    });

    it('should generate boolean root when restrictTo=boolean', () => {
      const gen = new GBNFGenerator({ restrictTo: 'boolean' });
      const grammar = gen.generate();
      expect(grammar).toMatch(/^root ::= boolean-expr/m);
    });
  });

  // ===== WL-G07: Expression coverage =====
  describe('WL-G07: Expression Coverage', () => {
    it('should support method calls', () => {
      const gen = new GBNFGenerator();
      const grammar = gen.generate();
      expect(grammar).toContain('method-name ::=');
      expect(grammar).toContain('"contains"');
      expect(grammar).toContain('"isEmpty"');
    });

    it('should support collection operations', () => {
      const gen = new GBNFGenerator();
      const grammar = gen.generate();
      expect(grammar).toContain('selection ::=');
      expect(grammar).toContain('.?[');
      expect(grammar).toContain('projection ::=');
      expect(grammar).toContain('.![');
    });

    it('should support function calls', () => {
      const gen = new GBNFGenerator();
      const grammar = gen.generate();
      expect(grammar).toContain('function-call ::=');
      expect(grammar).toContain('func-name ::=');
      expect(grammar).toContain('"hasRole"');
    });

    it('should support Elvis operator', () => {
      const gen = new GBNFGenerator();
      const grammar = gen.generate();
      expect(grammar).toContain('elvis ::=');
      expect(grammar).toContain('"?:"');
    });

    it('should support type references', () => {
      const gen = new GBNFGenerator();
      const grammar = gen.generate();
      expect(grammar).toContain('type-ref ::=');
      expect(grammar).toContain('"T("');
      expect(grammar).toContain('")"');
    });
  });
});
