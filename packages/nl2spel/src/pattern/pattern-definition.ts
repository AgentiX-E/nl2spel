/**
 * Pattern definition — core data structures for Layer 0.
 *
 * Each PatternDefinition describes a mapping from natural language pattern to SpEL expression.
 * Supports both Chinese and English languages.
 */
export interface PatternDefinition {
  /** Unique identifier */
  id: string;

  /**
   * Match regex (at least one language)
   * Uses named capture groups (?<slotName>...) to extract slots
   */
  match: RegExp;

  /**
   * SpEL template string
   * Uses {slotName} placeholders to reference capture groups
   */
  spelTemplate: string;

  /**
   * Slot definitions (capture groups mapped to SpEL types)
   */
  slots: Record<string, SlotDefinition>;

  /** Priority (0-100), higher priority matched first */
  priority: number;

  /** Tags (for classification and debugging) */
  tags: string[];

  /** Example input/output pairs */
  examples: Array<{
    nl: string;
    spel: string;
  }>;

  /** Difficulty level */
  difficulty: 'easy' | 'medium';

  /** Confidence (0-1) */
  confidence: number;
}

export interface SlotDefinition {
  /** Key appearing in spelTemplate */
  key: string;
  /** SpEL value type: 'number' | 'string' | 'boolean' | 'variable' | 'literal' */
  type: 'number' | 'string' | 'boolean' | 'variable' | 'literal';
  /** Optional: value transformer (e.g. Chinese numbers → number) */
  transform?: SlotTransform;
  /** Optional: default value */
  defaultValue?: string;
}

export type SlotTransform =
  'toNumber' | 'toBoolean' | 'toString' | 'trim' | 'lowercase' | 'normalize';
