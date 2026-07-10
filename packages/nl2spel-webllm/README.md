# @agentix-e/nl2spel-webllm

> 浏览器本地 LLM Provider for @agentix-e/nl2spel
>
> GBNF 语法约束解码 · WebGPU 加速 · 4 个优化模型 · 零 API 成本

[![npm](https://img.shields.io/npm/v/@agentix-e/nl2spel-webllm)](https://www.npmjs.com/package/@agentix-e/nl2spel-webllm)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](../../LICENSE)

---

## API 文档

→ [nl2spel-webllm API](https://agentix-e.github.io/nl2spel/api/modules/nl2spel_webllm.html)

## 模型配置（4 个）

| 模型 | 上下文 | VRAM | 速度 | 质量等级 |
|------|-------|------|------|---------|
| Qwen 2.5 1.5B | 32K | 1.5 GB | 30 tok/s | Low |
| Gemma 2 2B | 8K | 2.0 GB | 25 tok/s | Low |
| Phi-3 Mini 4K | 4K | 2.8 GB | 20 tok/s | Medium |
| Llama 3.2 3B | 8K | 3.5 GB | 15 tok/s | High |

## 快速开始

```typescript
import { NL2SpelEngine } from '@agentix-e/nl2spel';
import { WebLLMProvider, recommendModel } from '@agentix-e/nl2spel-webllm';

const engine = new NL2SpelEngine();

// 自动选择最适合当前设备的模型
const modelName = recommendModel(4);  // 4GB VRAM
// → 'qwen2.5-1.5b'（最快）

const provider = new WebLLMProvider({
  model: modelName,
  onProgress: (p) => console.log(`Loading: ${(p.progress * 100).toFixed(0)}%`),
});

await provider.initialize();
engine.registerProvider(provider);

// 零 API 成本，本地浏览器推理
const result = await engine.generate('金额大于1000');
```

## GBNF 语法约束

WebLLM Provider 通过动态生成的 GBNF 语法约束 LLM 输出，确保 **100% 合法的 SpEL 表达式**：

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

// grammar 输出可直接注入到 WebLLM 的 grammar 参数
```

## 浏览器要求

- WebGPU 支持（Chrome 113+, Edge 113+, Opera 99+）
- 足够的 VRAM（≥ 1.5 GB）
- HTTPS 或 localhost 环境

## 性能 SLO

| 指标 | 目标 |
|------|------|
| 推理速度 | ≥ 15 tok/s |
| 首次加载 | ≤ 30s |
| 内存占用 | ≤ 3 GB |
| GBNF 语法合法率 | 100% |

## 许可证

MIT © 2025 Agentix-E
