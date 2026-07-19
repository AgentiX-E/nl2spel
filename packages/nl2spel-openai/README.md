# @agentix-e/nl2spel-openai

> OpenAI-compatible LLM Provider for @agentix-e/nl2spel
>
> 7 preset providers · Custom API support · Streaming output

[![npm](https://img.shields.io/npm/v/@agentix-e/nl2spel-openai?color=blue)](https://www.npmjs.com/package/@agentix-e/nl2spel-openai)
[![API Docs](https://img.shields.io/badge/docs-TypeDoc-blue)](https://agentix-e.github.io/nl2spel/api/modules/nl2spel_openai.html)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](../../LICENSE)

---

## API Documentation

→ [nl2spel-openai API](https://agentix-e.github.io/nl2spel/api/modules/nl2spel_openai.html)

## Preset Providers (7)

| Provider | Model | Context | Streaming |
|----------|-------|---------|-----------|
| OpenAI | gpt-4o-mini | 128K | ✅ |
| DeepSeek | deepseek-chat | 64K | ✅ |
| GLM (Zhipu) | glm-4-flash | 128K | ✅ |
| Copilot | gpt-4o | 128K | ✅ |
| Hunyuan (Tencent) | hunyuan-lite | 32K | ✅ |
| MiniMax | abab6.5s-chat | 32K | ✅ |
| Kimi | moonshot-v1-8k | 8K | ✅ |

## Quick Start

```typescript
import { NL2SpelEngine } from '@agentix-e/nl2spel';
import { OpenAICompatibleProvider } from '@agentix-e/nl2spel-openai';

const engine = new NL2SpelEngine();

// OpenAI
engine.registerProvider(new OpenAICompatibleProvider({
  provider: 'openai',
  apiKey: 'sk-...',
}));

// DeepSeek (best value)
engine.registerProvider(new OpenAICompatibleProvider({
  provider: 'deepseek',
  apiKey: 'sk-...',
}));

// Custom API
engine.registerProvider(new OpenAICompatibleProvider({
  custom: {
    name: 'my-llm',
    baseURL: 'https://my-llm.example.com/v1',
    apiKey: 'sk-...',
    model: 'my-model-v1',
  },
}));
```

## Multi-Provider Fallback

```typescript
engine.registerProvider(new OpenAICompatibleProvider({ provider: 'openai', apiKey: '...' }));
engine.registerProvider(new OpenAICompatibleProvider({ provider: 'deepseek', apiKey: '...' }));

// Auto fallback by cost from low to high
const result = await engine.generate('Complex multi-level nested expression');
```

## License

MIT © 2025 Agentix-E
