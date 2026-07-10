/**
 * 中文数字解析器 —— 将中文数字字符串转换为阿拉伯数字。
 *
 * 支持:
 * - 基本数字: 零一二三四五六七八九十百千万亿
 * - "十" 开头: "十五" → 15
 * - 万/亿 分段: "一万二千三百四十五" → 12345
 * - "零" 占位: "一千零一" → 1001
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
   * 检查字符串是否为纯中文数字
   */
  public static isChineseNumber(text: string): boolean {
    return this.CHINESE_NUM_PATTERN.test(text);
  }

  /**
   * 解析中文数字 → 阿拉伯数字
   *
   * @param text 中文数字字符串
   * @returns 解析后的数字，失败返回 NaN
   */
  public static parse(text: string): number {
    if (!this.isChineseNumber(text)) {
      return NaN;
    }

    // 处理 "十" 开头 → "一十"
    let s = text;
    if (s.startsWith('十')) {
      s = '一' + s;
    }

    let result = 0; // 亿级及以上累积结果
    let section = 0; // 万级分段
    let current = 0; // 当前数字（千及以下）

    for (const ch of s) {
      const digit = this.DIGITS[ch];
      if (digit !== undefined) {
        // 数字字符
        current = digit;
      } else {
        const unit = this.UNITS[ch];
        if (unit === undefined) continue;

        if (unit >= 10000) {
          // 万/亿分段: section 已累计千以下值，加上当前数字后乘以单位
          // e.g. "十万" → section=10, current=0 → result += 10 * 10000 = 100000
          // e.g. "十二万" → section=10, current=2 → result += 12 * 10000 = 120000
          result += (section + current || 1) * unit;
          section = 0;
          current = 0;
        } else {
          // 十/百/千
          section += (current || 1) * unit;
          current = 0;
        }
      }
    }

    return result + section + current;
  }

  /**
   * 安全解析：如果解析失败返回 null
   */
  public static parseSafe(text: string): number | null {
    const value = this.parse(text);
    return Number.isNaN(value) ? null : value;
  }
}
