# Changelog

All notable changes to the NL2SpEL project.

## [1.1.1] — 2026-07-13

### Fixed
- **PromptBuilder English filter bug**: Replaced broken `.toLowerCase()` check with CJK character detection for accurate English/Chinese example filtering
- **CONTRIBUTING.md branch name**: Changed all `main` references to `master` to match actual default branch
- **AutoFixResult redundant field**: Removed unused `fixed` field from `AutoFixResult` interface
- **SelfCorrectionLoop duplicate logs**: Fixed duplicate attempt=0 log entries in correction loop
- **Sub-package peerDeps**: Changed `workspace:*` to `>=1.1.0` in `nl2spel-openai` and `nl2spel-webllm` peerDependencies for npm compatibility
- **Phantom peerDependencies**: Removed unused `ai` and `@ai-sdk/openai` from `nl2spel-openai` peerDeps
- **GBNF dead code**: Commented out unused GBNF generation call in WebLLM provider
- **Documentation**: Updated stale test counts (527/68 core/webllm) and pattern count (48+)

## [1.1.0] — 2026-07-12

### Changed
- **Type imports migration**: `PromptBuilder` changed from type-only to value import in `nl2spel-openai` to fix `require()` in ESM module
- **SelfCorrectionLoop fix**: Removed dynamic `require()` call in `defaultPromptBuilder()`, replaced with static ES module import

### Fixed
- **P0**: `require()` call in ESM module (`openai-compatible-provider.ts`) — replaced with static import
- **P0**: `workspace:*` in peerDependencies — replaced with `>=1.1.0` in both `nl2spel-openai` and `nl2spel-webllm`
- **P0**: Phantom peerDependencies (`ai`, `@ai-sdk/openai`) removed from `nl2spel-openai`
- **P1**: Dead vitest coverage exclusions (`SpelEvaluator.ts`, `src/strategy/strategies/**`) removed

### Dependencies
- **`@agentix-e/spel-ts`**: Made optional peer dependency in core package
- Sub-packages bumped to v1.1.0 to match core

## [1.0.0] — 2026-07-12

### 🏗 Architecture
- **Removed redundant GPU detection layer** — `webgpu-detector.ts` deleted; WebLLM's `CreateMLCEngine` handles GPU detection natively
- **Removed dead code**: `determineGPULevel()` (unused return value), `ensureInitialized()` (inlined)
- WebLLM package: 4 → 3 source files (net -475 lines)

### 🧪 Testing
- **650 vitest tests** across 19 test files (527 core + 55 openai + 68 webllm)
- **7 Playwright browser tests** in real Chromium (model-configs)
- **Real DeepSeek integration tests** — 17 tests covering comparison, null, logical, range, collection, permission, streaming, error handling
- **Mocked fetch tests** — 19 tests for OpenAI provider (generate, stream, error paths, retry)
- **Core**: 99.6% statements / 94.95% branches / 100% functions
- **OpenAI**: 100% statements / 95.12% branches / 100% functions
- **WebLLM**: 100% statements / 92.3% branches / 100% functions

### 🔧 CI/CD
- **Single unified `ci.yml`** — 6 jobs: Lint/TypeCheck, Tests/Coverage, Benchmark, Browser Tests, API Docs, GitHub Pages
- **Dual Pages deployment** — workflow deploy + gh-pages branch fallback
- **GitHub Pages** — Home, User Guide, API Docs, Coverage Report, Benchmark Report
- **Local=CI zero drift** — husky pre-commit mirrors CI quality gates
- **Playwright browser tests** in CI pipeline

### 📦 Release
- **Trusted Publisher (OIDC)** via `release.yml` — Node 24 + npm 11.x native OIDC, no stored tokens
- **Skip already-published** versions
- **npm provenance** attestation

### 🔒 Security
- `.env` / `.env.*.local` gitignored
- API key never in code or CI logs
- GitHub secret masking for `DEEPSEEK_API_KEY`

### 🧹 Code Quality
- Auto-fixer: removed unreachable `??` fallbacks → 100% branches
- Provider-registry: restructured sort for clean branch detection
- GBNF generator: removed unreachable else branch and unused fieldRule
- OpenAI provider: removed unreachable `??` in throw, stream path
- TypeScript strict mode, zero errors
- Prettier 100% formatting consistency
- English-only documentation

---

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
- 594 tests across 18 test files (502 core + 36 openai + 56 webllm)
- TypeScript strict mode with zero errors
- pnpm workspace monorepo structure
- Zero external dependencies in core package

---
*Format based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).*
