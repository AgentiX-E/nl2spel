# NL2SpEL

> Natural Language → Spring Expression Language (SpEL) 生成引擎
>
> 四层混合架构（模式匹配 + 语义槽位 + LLM API + WebLLM 本地），支持中英双语

[![CI](https://github.com/AgentiX-E/nl2spel/actions/workflows/ci.yml/badge.svg)](https://github.com/AgentiX-E/nl2spel/actions/workflows/ci.yml)
[![Coverage](https://img.shields.io/badge/coverage-95%25-brightgreen)](https://agentix-e.github.io/nl2spel/coverage)
[![npm](https://img.shields.io/npm/v/@agentix-e/nl2spel)](https://www.npmjs.com/package/@agentix-e/nl2spel)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

---

## 架构总览

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
              │  (35+ patterns)│  │ (15  │  │  (7 presets│
              │  < 1ms P99     │  │intents│  │  + custom) │
              └────────────────┘  └──────┘  └────────────┘
                                                    │
                                          ┌─────────▼─────────┐
                                          │  Layer 3 (optional)│
                                          │  WebLLM + GBNF     │
                                          │  Browser-only       │
                                          └────────────────────┘
```

## 包结构

| 包 | 描述 | 测试 | 依赖 |
|---|------|------|------|
| [`@agentix-e/nl2spel`](./packages/nl2spel/README.md) | 核心引擎 | 388 | 零外部依赖 |
| [`@agentix-e/nl2spel-openai`](./packages/nl2spel-openai/README.md) | LLM API Provider | 19 | core |
| [`@agentix-e/nl2spel-webllm`](./packages/nl2spel-webllm/README.md) | 浏览器本地 LLM | 56 | core |

- [API 文档](https://agentix-e.github.io/nl2spel/api)
- [覆盖率报告](https://agentix-e.github.io/nl2spel/coverage)
- [性能基准](https://agentix-e.github.io/nl2spel/benchmark)

## 快速开始

### 安装

```bash
# 核心引擎（离线可用）
npm install @agentix-e/nl2spel

# LLM API Provider（可选）
npm install @agentix-e/nl2spel-openai

# WebLLM Provider（可选，浏览器专用）
npm install @agentix-e/nl2spel-webllm
```

### 基础用法

```typescript
import { NL2SpelEngine } from '@agentix-e/nl2spel';

const engine = new NL2SpelEngine();

// 模式匹配（离线，< 1ms）
const r1 = await engine.generate('订单金额大于1000');
// { expression: "#order.amount > 1000", strategy: "pattern", confidence: 0.95 }

// 语义槽位填充
const r2 = await engine.generate('年龄在18到60之间');
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
  '筛选出金额大于1000且状态为已发货的订单'
);
```

### 批量生成

```typescript
const results = await engine.generateBatch([
  '金额大于100',
  '用户是VIP',
  '备注不为空且状态为已确认',
]);
```

### 调试解释

```typescript
const explanation = await engine.explain('订单金额大于1000且用户是VIP');
console.log(explanation.intent);     // { primary: "LOGICAL", complexity: 25, ... }
console.log(explanation.strategy);   // "pattern" | "template" | "llm-api"
```

## 性能 SLO

| 指标 | 目标 | 实际 |
|------|------|------|
| Pattern 匹配延迟 (P99) | ≤ 1ms | < 0.5ms |
| Template 生成延迟 | ≤ 10ms | < 5ms |
| Intent 分类 | < 5ms | < 2ms |

[查看完整性能基准 →](https://agentix-e.github.io/nl2spel/benchmark)

## 策略与准确率

| 难度 | 测试数 | Pattern | Template | LLM (GPT-4o-mini) | 综合目标 |
|------|-------|---------|----------|-------------------|---------|
| Easy | 50 | 80% | 10% | 5% | ≥ 95% |
| Medium | 70 | — | 60% | 28% | ≥ 88% |
| Hard | 30 | — | — | 80% | ≥ 80% |

## 开发

```bash
pnpm install
pnpm build
pnpm test
pnpm lint
```

## 许可证

MIT © 2025 Agentix-E
