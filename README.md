# NL2SpEL

> Natural Language → Spring Expression Language (SpEL) Generation Engine
>
> Four-layer hybrid architecture (Pattern Matching + Semantic Slots + LLM API + WebLLM Local), supporting Chinese & English

[![CI](https://github.com/AgentiX-E/nl2spel/actions/workflows/ci.yml/badge.svg)](https://github.com/AgentiX-E/nl2spel/actions/workflows/ci.yml)
[![Coverage](https://img.shields.io/badge/coverage-95%25-brightgreen)](https://agentix-e.github.io/nl2spel/coverage)
[![npm](https://img.shields.io/npm/v/@agentix-e/nl2spel)](https://www.npmjs.com/package/@agentix-e/nl2spel)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

## What is NL2SpEL?

**NL2SpEL** converts natural language input (Chinese or English) into valid Spring Expression Language (SpEL) expressions. It uses a **four-layer hybrid engine** that cascades through Pattern Matching (63 bilingual patterns, < 1ms P99), Semantic Templates (15 intent types), LLM API (7 preset providers + custom), and optional browser-local WebLLM inference — always choosing the fastest, most accurate strategy available.

### When should I use it?

- You're building a **no-code / low-code** platform that needs expression generation from user text
- You want to **bridge natural language and SpEL** in a rules engine, workflow builder, or chatbot
- You need **offline-first** expression generation (Layers 0–1 require zero network calls)
- You want **multi-LLM flexibility** — swap between DeepSeek, OpenAI, GLM, Copilot, or run fully local in the browser

---


## Architecture Overview

```
                    ┌─────────────────────────────────┐
                    │        NL2SpEL Engine            │
                    │  generate / generateBatch /      │
                    │  explain / offlineOnly            │
                    └───────────────┬─────────────────┘
                                    │
                    ┌───────────────▼─────────────────┐
                    │       StrategyRouter             │
                    │  Pattern → Template → LLM        │
                    └───────┬───────┬───────┬─────────┘
                            │       │       │
              ┌─────────────▼─┐  ┌──▼───┐  ┌▼──────────┐
              │  Layer 0      │  │Layer1│  │  Layer 2   │
              │  Pattern Match │  │ Templ│  │  LLM API   │
              │  (63 patterns) │  │ (15  │  │  (7 presets│
              │  < 1ms P99     │  │intents│  │  + custom) │
              └────────────────┘  └──────┘  └────────────┘
                                                    │
                                          ┌─────────▼─────────┐
                                          │  Layer 3 (optional)│
                                          │  WebLLM + GBNF     │
                                          │  Browser-only       │
                                          └────────────────────┘
```

## Package Structure

| Package | Description | Tests | Dependencies |
|---|------|------|------|
| [`@agentix-e/nl2spel`](./packages/nl2spel/README.md) | Core Engine | 532 | Zero external deps |
| [`@agentix-e/nl2spel-openai`](./packages/nl2spel-openai/README.md) | LLM API Provider | 55 | core |
| [`@agentix-e/nl2spel-webllm`](./packages/nl2spel-webllm/README.md) | Browser-local LLM | 68 | core |

- [API Documentation](https://agentix-e.github.io/nl2spel/api)
- [Coverage Report](https://agentix-e.github.io/nl2spel/coverage)
- [Performance Benchmark](https://agentix-e.github.io/nl2spel/benchmark)

## Quick Start

### Installation

```bash
# Core engine (offline-ready)
npm install @agentix-e/nl2spel

# LLM API Provider (optional)
npm install @agentix-e/nl2spel-openai

# WebLLM Provider (optional, browser-only)
npm install @agentix-e/nl2spel-webllm
```

### Basic Usage

```typescript
import { NL2SpelEngine } from '@agentix-e/nl2spel';

const engine = new NL2SpelEngine();

// Pattern matching (offline, < 1ms)
const r1 = await engine.generate('Order amount greater than 1000');
// { expression: "#order.amount > 1000", strategy: "pattern", confidence: 0.95 }

// Semantic slot filling
const r2 = await engine.generate('Age between 18 and 60');
// { expression: "#user.age between {18, 60}", strategy: "template", confidence: 0.9 }
```

### LLM Provider

```typescript
import { NL2SpelEngine } from '@agentix-e/nl2spel';
import { OpenAICompatibleProvider } from '@agentix-e/nl2spel-openai';

const engine = new NL2SpelEngine();
engine.registerProvider(
  new OpenAICompatibleProvider({
    provider: 'deepseek',
    apiKey: 'sk-...',
  })
);

const result = await engine.generate(
  'Filter orders with amount greater than 1000 and status is shipped'
);
```

### Batch Generation

```typescript
const results = await engine.generateBatch([
  'Amount greater than 100',
  'User is VIP',
  'Note is not empty and status is confirmed',
]);
```

### Debug / Explain

```typescript
const explanation = await engine.explain('Order amount greater than 1000 and user is VIP');
console.log(explanation.intent);     // { primary: "LOGICAL", complexity: 25, ... }
console.log(explanation.strategy);   // "pattern" | "template" | "llm-api"
```

## Performance SLO

| Metric | Target | Actual |
|------|------|------|
| Pattern match latency (P99) | ≤ 1ms | < 0.5ms |
| Template generation latency | ≤ 10ms | < 5ms |
| Intent classification | < 5ms | < 2ms |

[View full performance benchmark →](https://agentix-e.github.io/nl2spel/benchmark)

## Strategy & Accuracy

| Difficulty | Tests | Pattern | Template | LLM (GPT-4o-mini) | Combined Target |
|------|-------|---------|----------|-------------------|---------|
| Easy | 50 | 80% | 10% | 5% | ≥ 95% |
| Medium | 70 | — | 60% | 28% | ≥ 88% |
| Hard | 30 | — | — | 80% | ≥ 80% |

## FAQ

### What SpEL features can NL2SpEL generate?
NL2SpEL generates expressions covering comparisons, logical operators, collection selection/projection, method invocation, and type references. Simple patterns (> 63 bilingual) are matched offline; complex multi-clause expressions are routed to the LLM layer.

### Do I need an API key?
No — for Layers 0–1 (pattern matching and semantic templates). API keys are only needed for Layer 2 (LLM API providers like DeepSeek, OpenAI) and Layer 3 (WebLLM is fully local with WebGPU acceleration).

### Can I run it entirely offline in the browser?
Yes. Combine `@agentix-e/nl2spel` (offline patterns + templates) with `@agentix-e/nl2spel-webllm` (local Gemma/Phi models via WebGPU) for a fully offline, no-data-leaves-browser experience.

### How accurate is it?
| Difficulty | Combined Target |
|------------|-----------------|
| Easy (50 tests) | ≥ 95% |
| Medium (70 tests) | ≥ 88% |
| Hard (30 tests) | ≥ 80% |

## Development

```bash
pnpm install
pnpm build
pnpm test
pnpm lint
```

## License

Built on [@agentix-e/spel-ts](https://github.com/AgentiX-E/spel-ts) — pure TypeScript SpEL evaluator.

## Ecosystem
- [@agentix-e/spel-ts](https://github.com/AgentiX-E/spel-ts) — SpEL parser and evaluator
- [@agentix-e/spel-editor](https://github.com/AgentiX-E/spel-editor) — Web-embeddable SpEL editor

MIT © 2025 Agentix-E
