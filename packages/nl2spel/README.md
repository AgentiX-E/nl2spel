# @agentix-e/nl2spel

> Natural Language → SpEL 核心引擎
>
> 零外部依赖 · 四层混合架构 · 388 测试 · 中英双语

[![npm](https://img.shields.io/npm/v/@agentix-e/nl2spel)](https://www.npmjs.com/package/@agentix-e/nl2spel)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](../../LICENSE)

---

## API 文档

完整 API 文档 → [nl2spel API](https://agentix-e.github.io/nl2spel/api/modules.html)

## 核心模块

```typescript
import {
  NL2SpelEngine,        // 主引擎
  PatternMatcher,       // Layer 0: 模式匹配（35+ 内置模式）
  IntentClassifier,     // Layer 1: 意图分类（15 种 NLIntent）
  TemplateEngine,       // Layer 1: 模板填充（15 类模板）
  PromptBuilder,        // Layer 2: LLM Prompt 构造
  ValidationPipeline,   // 验证管道（4 阶段）
  AutoFixer,            // 自动修复（10 种错误类型）
  SelfCorrectionLoop,   // 自纠正循环（最大 3 次）
  StrategyRouter,       // 策略路由（Pattern → Template → LLM）
  ContextExtractor,     // 上下文提取
  SchemaFormatter,      // Schema 格式化
  ChineseNumberParser,  // 中文数字解析
  ProviderRegistry,     // Provider 注册管理
} from '@agentix-e/nl2spel';
```

## 架构

```
NL2SpelEngine
├── StrategyRouter          (三层策略路由)
│   ├── Layer 0: PatternMatcher    (35+ 内置模式，P99 < 1ms)
│   ├── Layer 1: TemplateEngine    (15 种意图，15 类模板)
│   └── Layer 2: LLMProvider       (可插拔，通过 ProviderRegistry)
├── ValidationPipeline      (Parse → Type → Semantic → Context)
├── AutoFixer               (=== → ==、&& → and、括号修复...)
├── SelfCorrectionLoop       (最大 3 次迭代纠正)
├── ContextExtractor         (自动提取 ContextSchema)
└── PromptBuilder            (中/英 System Prompt + EBNF + Few-Shot)
```

## 快速开始

```typescript
import { NL2SpelEngine } from '@agentix-e/nl2spel';

const engine = new NL2SpelEngine();

// 离线模式（不依赖任何 LLM）
const result = await engine.generate('订单金额大于1000', { offlineOnly: true });
console.log(result.expression);  // #order.amount > 1000
console.log(result.strategy);    // pattern
```

## 性能

| 指标 | 数值 |
|------|------|
| Pattern 匹配 P99 | < 0.5ms |
| Template 生成 | < 5ms |
| Intent 分类 | < 2ms |
| 验证管道 | < 5ms |

## 许可证

MIT © 2025 Agentix-E
