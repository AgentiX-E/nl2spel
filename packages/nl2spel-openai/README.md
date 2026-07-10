# @agentix-e/nl2spel-openai

> OpenAI 兼容 LLM Provider for @agentix-e/nl2spel
>
> 7 个预配置 Provider · 自定义 API 支持 · 流式输出

[![npm](https://img.shields.io/npm/v/@agentix-e/nl2spel-openai)](https://www.npmjs.com/package/@agentix-e/nl2spel-openai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](../../LICENSE)

---

## API 文档

→ [nl2spel-openai API](https://agentix-e.github.io/nl2spel/api/modules/nl2spel_openai.html)

## 预配置 Provider（7 个）

| Provider | 模型 | 成本/请求 | 延迟 | 流式 |
|----------|------|----------|------|------|
| OpenAI | gpt-4o-mini | ~$0.0003 | 2s | ✅ |
| DeepSeek | deepseek-chat | ~$0.0001 | 1.5s | ✅ |
| GLM (智谱) | glm-4-flash | ~¥0.003 | 1.8s | ✅ |
| Copilot | gpt-4o | 免费 | 2.5s | ✅ |
| 混元 (腾讯) | hunyuan-lite | 免费 | 2s | ✅ |
| MiniMax | abab6.5s-chat | ~$0.002 | 2.5s | ✅ |
| Kimi | moonshot-v1-8k | ~$0.002 | 2s | ✅ |

## 快速开始

```typescript
import { NL2SpelEngine } from '@agentix-e/nl2spel';
import { OpenAICompatibleProvider } from '@agentix-e/nl2spel-openai';

const engine = new NL2SpelEngine();

// OpenAI
engine.registerProvider(new OpenAICompatibleProvider({
  provider: 'openai',
  apiKey: 'sk-...',
}));

// DeepSeek（性价比最优）
engine.registerProvider(new OpenAICompatibleProvider({
  provider: 'deepseek',
  apiKey: 'sk-...',
}));

// 自定义 API
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

// 自动按成本从低到高 fallback
const result = await engine.generate('复杂的多层嵌套表达式');
```

## 许可证

MIT © 2025 Agentix-E
