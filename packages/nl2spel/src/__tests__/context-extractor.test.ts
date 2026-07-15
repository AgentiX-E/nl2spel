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

  describe('extractFields catch block', () => {
    it('should skip inaccessible properties without crashing', () => {
      const obj: Record<string, unknown> = { normal: 42 };
      let getterCalled = false;
      Object.defineProperty(obj, 'bad', {
        get() {
          getterCalled = true;
          throw new Error('Access denied');
        },
        enumerable: true,
        configurable: true,
      });
      Object.defineProperty(obj, 'good', {
        value: 'hello',
        enumerable: true,
      });

      const schema = extractor.extract({ rootObject: obj });
      expect(getterCalled).toBe(true);
      expect(schema.root!.fields.normal!.type).toBe('number');
      expect(schema.root!.fields.good!.type).toBe('string');
      // 'bad' should be skipped entirely
      expect(schema.root!.fields.bad).toBeUndefined();
    });
  });

  describe('safeExample for objects', () => {
    it('should return undefined for object-type field values', () => {
      const schema = extractor.extract({
        rootObject: { nested: { x: 1 }, label: 'hello' },
      });

      expect(schema.root!.fields.nested!.type).toBe('object');
      expect(schema.root!.fields.nested!.example).toBeUndefined();
      expect(schema.root!.fields.label!.type).toBe('string');
      expect(schema.root!.fields.label!.example).toBe('hello');
    });
  });

  describe('extractVariables nullable default', () => {
    it('should default nullable to false when not specified', () => {
      const schema = extractor.extract({
        variables: { x: { type: 'number', value: 10 } },
      });

      expect(schema.variables.x!.nullable).toBe(false);
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

  describe('edge cases', () => {
    it('should set elementType to undefined for arrays with 0 elements', () => {
      const schema = extractor.extract({
        rootObject: { items: [] },
      });

      expect(schema.root!.fields.items!.isCollection).toBe(true);
      expect(schema.root!.fields.items!.type).toBe('array');
      expect(schema.root!.fields.items!.elementType).toBeUndefined();
    });

    it('should detect Date field type as "date"', () => {
      const schema = extractor.extract({
        rootObject: { createdAt: new Date('2025-06-01'), label: 'invoice' },
      });

      expect(schema.root!.fields.createdAt!.type).toBe('date');
      expect(schema.root!.fields.label!.type).toBe('string');
    });

    it('should extract null-valued root properties (they are in Object.keys)', () => {
      const schema = extractor.extract({
        rootObject: { a: null, b: 'hello' },
      });

      expect(schema.root!.fields.a).toBeDefined();
      expect(schema.root!.fields.a!.nullable).toBe(true);
      expect(schema.root!.fields.a!.type).toBe('string');
      expect(schema.root!.fields.a!.example).toBeNull();
      expect(schema.root!.fields.b!.nullable).toBe(false);
    });

    it('should extract full context with root, variables, beans, types, and functions', () => {
      const schema = extractor.extract({
        rootObject: { id: 100, name: 'demo' },
        rootName: 'entity',
        variables: {
          counter: { type: 'number', description: 'Loop counter', value: 0 },
          status: { type: 'string', nullable: true },
        },
        beans: [
          { name: 'svc', type: 'MyService', description: 'Core service' },
          { name: 'transient', type: 'Worker', singleton: false },
        ],
        types: [
          { name: 'StatusEnum', className: 'com.example.StatusEnum' },
          { name: 'MarkerInterface', description: 'Just a marker' },
        ],
        functions: [
          {
            name: 'max',
            returnType: 'number',
            params: [
              { name: 'a', type: 'number' },
              { name: 'b', type: 'number' },
            ],
            description: 'Returns larger value',
          },
        ],
      });

      // Root
      expect(schema.root).not.toBeNull();
      expect(schema.root!.name).toBe('entity');
      expect(schema.root!.fields.id!.type).toBe('number');
      expect(schema.root!.fields.name!.type).toBe('string');

      // Variables
      expect(schema.variables.counter!.type).toBe('number');
      expect(schema.variables.counter!.value).toBe(0);
      expect(schema.variables.status!.nullable).toBe(true);

      // Beans
      expect(schema.beans.svc!.type).toBe('MyService');
      expect(schema.beans.svc!.description).toBe('Core service');
      expect(schema.beans.transient!.singleton).toBe(false);

      // Types
      expect(schema.types.StatusEnum!.className).toBe('com.example.StatusEnum');
      expect(schema.types.MarkerInterface!.className).toBeUndefined();
      expect(schema.types.MarkerInterface!.description).toBe('Just a marker');

      // Functions
      expect(schema.functions.max!.returnType).toBe('number');
      expect(schema.functions.max!.params).toHaveLength(2);
      expect(schema.functions.max!.params[0]!.name).toBe('a');
    });

    it('should extract variable with nullable=true', () => {
      const schema = extractor.extract({
        variables: { opt: { type: 'string', nullable: true } },
      });

      expect(schema.variables.opt!.nullable).toBe(true);
    });

    it('should extract bean with singleton=true', () => {
      const schema = extractor.extract({
        beans: [{ name: 'singleton', type: 'Cache', singleton: true }],
      });

      expect(schema.beans.singleton!.singleton).toBe(true);
    });

    it('should extract bean with singleton=false', () => {
      const schema = extractor.extract({
        beans: [{ name: 'prototype', type: 'Worker', singleton: false }],
      });

      expect(schema.beans.prototype!.singleton).toBe(false);
    });

    it('should extract type with className', () => {
      const schema = extractor.extract({
        types: [{ name: 'WithClass', className: 'com.example.MyClass' }],
      });

      expect(schema.types.WithClass!.className).toBe('com.example.MyClass');
    });

    it('should extract type without className', () => {
      const schema = extractor.extract({
        types: [{ name: 'NoClass', description: 'Interface without class binding' }],
      });

      expect(schema.types.NoClass).toBeDefined();
      expect(schema.types.NoClass!.className).toBeUndefined();
      expect(schema.types.NoClass!.description).toBe('Interface without class binding');
    });
  });
});

// ====================================================================
// Recursive extraction tests — nested objects
// ====================================================================
describe('ContextExtractor — recursive nested extraction', () => {
  const extractor = new ContextExtractor();

  it('extracts single-level object fields', () => {
    const schema = extractor.extract({
      rootObject: { amount: 100, status: 'active' },
    });
    expect(schema.root?.fields?.amount.type).toBe('number');
    expect(schema.root?.fields?.status.type).toBe('string');
  });

  it('extracts nested object fields recursively', () => {
    const schema = extractor.extract({
      rootObject: {
        order: {
          amount: 500,
          customer: {
            name: 'Alice',
            tier: 'premium',
            address: {
              city: 'Beijing',
              zip: '100000',
            },
          },
        },
      },
    });
    const order = schema.root?.fields?.order;
    expect(order?.type).toBe('object');
    expect(order?.fields?.amount?.type).toBe('number');
    expect(order?.fields?.customer?.type).toBe('object');
    expect(order?.fields?.customer?.fields?.name?.type).toBe('string');
    expect(order?.fields?.customer?.fields?.tier?.type).toBe('string');
    expect(order?.fields?.customer?.fields?.address?.type).toBe('object');
    expect(order?.fields?.customer?.fields?.address?.fields?.city?.type).toBe('string');
    expect(order?.fields?.customer?.fields?.address?.fields?.zip?.type).toBe('string');
  });

  it('extracts arrays with elementType', () => {
    const schema = extractor.extract({
      rootObject: { tags: ['urgent', 'review'] },
    });
    expect(schema.root?.fields?.tags?.type).toBe('array');
    expect(schema.root?.fields?.tags?.elementType).toBe('string');
    expect(schema.root?.fields?.tags?.isCollection).toBe(true);
  });

  it('extracts null fields correctly', () => {
    const schema = extractor.extract({
      rootObject: { optionalField: null },
    });
    expect(schema.root?.fields?.optionalField?.nullable).toBe(true);
  });

  it('extracts mixed nested and flat fields', () => {
    const schema = extractor.extract({
      rootObject: {
        id: 1,
        name: 'Order',
        details: {
          priority: 'high',
          flags: ['expedited'],
        },
        total: 99.99,
      },
    });
    expect(schema.root?.fields?.id?.type).toBe('number');
    expect(schema.root?.fields?.name?.type).toBe('string');
    expect(schema.root?.fields?.total?.type).toBe('number');
    expect(schema.root?.fields?.details?.type).toBe('object');
    expect(schema.root?.fields?.details?.fields?.priority?.type).toBe('string');
    expect(schema.root?.fields?.details?.fields?.flags?.type).toBe('array');
  });

  it('extracts deeply nested objects to the bottom', () => {
    const deepObj = {
      l1: { l2: { l3: { l4: { deepest: 'reached' } } } },
    };
    const schema = extractor.extract({ rootObject: deepObj });
    const l3 = schema.root?.fields?.l1?.fields?.l2?.fields?.l3?.fields;
    expect(l3?.l4?.type).toBe('object');
    expect(l3?.l4?.fields?.deepest?.type).toBe('string');
  });

  it('detects circular reference without infinite recursion', () => {
    const obj: Record<string, unknown> = { name: 'root' };
    obj.self = obj;
    const schema = extractor.extract({ rootObject: obj });
    expect(schema.root?.fields?.name?.type).toBe('string');
    expect(Object.keys(schema.root?.fields?.self?.fields ?? {}).length).toBe(0);
  });
});
