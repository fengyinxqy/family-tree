## Why

当前仓库的测试与 TypeScript 检查均可通过，但 ESLint 仍有 15 个错误和 10 个警告，导致现有质量门禁无法作为可信的交付基线。现在需要集中清理这些已知债务，并把 lint、类型检查、测试和生产构建固化为可重复执行的统一验收流程，避免债务继续累积。

## What Changes

- 清零现有 ESLint 错误与警告，包括 React effect 状态同步、未转义文本、显式 `any`、未使用变量和不必要的规则豁免。
- 为本地与自动化环境提供统一的工程质量检查命令，覆盖 lint、TypeScript、自动化测试和生产构建。
- 明确质量门禁的零告警策略，任何新增 lint 告警、类型错误、测试失败或构建失败都应阻断验收。
- 补齐与本次重构相关的回归测试，确保清账不改变既有家谱、搜索、设置、快照和数据安全行为。
- 记录质量检查入口与执行约束，使后续开发和交付使用同一套基线。

## Capabilities

### New Capabilities

- `engineering-quality-gates`: 定义仓库统一质量检查、零 lint 告警基线、回归保护与可重复验收要求。

### Modified Capabilities

无。

## Impact

- 主要影响 `src/components/family-tree.tsx`、`src/components/global-search.tsx`、`src/components/settings-client.tsx`、相关服务和 API 路由中的静态检查债务。
- 影响 `package.json` 中的质量脚本，以及可能新增的持续集成工作流和工程文档。
- 不引入面向用户的 API 破坏性变更，不改变数据库 schema，也不新增运行时依赖。
- 实施涉及 Next.js 16 与 React 19 代码时，必须先阅读 `node_modules/next/dist/docs/` 中相关指南并遵循当前版本约定。
