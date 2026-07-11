# @agentix-e/nl2spel

> Natural Language → SpEL Core Engine
>
> Zero external deps · Four-layer hybrid architecture · 502 tests · Chinese & English

[![npm](https://img.shields.io/npm/v/@agentix-e/nl2spel)](https://www.npmjs.com/package/@agentix-e/nl2spel)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](../../LICENSE)

---

## API Documentation

Full API documentation → [nl2spel API](https://agentix-e.github.io/nl2spel/api/modules.html)

## Core Modules

```typescript
import {
  NL2SpelEngine,        // Main engine
  PatternMatcher,       // Layer 0: Pattern matching (35+ built-in patterns)
  IntentClassifier,     // Layer 1: Intent classification (15 NLIntent types)
  TemplateEngine,       // Layer 1: Template filling (15 template categories)
  PromptBuilder,        // Layer 2: LLM Prompt construction
  ValidationPipeline,   // Validation pipeline (4 stages)
  AutoFixer,            // Auto-fixer (10 error types)
  SelfCorrectionLoop,   // Self-correction loop (max 3 iterations)
  StrategyRouter,       // Strategy router (Pattern → Template → LLM)
  ContextExtractor,     // Context extraction
  SchemaFormatter,      // Schema formatting
  ChineseNumberParser,  // Chinese number parsing
  ProviderRegistry,     // Provider registration management
} from '@agentix-e/nl2spel';
```

## Architecture

```
NL2SpelEngine
├── StrategyRouter          (Three-layer strategy routing)
│   ├── Layer 0: PatternMatcher    (35+ built-in patterns, P99 < 1ms)
│   ├── Layer 1: TemplateEngine    (15 intents, 15 template categories)
│   └── Layer 2: LLMProvider       (Pluggable, via ProviderRegistry)
├── ValidationPipeline      (Parse → Type → Semantic → Context)
├── AutoFixer               (=== → ==, && → and, paren fixes...)
├── SelfCorrectionLoop       (Max 3 correction iterations)
├── ContextExtractor         (Auto-extract ContextSchema)
└── PromptBuilder            (Chinese/English System Prompt + EBNF + Few-Shot)
```

## Quick Start

```typescript
import { NL2SpelEngine } from '@agentix-e/nl2spel';

const engine = new NL2SpelEngine();

// Offline mode (no LLM dependency)
const result = await engine.generate('Order amount greater than 1000', { offlineOnly: true });
console.log(result.expression);  // #order.amount > 1000
console.log(result.strategy);    // pattern
```

## Performance

| Metric | Value |
|------|------|
| Pattern match P99 | < 0.5ms |
| Template generation | < 5ms |
| Intent classification | < 2ms |
| Validation pipeline | < 5ms |

## License

MIT © 2025 Agentix-E
