// Core public API — @agentix-e/nl2spel

// SpelEvaluator types
export type {
  SpelEvaluator,
  ParseResult,
  ParseError,
  ContextSchema,
  RootObjectSchema,
  FieldSchema,
  VariableSchema,
  BeanSchema,
  TypeSchema,
  MethodSchema,
  FunctionSchema,
} from './SpelEvaluator.js';

// LLMProvider types
export type {
  LLMProvider,
  LLMCapabilities,
  LLMPrompt,
  LLMGenerateOptions,
  LLMResponse,
  LLMStreamChunk,
  LLMUsage,
  FewShotExample,
} from './provider/llm-provider.js';

// ProviderRegistry
export { ProviderRegistry } from './provider/provider-registry.js';

// Context
export { ContextExtractor } from './context/context-extractor.js';
export { SchemaFormatter } from './context/schema-formatter.js';

// Pattern (Layer 0)
export type {
  PatternDefinition,
  SlotDefinition,
  SlotTransform,
} from './pattern/pattern-definition.js';
export { PatternMatcher } from './pattern/pattern-matcher.js';
export type { PatternMatchResult } from './pattern/pattern-matcher.js';
export { BUILTIN_PATTERNS } from './pattern/builtin-patterns.js';

// Template (Layer 1)
export { NLIntent } from './template/nl-intent.js';
export { IntentClassifier } from './template/intent-classifier.js';
export type { IntentResult, IntentEntity } from './template/intent-classifier.js';
export { TemplateEngine } from './template/template-engine.js';
export type { TemplateResult } from './template/template-engine.js';
export { PromptBuilder } from './template/prompts/prompt-builder.js';
export type { PromptBuilderOptions } from './template/prompts/prompt-builder.js';

// Validation (Layer 2)
export { ValidationPipeline } from './validation/validation-pipeline.js';
export type {
  ValidationResult,
  ValidationError,
  ValidationWarning,
  StageResult,
} from './validation/validation-pipeline.js';
export { AutoFixer } from './validation/auto-fixer.js';
export type { AutoFixResult } from './validation/auto-fixer.js';
export { SelfCorrectionLoop } from './validation/self-correction-loop.js';
export type {
  SelfCorrectionResult,
  CorrectionLog,
  SelfCorrectionConfig,
} from './validation/self-correction-loop.js';

// Strategy Router (Layer 2)
export { StrategyRouter } from './strategy/strategy-router.js';
export type {
  StrategyType,
  StrategyResult,
  StrategyMetadata,
  StrategyRouterConfig,
} from './strategy/strategy-router.js';

// NL2Spel Engine
export { NL2SpelEngine } from './engine/nl2spel-engine.js';
export type {
  GenerateOptions,
  GenerateResult,
  ExplainResult,
  DebugInfo,
} from './engine/nl2spel-engine.js';

// Utils
export { ChineseNumberParser } from './utils/chinese-number-parser.js';
