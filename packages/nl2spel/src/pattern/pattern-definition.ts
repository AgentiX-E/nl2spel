/**
 * 模式定义 —— Layer 0 的核心数据结构。
 *
 * 每条 PatternDefinition 描述一个自然语言模式到 SpEL 表达式的映射。
 * 支持中文和英文双语言。
 */
export interface PatternDefinition {
  /** 唯一标识符 */
  id: string;

  /**
   * 匹配正则（至少一种语言）
   * 使用命名捕获组 (?<slotName>...) 提取槽位
   */
  match: RegExp;

  /**
   * SpEL 模板字符串
   * 使用 {slotName} 占位符引用捕获组
   */
  spelTemplate: string;

  /**
   * 槽位定义（捕获组映射到 SpEL 类型）
   */
  slots: Record<string, SlotDefinition>;

  /** 优先级 (0-100), 高优先级先匹配 */
  priority: number;

  /** 标签（用于分类和调试） */
  tags: string[];

  /** 示例输入输出对 */
  examples: Array<{
    nl: string;
    spel: string;
  }>;

  /** 难度等级 */
  difficulty: 'easy' | 'medium';

  /** 置信度 (0-1) */
  confidence: number;
}

export interface SlotDefinition {
  /** 在 spelTemplate 中出现的键 */
  key: string;
  /** SpEL 值类型: 'number' | 'string' | 'boolean' | 'variable' | 'literal' */
  type: 'number' | 'string' | 'boolean' | 'variable' | 'literal';
  /** 可选：值转换器 (e.g. 中文数字 → number) */
  transform?: SlotTransform;
  /** 可选：默认值 */
  defaultValue?: string;
}

export type SlotTransform =
  'toNumber' | 'toBoolean' | 'toString' | 'trim' | 'lowercase' | 'normalize';
