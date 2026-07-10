# Contributing to NL2SpEL

## 分支策略

- `main` — 稳定分支，所有 PR 合并目标
- `feat/*` — 功能开发分支
- `fix/*` — Bug 修复分支
- `docs/*` — 文档更新分支

## 开发环境

```bash
# 安装依赖
pnpm install

# 编译所有包
pnpm build

# 运行所有测试
pnpm test

# 类型检查
pnpm lint

# 格式化代码
pnpm format

# 格式检查
pnpm format:check
```

## 提交规范

遵循 [Conventional Commits](https://www.conventionalcommits.org/)：

```
feat: add PatternMatcher with built-in patterns
fix: resolve Chinese number parser overflow
docs: update API documentation
test: add 160+ pattern matching tests
chore: configure CI workflow
refactor: extract ValidationPipeline to separate module
```

## 代码质量要求

### 测试
- 新功能必须包含测试
- 覆盖率不得下降（目标 ≥ 95%）
- 所有测试必须在 CI 和本地同时通过（local=CI 零漂移）
- 禁止使用合成数据或仅 mock 测试

### Pre-commit 门禁
```bash
# 安装 husky hooks
pnpm install

# 提交前自动执行：
# - lint（类型检查 + ESLint）
# - format:check（格式检查）
# - test（运行测试，仅在变更文件所在包）
```

### CI 要求
- CI 端零警告、零错误
- 单 ci.yml workflow（合并 lint/test/coverage/benchmark）
- 覆盖率报告自动发布至 GitHub Pages
- TypeDoc API 文档自动发布至 GitHub Pages

## 性能要求

- 新 Pattern 延迟增量 ≤ 0.1ms
- 新 Template 延迟增量 ≤ 1ms
- 新 Validation check 延迟增量 ≤ 2ms

## 包结构

本项目使用 pnpm workspace monorepo：

```
packages/
├── nl2spel/            # 核心引擎（零外部依赖）
├── nl2spel-openai/     # LLM API Provider
└── nl2spel-webllm/     # 浏览器本地 LLM Provider
```

## 发布流程

1. 更新 `CHANGELOG.md`
2. 更新版本号（`packages/*/package.json`）
3. 提交 PR 到 `main`
4. CI 通过后合并
5. 手动触发 `npm-publish` workflow 发布

## 内部文档

非面向用户的内部 agent 文档（如 `RULE_VERIFICATION.md`、`AUDIT_REPORT.md`）默认 gitignore，不得提交到仓库。

## 许可证

MIT © 2025 Agentix-E
