import { describe, it, expect } from 'vitest';
import { SchemaFormatter } from '../context/schema-formatter.js';
import type { ContextSchema } from '../SpelEvaluator.js';

function createBasicSchema(): ContextSchema {
  return {
    root: {
      name: 'order',
      type: 'Order',
      fields: {
        amount: {
          type: 'number',
          description: 'Order amount',
          example: 1000,
        },
        status: {
          type: 'string',
          description: 'Order status',
          example: '已发货',
        },
        paid: {
          type: 'boolean',
          nullable: true,
        },
        items: {
          type: 'array',
          isCollection: true,
          elementType: 'object',
          description: 'Order items',
        },
      },
      methods: {},
    },
    variables: {
      user: {
        type: 'User',
        description: 'Current user',
      },
    },
    beans: {
      discountService: {
        type: 'DiscountService',
        description: 'Discount calculation service',
      },
    },
    types: {
      OrderStatus: {
        description: 'Order status enum',
      },
    },
    functions: {
      sum: {
        returnType: 'number',
        params: [{ name: 'values', type: 'array' }],
      },
    },
  };
}

describe('SchemaFormatter', () => {
  const formatter = new SchemaFormatter();

  describe('formatForLLM', () => {
    it('should format root object with fields', () => {
      const schema = createBasicSchema();
      const output = formatter.formatForLLM(schema);

      expect(output).toContain('## Context Schema');
      expect(output).toContain('Root Object (accessible as #order)');
      expect(output).toContain('Type: Order');
      expect(output).toContain('Fields:');
      expect(output).toContain('amount: number');
      expect(output).toContain('(Order amount)');
      expect(output).toContain('(e.g. 1000)');
    });

    it('should format variables section', () => {
      const schema = createBasicSchema();
      const output = formatter.formatForLLM(schema);

      expect(output).toContain('Variables:');
      expect(output).toContain('#user: User');
      expect(output).toContain('(Current user)');
    });

    it('should format beans section', () => {
      const schema = createBasicSchema();
      const output = formatter.formatForLLM(schema);

      expect(output).toContain('Beans:');
      expect(output).toContain('@discountService: DiscountService');
      expect(output).toContain('(Discount calculation service)');
    });

    it('should format types section', () => {
      const schema = createBasicSchema();
      const output = formatter.formatForLLM(schema);

      expect(output).toContain('Types (accessible via T(typeName)):');
      expect(output).toContain('OrderStatus: Order status enum');
    });

    it('should format functions section', () => {
      const schema = createBasicSchema();
      const output = formatter.formatForLLM(schema);

      expect(output).toContain('Functions:');
      expect(output).toContain('#sum(values: array): number');
    });

    it('should indicate nullable fields', () => {
      const output = formatter.formatForLLM(createBasicSchema());
      expect(output).toContain('[nullable]');
    });

    it('should indicate collection fields', () => {
      const output = formatter.formatForLLM(createBasicSchema());
      expect(output).toContain('[array of object]');
    });

    it('should skip variables section when empty', () => {
      const schema: ContextSchema = {
        root: null,
        variables: {},
        beans: {},
        types: {},
        functions: {},
      };
      const output = formatter.formatForLLM(schema);
      expect(output).not.toContain('Variables:');
    });

    it('should skip beans section when empty', () => {
      const schema: ContextSchema = {
        root: null,
        variables: {},
        beans: {},
        types: {},
        functions: {},
      };
      const output = formatter.formatForLLM(schema);
      expect(output).not.toContain('Beans:');
    });
  });

  describe('formatForHuman', () => {
    it('should format root object in human-readable form', () => {
      const output = formatter.formatForHuman(createBasicSchema());

      expect(output).toContain('Context Schema (Human-Readable)');
      expect(output).toContain('Root: #order');
      expect(output).toContain('Type: Order');
      expect(output).toContain('amount (number)');
      expect(output).toContain('nullable');
      expect(output).toContain('collection<object>');
    });

    it('should show field count', () => {
      const output = formatter.formatForHuman(createBasicSchema());
      expect(output).toContain('4 fields total');
    });
  });

  // Coverage: beans/types without description (lines 45, 55 false branches)
  describe('beans/types without description', () => {
    it('should format bean without description (line 45 false branch)', () => {
      const schema: ContextSchema = {
        root: null,
        variables: {},
        beans: { myService: { type: 'MyService' } },
        types: {},
        functions: {},
      };
      const output = formatter.formatForLLM(schema);
      expect(output).toContain('@myService: MyService');
    });

    it('should format type without description (line 55 false branch)', () => {
      const schema: ContextSchema = {
        root: null,
        variables: {},
        beans: {},
        types: { MyEnum: {} },
        functions: {},
      };
      const output = formatter.formatForLLM(schema);
      expect(output).toContain('MyEnum');
    });
  });

  // Coverage: isCollection field missing elementType (lines 96, 113 'unknown' fallback)
  describe('collection field without elementType', () => {
    it('should use "unknown" when elementType is missing in formatForHuman (line 96)', () => {
      const schema: ContextSchema = {
        root: {
          name: 'order',
          type: 'Order',
          fields: {
            tags: {
              type: 'array',
              isCollection: true,
              description: 'Tag list',
            },
          },
          methods: {},
        },
        variables: {},
        beans: {},
        types: {},
        functions: {},
      };
      const output = formatter.formatForHuman(schema);
      expect(output).toContain('collection<unknown>');
    });

    it('should use "unknown" when elementType is missing in formatForLLM (line 113)', () => {
      const schema: ContextSchema = {
        root: {
          name: 'order',
          type: 'Order',
          fields: {
            tags: {
              type: 'array',
              isCollection: true,
              description: 'Tag list',
            },
          },
          methods: {},
        },
        variables: {},
        beans: {},
        types: {},
        functions: {},
      };
      const output = formatter.formatForLLM(schema);
      expect(output).toContain('[array of unknown]');
    });
  });

  // Coverage: formatForHuman for-loop prefix branching (├─ vs └─)
  describe('formatForHuman prefix branching', () => {
    it('should use └─ for last field (single field exercises └─ prefix path)', () => {
      const schema: ContextSchema = {
        root: {
          name: 'item',
          type: 'Item',
          fields: {
            id: {
              type: 'number',
              description: 'Item ID',
            },
          },
          methods: {},
        },
        variables: {},
        beans: {},
        types: {},
        functions: {},
      };
      const output = formatter.formatForHuman(schema);
      expect(output).toContain('└─ id');
      expect(output).toContain('1 fields total');
    });

    it('should use ├─ for non-last and └─ for last with many fields', () => {
      const schema = createBasicSchema();
      const output = formatter.formatForHuman(schema);
      expect(output).toContain('├─ amount');
      expect(output).toContain('├─ status');
      expect(output).toContain('├─ paid');
      expect(output).toContain('└─ items');
      expect(output).toContain('4 fields total');
    });
  });

  // Coverage: functions with description
  describe('functions with description', () => {
    it('should format function that has a description property', () => {
      const schema: ContextSchema = {
        root: null,
        variables: {},
        beans: {},
        types: {},
        functions: {
          calculateDiscount: {
            returnType: 'number',
            description: 'Calculate discount for order',
            params: [{ name: 'order', type: 'Order' }],
          },
        },
      };
      const output = formatter.formatForLLM(schema);
      expect(output).toContain('#calculateDiscount(order: Order)');
      expect(output).toContain('number');
    });
  });

  describe('empty schema', () => {
    it('should handle null root gracefully', () => {
      const schema: ContextSchema = {
        root: null,
        variables: { x: { type: 'string' } },
        beans: {},
        types: {},
        functions: {},
      };
      const llmOutput = formatter.formatForLLM(schema);
      expect(llmOutput).not.toContain('Root Object');
      expect(llmOutput).toContain('Variables:');
      expect(llmOutput).toContain('#x: string');
    });

    it('should handle completely empty schema', () => {
      const schema: ContextSchema = {
        root: null,
        variables: {},
        beans: {},
        types: {},
        functions: {},
      };
      const output = formatter.formatForLLM(schema);
      // Should not throw; just header
      expect(output).toContain('## Context Schema');
    });
  });
});
