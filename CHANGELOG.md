# Changelog

All notable changes to the NL2SpEL project from v0.1.0 onward.

## [0.1.0] — 2025-07-10

### Added

#### Core Engine (`@agentix-e/nl2spel`)
- `NL2SpelEngine` — main engine with `generate()`, `generateBatch()`, `explain()`, `offlineOnly`
- `PatternMatcher` — Layer 0 pattern matching with 40+ built-in patterns in Chinese & English
  - 12 pattern groups: Comparison, NullCheck, Permission, Logical, String, Collection, Range, Elvis, TypeCheck, Boolean, Date, Selection/Projection
  - Support for custom pattern registration via `engine.registerPattern()`
  - P99 latency < 1ms
- `IntentClassifier` — Layer 1 intent classification with 15 NLIntent types
- `TemplateEngine` — Layer 1 template filling with 15 template categories
- `StrategyRouter` — three-layer routing (Pattern → Template → LLM)
- `ValidationPipeline` — four-stage validation (Parse → Type → Semantic → Context)
- `AutoFixer` — automatic fix for 10 common LLM errors (=== → ==, && → and, etc.)
- `SelfCorrectionLoop` — up to 3 iterations of LLM re-generation with error feedback
- `PromptBuilder` — bilingual system prompts with 20 Few-Shot examples and SpEL EBNF
- `ContextExtractor` — extract ContextSchema from plain objects (no spel-ts dependency)
- `SchemaFormatter` — dual-format schema output (LLM-optimized + human-readable)
- `ChineseNumberParser` — Chinese number to Arabic conversion (一千二百三十四 → 1234)
- `ProviderRegistry` — LLM provider registration, ordering, and availability management

#### OpenAI Provider (`@agentix-e/nl2spel-openai`)
- `OpenAICompatibleProvider` — OpenAI-compatible API provider class
- 7 preset configurations: OpenAI, DeepSeek, GLM, Copilot, Hunyuan, MiniMax, Kimi
- Custom provider support for any OpenAI-compatible API
- Streaming support
- Automatic multi-provider fallback

#### WebLLM Provider (`@agentix-e/nl2spel-webllm`)
- `WebLLMProvider` — browser-local LLM inference via @mlc-ai/web-llm
- `GBNFGenerator` — dynamic GBNF grammar generation from ContextSchema
- 4 optimized models: Qwen 2.5 1.5B, Gemma 2 2B, Phi-3 Mini, Llama 3.2 3B
- `detectWebGPU()` — WebGPU availability detection
- `recommendModel()` — automatic model selection based on VRAM
- Model load progress callbacks
- Zero API cost

### Engineering
- 463 tests across 17 test files (388 core + 19 openai + 56 webllm)
- TypeScript strict mode with zero errors
- pnpm workspace monorepo structure
- Zero external dependencies in core package

---
*Format based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).*
