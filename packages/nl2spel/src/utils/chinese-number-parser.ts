/**
 * Chinese number parser — converts Chinese number strings to Arabic numerals.
 *
 * Supports:
 * - Basic digits: 零一二三四五六七八九十百千万亿
 * - Leading "十": "十五" → 15
 * - Thousands/hundred-millions grouping: "一万二千三百四十五" → 12345
 * - Zero padding: "一千零一" → 1001
 */
export class ChineseNumberParser {
  private static readonly DIGITS: Record<string, number> = {
    零: 0,
    一: 1,
    二: 2,
    三: 3,
    四: 4,
    五: 5,
    六: 6,
    七: 7,
    八: 8,
    九: 9,
    两: 2,
  };

  private static readonly UNITS: Record<string, number> = {
    十: 10,
    百: 100,
    千: 1000,
    万: 10000,
    亿: 100000000,
  };

  private static readonly CHINESE_NUM_PATTERN = /^[零一二三四五六七八九十百千万亿两]+$/;

  /**
   * Check if a string is pure Chinese numbers
   */
  public static isChineseNumber(text: string): boolean {
    return this.CHINESE_NUM_PATTERN.test(text);
  }

  /**
   * Parse Chinese numbers → Arabic numerals
   *
   * @param text Chinese number string
   * @returns Parsed number, returns NaN on failure
   */
  public static parse(text: string): number {
    if (!this.isChineseNumber(text)) {
      return NaN;
    }

    // Handle leading "十" → "一十"
    let s = text;
    if (s.startsWith('十')) {
      s = '一' + s;
    }

    let result = 0; // Accumulated result for hundreds-millions and above
    let section = 0; // Ten-thousands segment
    let current = 0; // Current digit (thousands and below)

    for (const ch of s) {
      const digit = this.DIGITS[ch];
      if (digit !== undefined) {
        // Digit character
        current = digit;
      } else {
        const unit = this.UNITS[ch];
        if (unit === undefined) continue;

        if (unit >= 10000) {
          // Hundreds-millions/ten-thousands segment: section has accumulated values below
          // plus current digit, multiply by unit
          // e.g. "十万" → section=10, current=0 → result += 10 * 10000 = 100000
          // e.g. "十二万" → section=10, current=2 → result += 12 * 10000 = 120000
          result += (section + current || 1) * unit;
          section = 0;
          current = 0;
        } else {
          // Tens/hundreds/thousands
          section += (current || 1) * unit;
          current = 0;
        }
      }
    }

    return result + section + current;
  }

  /**
   * Safe parse: returns null if parsing fails
   */
  public static parseSafe(text: string): number | null {
    const value = this.parse(text);
    return Number.isNaN(value) ? null : value;
  }
}
