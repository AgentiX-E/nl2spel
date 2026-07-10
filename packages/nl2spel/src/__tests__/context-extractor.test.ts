import { describe, it, expect } from 'vitest';
import { ContextExtractor } from '../context/context-extractor.js';

describe('ContextExtractor', () => {
  const extractor = new ContextExtractor();

  describe('extract root object', () => {
    it('should extract root object with simple fields', () => {
      const schema = extractor.extract({
        rootObject: { amount: 1000, status: 'pending', vip: true },
        rootName: 'order',
      });

      expect(schema.root).not.toBeNull();
      expect(schema.root!.name).toBe('order');
      expect(schema.root!.type).toBe('Object');
      expect(schema.root!.fields).toHaveProperty('amount');
      expect(schema.root!.fields.amount!.type).toBe('number');
      expect(schema.root!.fields.amount!.example).toBe(1000);
      expect(schema.root!.fields.status!.type).toBe('string');
      expect(schema.root!.fields.status!.example).toBe('pending');
      expect(schema.root!.fields.vip!.type).toBe('boolean');
      expect(schema.root!.fields.vip!.example).toBe(true);
    });

    it('should return null for null root object', () => {
      const schema = extractor.extract({ rootObject: null });
      expect(schema.root).toBeNull();
    });

    it('should return null for undefined root object', () => {
      const schema = extractor.extract({ rootObject: undefined });
      expect(schema.root).toBeNull();
    });

    it('should return null when rootObject is not provided', () => {
      const schema = extractor.extract({});
      expect(schema.root).toBeNull();
    });

    it('should use default root name "root" when not specified', () => {
      const schema = extractor.extract({ rootObject: { x: 1 } });
      expect(schema.root!.name).toBe('root');
    });

    it('should detect array type on root fields', () => {
      const schema = extractor.extract({
        rootObject: { items: [1, 2, 3], tags: ['vip', 'premium'] },
      });

      expect(schema.root!.fields.items!.isCollection).toBe(true);
      expect(schema.root!.fields.items!.type).toBe('array');
      expect(schema.root!.fields.items!.elementType).toBe('number');
      expect(schema.root!.fields.tags!.elementType).toBe('string');
    });

    it('should detect null fields as nullable', () => {
      const schema = extractor.extract({
        rootObject: { name: null, active: true },
      });

      expect(schema.root!.fields.name!.nullable).toBe(true);
      expect(schema.root!.fields.name!.type).toBe('string');
      expect(schema.root!.fields.active!.nullable).toBe(false);
    });

    it('should detect Date type', () => {
      const schema = extractor.extract({
        rootObject: { createdAt: new Date('2024-01-01') },
      });

      expect(schema.root!.fields.createdAt!.type).toBe('date');
    });

    it('should generate field descriptions', () => {
      const schema = extractor.extract({
        rootObject: { amount: 500 },
      });

      expect(schema.root!.fields.amount!.description).toContain('amount');
      expect(schema.root!.fields.amount!.description).toContain('number');
    });

    it('should handle empty object', () => {
      const schema = extractor.extract({ rootObject: {} });
      expect(schema.root).not.toBeNull();
      expect(schema.root!.type).toBe('Object');
      expect(Object.keys(schema.root!.fields)).toHaveLength(0);
    });
  });

  describe('extract variables', () => {
    it('should extract variable definitions', () => {
      const schema = extractor.extract({
        variables: {
          user: { type: 'object', description: 'Current user', value: { id: 1 } },
          count: { type: 'number', value: 42 },
        },
      });

      expect(schema.variables).toHaveProperty('user');
      expect(schema.variables.user!.type).toBe('object');
      expect(schema.variables.user!.description).toBe('Current user');
      expect(schema.variables.user!.value).toEqual({ id: 1 });
      expect(schema.variables.count!.type).toBe('number');
      expect(schema.variables.count!.value).toBe(42);
    });

    it('should generate default descriptions for variables', () => {
      const schema = extractor.extract({
        variables: { user: { type: 'string' } },
      });

      expect(schema.variables.user!.description).toContain('user');
    });

    it('should handle nullable variables', () => {
      const schema = extractor.extract({
        variables: { user: { type: 'string', nullable: true } },
      });

      expect(schema.variables.user!.nullable).toBe(true);
    });

    it('should return empty object when no variables', () => {
      const schema = extractor.extract({});
      expect(schema.variables).toEqual({});
    });
  });

  describe('extract beans', () => {
    it('should extract bean definitions', () => {
      const schema = extractor.extract({
        beans: [
          { name: 'userService', type: 'UserService', description: 'User service bean' },
          { name: 'auditLogger', type: 'AuditLogger', singleton: true },
        ],
      });

      expect(schema.beans).toHaveProperty('userService');
      expect(schema.beans.userService!.type).toBe('UserService');
      expect(schema.beans.userService!.description).toBe('User service bean');
      expect(schema.beans.auditLogger!.type).toBe('AuditLogger');
      expect(schema.beans.auditLogger!.singleton).toBe(true);
    });

    it('should return empty object when no beans', () => {
      const schema = extractor.extract({});
      expect(schema.beans).toEqual({});
    });
  });

  describe('extract types', () => {
    it('should extract type definitions', () => {
      const schema = extractor.extract({
        types: [{ name: 'Admin', className: 'com.example.Admin', description: 'Admin class' }],
      });

      expect(schema.types).toHaveProperty('Admin');
      expect(schema.types.Admin!.className).toBe('com.example.Admin');
      expect(schema.types.Admin!.description).toBe('Admin class');
    });

    it('should return empty object when no types', () => {
      const schema = extractor.extract({});
      expect(schema.types).toEqual({});
    });
  });

  describe('extract functions', () => {
    it('should extract function definitions', () => {
      const schema = extractor.extract({
        functions: [
          {
            name: 'calculateDiscount',
            returnType: 'number',
            params: [
              { name: 'amount', type: 'number' },
              { name: 'level', type: 'string' },
            ],
            description: 'Calculate discount based on amount and level',
          },
        ],
      });

      expect(schema.functions).toHaveProperty('calculateDiscount');
      expect(schema.functions.calculateDiscount!.returnType).toBe('number');
      expect(schema.functions.calculateDiscount!.params).toHaveLength(2);
      expect(schema.functions.calculateDiscount!.params[0]!.name).toBe('amount');
      expect(schema.functions.calculateDiscount!.params[0]!.type).toBe('number');
    });

    it('should return empty object when no functions', () => {
      const schema = extractor.extract({});
      expect(schema.functions).toEqual({});
    });
  });

  describe('complete schema extraction', () => {
    it('should extract full schema with all components', () => {
      const schema = extractor.extract({
        rootObject: { orderId: 'ORD-001', totalAmount: 1500.5, paid: false },
        rootName: 'order',
        variables: {
          currentUser: { type: 'object', description: 'Current user' },
        },
        beans: [{ name: 'discountService', type: 'DiscountService' }],
        types: [{ name: 'OrderStatus', description: 'Order status enum' }],
        functions: [
          {
            name: 'sum',
            returnType: 'number',
            params: [{ name: 'values', type: 'array' }],
          },
        ],
      });

      expect(schema.root!.name).toBe('order');
      expect(schema.root!.fields).toHaveProperty('orderId');
      expect(schema.root!.fields).toHaveProperty('totalAmount');
      expect(schema.root!.fields).toHaveProperty('paid');
      expect(schema.variables).toHaveProperty('currentUser');
      expect(schema.beans).toHaveProperty('discountService');
      expect(schema.types).toHaveProperty('OrderStatus');
      expect(schema.functions).toHaveProperty('sum');
    });
  });
});
