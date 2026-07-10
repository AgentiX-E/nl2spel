import { describe, it, expect } from 'vitest';
import { PromptBuilder } from '../template/prompts/prompt-builder.js';
import type { ContextSchema } from '../SpelEvaluator.js';

const TEST_SCHEMA: ContextSchema = {
  root: {
    name: 'order',
    type: 'Order',
    fields: {
      amount: { type: 'number', description: 'Order amount', example: 1000 },
      status: { type: 'string', description: 'Order status' },
    },
    methods: {},
  },
  variables: { user: { type: 'object', description: 'Current user' } },
  beans: {},
  types: {},
  functions: {},
};

describe('PromptBuilder', () => {
  const builder = new PromptBuilder();

  // ===== PB-G01: Basic prompt building =====
  describe('PB-G01: Basic Prompt Building', () => {
    it('should build Chinese prompt by default', () => {
      const prompt = builder.build('金额大于1000', TEST_SCHEMA);
      expect(prompt.system).toContain('SpEL');
      expect(prompt.user).toContain('金额大于1000');
      expect(prompt.user).toContain('## User Input');
    });

    it('should build English prompt when lang=en', () => {
      const prompt = builder.build('amount > 1000', TEST_SCHEMA, { language: 'en' });
      expect(prompt.system).toContain('Spring Expression Language');
      expect(prompt.user).toContain('amount > 1000');
    });

    it('should include context schema in prompt', () => {
      const prompt = builder.build('金额大于1000', TEST_SCHEMA);
      expect(prompt.user).toContain('Order amount');
    });
  });

  // ===== PB-G02: EBNF grammar =====
  describe('PB-G02: EBNF Grammar', () => {
    it('should include EBNF by default', () => {
      const prompt = builder.build('金额大于1000', TEST_SCHEMA);
      expect(prompt.user).toContain('SpEL EBNF');
      expect(prompt.user).toContain('expression');
    });

    it('should exclude EBNF when includeEBNF=false', () => {
      const prompt = builder.build('amount > 1000', TEST_SCHEMA, { includeEBNF: false });
      expect(prompt.user).not.toContain('SpEL EBNF');
    });
  });

  // ===== PB-G03: Few-Shot examples =====
  describe('PB-G03: Few-Shot Examples', () => {
    it('should include few-shot examples', () => {
      const prompt = builder.build('金额大于1000', TEST_SCHEMA);
      expect(prompt.user).toContain('示例');
      expect(prompt.examples.length).toBeGreaterThan(0);
    });

    it('should have examples spanning all difficulty levels', () => {
      const prompt = builder.build('complex query', TEST_SCHEMA);
      const difficulties = new Set(prompt.examples.map(e => e.difficulty));
      expect(difficulties.has('easy')).toBe(true);
      expect(difficulties.has('medium')).toBe(true);
      expect(difficulties.has('hard')).toBe(true);
    });

    it('should have at least 20 examples', () => {
      const prompt = builder.build('test', TEST_SCHEMA);
      expect(prompt.examples.length).toBeGreaterThanOrEqual(20);
    });
  });

  // ===== PB-G04: System prompts =====
  describe('PB-G04: System Prompts', () => {
    it('Chinese system prompt should mention key SpEL concepts', () => {
      const prompt = builder.build('test', TEST_SCHEMA, { language: 'zh' });
      expect(prompt.system).toContain('Spring Expression Language');
      expect(prompt.system).toContain('#variable');
      expect(prompt.system).toContain('null');
      expect(prompt.system).toContain('and');
      expect(prompt.system).toContain('between');
    });

    it('English system prompt should mention key SpEL concepts', () => {
      const prompt = builder.build('test', TEST_SCHEMA, { language: 'en' });
      expect(prompt.system).toContain('Spring Expression Language');
      expect(prompt.system).toContain('Elvis');
      expect(prompt.system).toContain('projection');
    });
  });

  // ===== PB-G05: Context injection =====
  describe('PB-G05: Context Injection', () => {
    it('should work without context schema', () => {
      const prompt = builder.build('金额大于1000');
      expect(prompt.system).toBeTruthy();
      expect(prompt.user).toBeTruthy();
    });

    it('should include variable descriptions', () => {
      const prompt = builder.build('test', TEST_SCHEMA);
      expect(prompt.user).toContain('Current user');
    });
  });
});
