import type { ContextSchema } from '@agentix-e/spel-ts';

// ============================================================
// LLMProvider interface
// ============================================================

/**
 * LLMProvider interface — NL2Spel's pluggable LLM contract.
 *
 * Design principles:
 * 1. Minimal interface: only exposes generate + generateStream + lifecycle
 * 2. Capability declaration: capabilities let StrategyRouter make routing decisions
 * 3. Async lifecycle: supports Providers that need init/dispose (e.g. WebLLM)
 * 4. Stream support: optional generateStream for progressive generation
 */
export interface LLMProvider {
  /** Provider unique name, used for logging/debugging/Provider selection */
  readonly name: string;

  /** Provider capability declaration */
  readonly capabilities: LLMCapabilities;

  /**
   * Generate a SpEL expression (core method)
   */
  generate(prompt: LLMPrompt, options?: LLMGenerateOptions): Promise<LLMResponse>;

  /**
   * Stream generate a SpEL expression (optional implementation)
   */
  generateStream?(prompt: LLMPrompt, options?: LLMGenerateOptions): AsyncIterable<LLMStreamChunk>;

  /**
   * Check if the Provider is currently available
   */
  isAvailable(): Promise<boolean>;

  /**
   * Initialize the Provider (optional)
   */
  initialize?(): Promise<void>;

  /**
   * Release Provider resources (optional)
   */
  dispose?(): Promise<void>;
}

// ============================================================
// LLMCapabilities
// ============================================================

/**
 * LLMProvider capability declaration.
 */
export interface LLMCapabilities {
  /** Maximum context window (tokens) */
  maxContextTokens: number;

  /** Whether Grammar Constraint (GBNF, etc.) is supported */
  supportsGrammarConstraint: boolean;

  /** Whether streaming output is supported */
  supportsStreaming: boolean;

  /** Whether Structured Output (JSON mode) is supported */
  supportsStructuredOutput: boolean;

  /** Whether available offline */
  offlineAvailable: boolean;

  /**
   * Estimated cost per request (USD)
   */
  estimatedCostPerRequest?: number;

  /** Estimated latency (ms) */
  estimatedLatencyMs: number;
}

// ============================================================
// LLM Prompt types
// ============================================================

/**
 * Standardized LLM Prompt structure.
 */
export interface LLMPrompt {
  /** System prompt */
  system: string;

  /** User input */
  user: string;

  /** Context Schema */
  contextSchema: ContextSchema;

  /** Few-Shot example list */
  examples: FewShotExample[];

  /** Grammar constraint string (GBNF format) */
  grammar?: string;
}

/**
 * Few-Shot example
 */
export interface FewShotExample {
  /** Natural language input */
  nl: string;
  /** Expected SpEL expression */
  spel: string;
  /** Difficulty level */
  difficulty: 'easy' | 'medium' | 'hard';
  /** Category */
  category: string;
}

/**
 * LLM generation options
 */
export interface LLMGenerateOptions {
  /** Temperature (0-2), default 0.1 */
  temperature?: number;

  /** Maximum output tokens */
  maxTokens?: number;

  /** Top-p sampling */
  topP?: number;

  /** Stop sequences */
  stopSequences?: string[];

  /** Whether to enable stream */
  stream?: boolean;

  /** Custom model override */
  model?: string;

  /** Timeout (ms), default 30000 */
  timeout?: number;

  /** Maximum retry count */
  maxRetries?: number;
}

/**
 * LLM generation response
 */
export interface LLMResponse {
  /** Raw generated text */
  text: string;

  /** Actual model used */
  model: string;

  /** Token usage statistics */
  usage: LLMUsage;

  /** Generation latency (ms) */
  latencyMs: number;

  /** Finish reason */
  finishReason: 'stop' | 'length' | 'content_filter' | 'error';

  /** Provider name */
  providerName: string;
}

/**
 * LLM Stream Chunk
 */
export interface LLMStreamChunk {
  /** Delta text */
  delta: string;

  /** Accumulated text */
  accumulated: string;

  /** Whether done */
  done: boolean;

  /** Finish reason */
  finishReason?: string;
}

/**
 * Token usage statistics
 */
export interface LLMUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export type { ContextSchema } from '@agentix-e/spel-ts';
