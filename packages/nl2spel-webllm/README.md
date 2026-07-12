# @agentix-e/nl2spel-webllm

> Browser-local LLM Provider for @agentix-e/nl2spel
>
> GBNF grammar-constrained decoding · 4 optimized models · Zero API cost · WebLLM handles GPU detection natively

[![npm](https://img.shields.io/npm/v/@agentix-e/nl2spel-webllm)](https://www.npmjs.com/package/@agentix-e/nl2spel-webllm)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](../../LICENSE)

---

## API Documentation

→ [nl2spel-webllm API](https://agentix-e.github.io/nl2spel/api/modules/nl2spel_webllm.html)

## Model Configurations (4)

| Model | Context | VRAM | Speed | Quality |
|------|-------|------|------|---------|
| Qwen 2.5 1.5B | 32K | 1.5 GB | 30 tok/s | Low |
| Gemma 2 2B | 8K | 2.0 GB | 25 tok/s | Low |
| Phi-3 Mini 4K | 4K | 2.8 GB | 20 tok/s | Medium |
| Llama 3.2 3B | 8K | 3.5 GB | 15 tok/s | High |

## Quick Start

```typescript
import { NL2SpelEngine } from '@agentix-e/nl2spel';
import { WebLLMProvider, recommendModel } from '@agentix-e/nl2spel-webllm';

const engine = new NL2SpelEngine();

// Auto-select the best model for the current device
const modelName = recommendModel(4);  // 4GB VRAM
// → 'qwen2.5-1.5b' (fastest)

const provider = new WebLLMProvider({
  model: modelName,
  onProgress: (p) => console.log(`Loading: ${(p.progress * 100).toFixed(0)}%`),
});

await provider.initialize();
engine.registerProvider(provider);

// Zero API cost, local browser inference
const result = await engine.generate('Amount greater than 1000');
```

## GBNF Grammar Constraints

The WebLLM Provider constrains LLM output via dynamically generated GBNF grammar, ensuring **100% valid SpEL expressions**:

```typescript
import { GBNFGenerator } from '@agentix-e/nl2spel-webllm';

const gen = new GBNFGenerator({ injectContext: true });
const grammar = gen.generate({
  root: { name: 'order', type: 'Order', fields: { amount: { type: 'number' } }, methods: {} },
  variables: { user: { type: 'object' } },
  beans: {},
  types: {},
  functions: {},
});

// grammar output can be directly injected into WebLLM's grammar parameter
```

## Browser Requirements

- WebGPU support (Chrome 113+, Edge 113+, Opera 99+)
- Sufficient VRAM (≥ 1.5 GB)
- HTTPS or localhost environment

## Performance SLO

| Metric | Target |
|------|------|
| Inference speed | ≥ 15 tok/s |
| First load | ≤ 30s |
| Memory usage | ≤ 3 GB |
| GBNF grammar validity rate | 100% |

## License

MIT © 2025 Agentix-E
