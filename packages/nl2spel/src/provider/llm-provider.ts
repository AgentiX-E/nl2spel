import type { ContextSchema } from '../SpelEvaluator.js';

// ============================================================
// LLMProvider 接口
// ============================================================

/**
 * LLMProvider 接口 —— NL2Spel 的 LLM 可插拔契约。
 *
 * 设计原则:
 * 1. 最小接口: 仅暴露 generate + generateStream + lifecycle
 * 2. 能力声明: capabilities 让 StrategyRouter 做路由决策
 * 3. 异步生命周期: 支持 WebLLM 等需要初始化/销毁的 Provider
 * 4. 流式支持: 可选 generateStream 用于渐进式生成
 */
export interface LLMProvider {
  /** Provider 唯一名称，用于日志/调试/Provider 选择 */
  readonly name: string;

  /** Provider 能力声明 */
  readonly capabilities: LLMCapabilities;

  /**
   * 生成 SpEL 表达式（核心方法）
   */
  generate(prompt: LLMPrompt, options?: LLMGenerateOptions): Promise<LLMResponse>;

  /**
   * 流式生成 SpEL 表达式（可选实现）
   */
  generateStream?(prompt: LLMPrompt, options?: LLMGenerateOptions): AsyncIterable<LLMStreamChunk>;

  /**
   * 检查 Provider 当前是否可用
   */
  isAvailable(): Promise<boolean>;

  /**
   * 初始化 Provider（可选）
   */
  initialize?(): Promise<void>;

  /**
   * 释放 Provider 资源（可选）
   */
  dispose?(): Promise<void>;
}

// ============================================================
// LLMCapabilities
// ============================================================

/**
 * LLMProvider 的能力声明。
 */
export interface LLMCapabilities {
  /** 最大上下文窗口 (tokens) */
  maxContextTokens: number;

  /** 是否支持 Grammar Constraint（GBNF 等） */
  supportsGrammarConstraint: boolean;

  /** 是否支持流式输出 */
  supportsStreaming: boolean;

  /** 是否支持 Structured Output（JSON mode） */
  supportsStructuredOutput: boolean;

  /** 是否可离线使用 */
  offlineAvailable: boolean;

  /**
   * 单次请求估算成本（美元）
   */
  estimatedCostPerRequest?: number;

  /** 估算延迟 (ms) */
  estimatedLatencyMs: number;
}

// ============================================================
// LLM Prompt 类型
// ============================================================

/**
 * 标准化的 LLM Prompt 结构。
 */
export interface LLMPrompt {
  /** 系统提示词 */
  system: string;

  /** 用户输入 */
  user: string;

  /** 上下文 Schema */
  contextSchema: ContextSchema;

  /** Few-Shot 示例列表 */
  examples: FewShotExample[];

  /** 语法约束字符串（GBNF 格式） */
  grammar?: string;
}

/**
 * Few-Shot 示例
 */
export interface FewShotExample {
  /** 自然语言输入 */
  nl: string;
  /** 期望的 SpEL 表达式 */
  spel: string;
  /** 难度等级 */
  difficulty: 'easy' | 'medium' | 'hard';
  /** 所属分类 */
  category: string;
}

/**
 * LLM 生成选项
 */
export interface LLMGenerateOptions {
  /** 温度 (0-2)，默认 0.1 */
  temperature?: number;

  /** 最大输出 tokens */
  maxTokens?: number;

  /** Top-p 采样 */
  topP?: number;

  /** 停止序列 */
  stopSequences?: string[];

  /** 是否启用 stream */
  stream?: boolean;

  /** 自定义模型覆盖 */
  model?: string;

  /** 超时 (ms)，默认 30000 */
  timeout?: number;

  /** 最大重试次数 */
  maxRetries?: number;
}

/**
 * LLM 生成响应
 */
export interface LLMResponse {
  /** 原始生成文本 */
  text: string;

  /** 实际使用的模型 */
  model: string;

  /** Token 使用统计 */
  usage: LLMUsage;

  /** 生成耗时 (ms) */
  latencyMs: number;

  /** 完成原因 */
  finishReason: 'stop' | 'length' | 'content_filter' | 'error';

  /** Provider 名称 */
  providerName: string;
}

/**
 * LLM Stream Chunk
 */
export interface LLMStreamChunk {
  /** 增量文本 */
  delta: string;

  /** 累积文本 */
  accumulated: string;

  /** 是否完成 */
  done: boolean;

  /** 完成原因 */
  finishReason?: string;
}

/**
 * Token 使用统计
 */
export interface LLMUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export type { ContextSchema } from '../SpelEvaluator.js';
