# Changelog

All notable changes to the NL2SpEL project.

## [1.4.0] — 2026-09-13

### Added
- `pattern/clause-splitter.ts` — splits a compound sentence on its top-level
  logical connectors and converts each clause independently, so a rule that joins
  conditions is no longer answered with only its first clause. Exports
  `splitClauses`, `decompose` and `UnconvertibleClauseError`.
- `PatternMatcherOptions.fieldPolicy` (`'passthrough' | 'strict'`), default
  `passthrough`, with `UnmappedFieldError` for the strict setting.
- `PatternMatchResult.unmappedFields` — the field words emitted verbatim because
  the dictionary had no entry, so the guess is never silent.
- `docs/architecture.md` — pipeline stages, the guarantees of each entry point,
  the field-resolution policy and the validation stages.
- `docs/user-guide.md` — the verified natural-language phrasings and their SpEL,
  the field policy, and the known limitations.
- `builtin-patterns.contract.test.ts` — asserts every built-in pattern reproduces
  its own declared `examples`, in isolation. This is the pattern specification.
- `nl-to-spel-corpus.test.ts` — asserts the expression a caller actually receives
  for a corpus of rules, end to end, where pattern priorities and clause
  decomposition decide the outcome.
- `clause-splitter.test.ts`, `field-policy.test.ts`,
  `validation-pipeline-strictness.test.ts`, `template-engine-null-intent.test.ts`.

### Changed
- Development and verification now run against `@agentix-e/spel-ts` 2.0.0. The peer
  range stays `>=1.1.0`, because every symbol this package takes from spel-ts is a type,
  the consumed surface is unchanged between 1.2.2 and 2.0.0, and there is no runtime
  import of it at all.
- **A compound rule is refused rather than truncated.** A sentence joining
  conditions is decomposed; if any clause cannot be converted, the request fails
  with `UnconvertibleClauseError` naming that clause. Previously
  `金额大于1000且订单已确认` returned `#amount > 1000`, silently dropping the
  confirmation requirement. `and` is grouped to bind tighter than `or`, and every
  operand is parenthesised.
- **A pattern tagged `logic` is preferred over decomposition**, so `a and b` still
  becomes `(a) and (b)` rather than being split into unconvertible clauses.
- **Coverage thresholds raised to 95 on all four dimensions in all three
  packages.** They were previously 90 for functions and lines everywhere, and 92
  or 93 for statements and branches in the provider packages.
- `validation-pipeline.ts` — literal boundaries no longer come from the engine's
  lexer, so a validation verdict no longer depends on the engine build being able
  to lex the expression. A lexer failure in the completeness gate is no longer
  read as truncation.

### Fixed
- **Range templates emitted a nested list.** `CN-RANGE-BETWEEN` and
  `EN-RANGE-BETWEEN` rendered `{{18, 60}}` instead of `{18, 60}`, so every range
  rule was rejected by the engine.
- **`AutoFixer` corrupted valid expressions.** It applied whole-string regexes
  with no awareness of string literals and "balanced" brackets by counting
  delimiters over the whole string, so it rewrote literal contents and appended
  closers for delimiters it could only see inside literals — 4 of 9 valid
  expressions were corrupted. Rewrites now apply only outside literals, and the
  delimiter-counting repair is gone.
- **The validation pipeline could not reject anything.** The type, semantic and
  context stages pushed only warnings, while the verdict was computed from the
  error list, so they were decorative: a truncated expression and an unknown
  schema field both passed. Each stage now has a severity, a supplied
  `contextSchema` makes an unresolved reference an error, and a final stage
  rejects an expression that is manifestly incomplete.
- **`不为空` produced `== null`.** The emptiness heuristic matched the negated
  phrasing too, so both templates scored equally and the first — `== null` — won.
  `非空` was not recognised as a null check at all, and the null templates leaked
  the placeholder `field` into their output.
- **Pattern field capture truncated Chinese field names.** `订单金额大于1000`
  yielded `#订单 > 1000`: the lazy field group stopped early and the optional
  operator-noun group swallowed the rest. Several patterns also failed to match
  their own declared examples, and the selection and projection templates emitted
  malformed SpEL.

## [1.3.0] — 2026-07-19

### Added
- Open Graph tags, a meta description, a "What is X" section and an FAQ for the
  landing page and the API documentation.

### Changed
- `LLMCapabilities` no longer carries `cost` or `latency`. Provider ordering is
  external, so a provider is described by what it can do rather than by figures
  that could not be substantiated; the README lost the claims that rested on them.
- The `exports` order and the `.npmrc` were corrected, and the benchmark imports
  repaired.

## [1.2.2] — 2026-07-15

### Added
- CommonJS output: `tsup` now emits ESM and CJS, and the published `files` array
  covers what it produces.

### Fixed
- Offline templates left unfilled slots in their output; a slot with no value is
  now resolved with its default.

## [1.2.1] — 2026-07-15

### Fixed
- The arbitrary `ContextSchema` depth limit is gone. Extraction recurses to the
  bottom and detects circular references instead of stopping at a fixed depth.

## [1.2.0] — 2026-07-15

### Added
- Recursive `ContextSchema` extraction, which had stopped at the top-level
  properties.

### Changed
- Coverage thresholds raised to 95% on every dimension, and `vitest` moved to 3.x.
- The `spel-ts` dependency moved to `^1.2.0`.

## [1.1.2] — 2026-07-14

### Fixed
- Unused imports, configuration inconsistencies and type-safety defects.
- Cross-repository links, badges and version references made coherent.

## [1.1.1] — 2026-07-13

### Fixed
- **PromptBuilder English filter bug**: Replaced broken `.toLowerCase()` check with CJK character detection for accurate English/Chinese example filtering
- **CONTRIBUTING.md branch name**: Changed all `main` references to `master` to match actual default branch
- **AutoFixResult redundant field**: Removed unused `fixed` field from `AutoFixResult` interface
- **SelfCorrectionLoop duplicate logs**: Fixed duplicate attempt=0 log entries in correction loop
- **Sub-package peerDeps**: Changed `workspace:*` to `>=1.1.0` in `nl2spel-openai` and `nl2spel-webllm` peerDependencies for npm compatibility
- **Phantom peerDependencies**: Removed unused `ai` and `@ai-sdk/openai` from `nl2spel-openai` peerDeps
- **GBNF dead code**: Commented out unused GBNF generation call in WebLLM provider
- **Documentation**: Updated stale test counts (534/73 core/webllm) and pattern count (63)

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
- **650 vitest tests** across 19 test files (534 core + 43 openai + 73 webllm)
- **2 Playwright browser tests** in real Chromium (model-configs)
- **Real DeepSeek integration tests** — 1 test (16 skipped when API key absent) covering comparison, null, logical, range, collection, permission, streaming, error handling
- **Mocked fetch tests** — 42 tests for OpenAI provider (generate, stream, error paths, retry)
- **Core**: 99.67% statements / 95.45% branches / 100% functions
- **OpenAI**: 100% statements / 98.85% branches / 100% functions
- **WebLLM**: 100% statements / 98.73% branches / 100% functions

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
- `NL2SpelEngine` — main engine with `generate()`, `generateBatch()`, `explain()`; `offlineOnly` mode via `generate(nl, { offlineOnly: true })`
- `PatternMatcher` — Layer 0 pattern matching with 40+ built-in patterns in Chinese & English
  - 12 pattern groups: Comparison, NullCheck, Permission, Logical, String, Collection, Range, Elvis, TypeCheck, Boolean, Date, Selection/Projection (63 built-in patterns)
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
