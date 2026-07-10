import { describe, it, expect } from 'vitest';
import { ChineseNumberParser } from '../utils/chinese-number-parser.js';

describe('ChineseNumberParser', () => {
  describe('isChineseNumber', () => {
    it('should return true for "一千二百三十四"', () => {
      expect(ChineseNumberParser.isChineseNumber('一千二百三十四')).toBe(true);
    });

    it('should return true for "十"', () => {
      expect(ChineseNumberParser.isChineseNumber('十')).toBe(true);
    });

    it('should return false for "123"', () => {
      expect(ChineseNumberParser.isChineseNumber('123')).toBe(false);
    });

    it('should return false for mixed text', () => {
      expect(ChineseNumberParser.isChineseNumber('abc一二三')).toBe(false);
    });
  });

  describe('parse', () => {
    it('零 → 0', () => {
      expect(ChineseNumberParser.parse('零')).toBe(0);
    });

    it('一 → 1', () => {
      expect(ChineseNumberParser.parse('一')).toBe(1);
    });

    it('十 → 10', () => {
      expect(ChineseNumberParser.parse('十')).toBe(10);
    });

    it('十五 → 15', () => {
      expect(ChineseNumberParser.parse('十五')).toBe(15);
    });

    it('二十 → 20', () => {
      expect(ChineseNumberParser.parse('二十')).toBe(20);
    });

    it('一百 → 100', () => {
      expect(ChineseNumberParser.parse('一百')).toBe(100);
    });

    it('一百二十三 → 123', () => {
      expect(ChineseNumberParser.parse('一百二十三')).toBe(123);
    });

    it('一千 → 1000', () => {
      expect(ChineseNumberParser.parse('一千')).toBe(1000);
    });

    it('一千二百三十四 → 1234', () => {
      expect(ChineseNumberParser.parse('一千二百三十四')).toBe(1234);
    });

    it('一万 → 10000', () => {
      expect(ChineseNumberParser.parse('一万')).toBe(10000);
    });

    it('十万 → 100000', () => {
      expect(ChineseNumberParser.parse('十万')).toBe(100000);
    });

    it('一万二千三百四十五 → 12345', () => {
      expect(ChineseNumberParser.parse('一万二千三百四十五')).toBe(12345);
    });

    it('一千零一 → 1001', () => {
      expect(ChineseNumberParser.parse('一千零一')).toBe(1001);
    });

    it('一亿 → 100000000', () => {
      expect(ChineseNumberParser.parse('一亿')).toBe(100000000);
    });

    it('returns NaN for non-Chinese input', () => {
      expect(Number.isNaN(ChineseNumberParser.parse('abc'))).toBe(true);
      expect(Number.isNaN(ChineseNumberParser.parse('123'))).toBe(true);
    });
  });

  describe('parseSafe', () => {
    it('should return number for valid input', () => {
      expect(ChineseNumberParser.parseSafe('一百')).toBe(100);
    });

    it('should return null for invalid input', () => {
      expect(ChineseNumberParser.parseSafe('abc')).toBeNull();
      expect(ChineseNumberParser.parseSafe('123')).toBeNull();
    });
  });

  // Additional edge cases
  describe('edge cases', () => {
    it('两 → 2', () => {
      expect(ChineseNumberParser.parse('两')).toBe(2);
    });

    it('两百 → 200', () => {
      expect(ChineseNumberParser.parse('两百')).toBe(200);
    });

    it('两千 → 2000', () => {
      expect(ChineseNumberParser.parse('两千')).toBe(2000);
    });
  });
});
