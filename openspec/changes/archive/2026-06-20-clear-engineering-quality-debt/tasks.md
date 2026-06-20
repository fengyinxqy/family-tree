## 1. 约束确认与基线固化

- [x] 1.1 阅读 `node_modules/next/dist/docs/` 中与 App Router、客户端组件、effect/数据获取和构建相关的 Next.js 16 指南，并记录本次实现必须遵循的约束。
- [x] 1.2 重新运行 `npm run lint`、`npx tsc --noEmit`、`npm test` 和 `npm run build`，确认并记录实施前基线；lint 预期债务为 15 个错误和 10 个警告。

## 2. React 与组件 lint 清账

- [x] 2.1 修复 `src/components/family-tree.tsx` 的未转义文本、头部折叠状态初始化和 hooks 依赖问题，确保无规则豁免扩散且原有画布行为不变。
- [x] 2.2 重构 `src/components/global-search.tsx` 的异步加载状态与过期响应处理，移除未使用引用并保持搜索交互语义。
- [x] 2.3 重构 `src/components/settings-client.tsx` 的本地存储初始化和异步数据加载，保持默认视图、面板、删除批次与快照行为兼容。
- [x] 2.4 清理人员详情关系按钮和其余组件中的未使用状态或变量，并对所有修改文件执行定向 ESLint 检查。

## 3. 服务与 API 类型清账

- [x] 3.1 使用领域类型或 Prisma 生成类型替换 `src/services/person.service.ts` 中的显式 `any`，并删除未使用的类型导入。
- [x] 3.2 使用明确的快照、事务和恢复数据类型替换 `src/services/snapshot.service.ts` 中的全部显式 `any`，保持事务与序列化语义不变。
- [x] 3.3 清理 import/export、relationship 服务及 persons/relationships API 路由中的未使用参数、变量和导入，不通过改名或禁用规则掩盖真实死代码。
- [x] 3.4 运行全量 lint，确认结果为零错误、零警告，并检查没有新增全局规则关闭、`@ts-ignore` 或无理由的行级豁免。

## 4. 回归保护与质量入口

- [x] 4.1 为 React 状态初始化或异步加载重构中缺少覆盖的高风险路径补充回归测试，至少验证已保存设置兼容和过期异步结果不会覆盖新状态。
- [x] 4.2 在 `package.json` 新增独立 `typecheck` 脚本，并将 lint 配置为 warning 也返回失败。
- [x] 4.3 在 `package.json` 新增统一质量命令，按 lint、类型检查、测试、生产构建的顺序执行并透传失败退出码。
- [x] 4.4 更新 `README.md` 或现有开发文档，说明独立检查、统一质量命令及构建所需环境前置条件。

## 5. 自动化与最终验收

- [x] 5.1 检查现有自动化配置；若缺失则新增最小 CI 工作流，使用锁文件安装依赖并调用统一质量命令，若已存在则改为复用统一入口。
- [x] 5.2 独立执行 lint、类型检查、全量测试和生产构建，确认全部通过且既有 79 个测试无回归。
- [x] 5.3 执行统一质量命令完成端到端验收，并在变更记录中保存零 lint 告警、测试数量和构建成功结果。
