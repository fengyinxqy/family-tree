# 家族协作实施约定

## Next.js 16 约定

- Route Handler 默认不缓存；每个处理器都按公开 API 对待，在读取请求体或业务数据前完成认证，在查询或变更前完成家族动作授权。
- Server Action 同样按公开 API 对待。页面或客户端隐藏按钮只改善体验，不构成权限控制；Action 内必须重新认证、校验输入并授权。
- 授权应放在贴近数据源的服务端 DAL 中。布局层检查不能替代 DAL，因为部分渲染和多个入口可能绕过布局重新执行。
- 服务端组件默认用于读取和组装数据；只把交互所需的最小组件标记为 `"use client"`，传给客户端的 DTO 不包含邀请哈希、审校 payload 或其他敏感字段。
- 当前项目未启用 Cache Components。家族成员、修订和审校读取保持请求时动态读取，不使用跨用户 `unstable_cache`；同一渲染过程需要去重时才考虑 React `cache`。
- 成功变更后在 Server Action 或 Route Handler 中调用 `revalidatePath`。动态路由模式必须提供 `page` 或 `layout` 类型；权限变化至少失效设置页、树页和协作页。
- 表单使用服务端 Zod 校验；`FormData`、隐藏字段和 `bind` 参数都视为不可信输入，不能直接作为用户或家族身份依据。
- 独立数据库读取应并行启动，避免串行 waterfall；服务端到客户端只传必要字段。

参考指南：

- `node_modules/next/dist/docs/01-app/01-getting-started/15-route-handlers.md`
- `node_modules/next/dist/docs/01-app/01-getting-started/05-server-and-client-components.md`
- `node_modules/next/dist/docs/01-app/02-guides/authentication.md`
- `node_modules/next/dist/docs/01-app/02-guides/forms.md`
- `node_modules/next/dist/docs/01-app/02-guides/caching-without-cache-components.md`
- `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/revalidatePath.md`

## 家族入口清单

| 区域 | 当前入口 | 目标动作 |
| --- | --- | --- |
| 树空间 | `family-tree-space.service.ts` 的列表、当前树、切换 | `family.read.published` |
| 树空间 | 创建家族 | 登录用户直接创建并成为 OWNER |
| 树空间 | 删除家族 | `family.delete`（OWNER-only） |
| 工作台 | `family-workspace.service.ts` | `family.read.published` |
| 人物 | 列表、详情、GET API | `family.read.published` |
| 人物 | 创建、更新、位置、AI intake apply | `revision.create`，迁移完成前临时使用 `content.edit.direct` |
| 人物 | 删除预览、确认删除 | `content.delete` |
| 人物 | 删除批次列表、恢复 | `recovery.manage`（OWNER-only） |
| 关系 | 创建、Agent 关系提案应用 | `revision.create`，迁移完成前临时使用 `content.edit.direct` |
| 关系 | 删除预览、确认删除 | `content.delete` |
| 材料 | 列表、详情、文件读取下载 | `family.read.published` |
| 材料 | 创建、更新、链接、文件增删排序 | `revision.create`，文件暂存还需 `file.manage` |
| 材料 | 删除预览、确认删除 | `content.delete` |
| 材料 | 恢复删除 | `recovery.manage`（OWNER-only） |
| 导出 | JSON/交换包导出 | `export.read` |
| 导入 | 预览 | `import.prepare` |
| 导入 | 执行 | `revision.create`，切换前使用 `import.execute` |
| 快照 | 列表 | `recovery.read`（OWNER-only） |
| 快照 | 手工创建、恢复预览与执行 | `recovery.manage`（OWNER-only） |
| 审计 | 操作历史 | `audit.read`（OWNER-only） |
| Agent | genealogy context、chat、intake、relationship | 读取 `family.read.workspace`，应用使用 `revision.create` |
| 邀请 | 创建、列表、撤销 | `membership.manage` |
| 成员 | 改角色、停用、恢复、移除 | `membership.manage` |
| 所有权 | 转移 | `ownership.transfer`（OWNER-only） |
| 修订 | 草稿创建、更新、派生、提交 | `revision.create` / `revision.submit` |
| 审校 | 队列、详情、决定 | `review.read` / `review.decide` |
| 发布 | 发布、撤回公开可见性 | `publish.manage` |

## 迁移检查

以下模式必须在授权迁移阶段清除或仅保留为创作者归属字段：

- 家族读取中的 `where: { ownerId: userId }`。
- 正式业务读取中的 `createdBy: session.user.id` 或端点人物 `createdBy` 限制。
- 通过比较 `record.createdBy !== userId` 实施的访问控制。
- 只在页面、布局、Middleware 或客户端按钮中执行的权限判断。

## 协作发布治理收尾约定

### Next.js 16 实施约束

- 动态 Route Handler 的 `params` 继续按 `Promise` 处理；AI 修订组、来源读取和撤回接口使用 Web `Request` / `Response`，并统一通过 `toFamilyHttpError` 返回授权错误。
- Route Handler 与 Server Action 都是公开入口。AI apply、组提交/审校/发布、来源读取和撤回必须在 DAL 中重新认证、解析当前家族并执行 typed action，不能依赖页面隐藏按钮。
- 用户、成员角色、修订、来源、审计和撤回状态均为请求时数据，不使用跨用户持久缓存。成功变更后显式 `revalidatePath` 审校页、树页、人物页、资料页和设置页。
- Server Component 只向客户端传递当前角色允许的动作布尔值和安全 DTO；不得传邀请令牌哈希、完整 intake 原文、存储键或未授权来源详情。
- 客户端交互只负责体验级防重；事务幂等、权限、家族作用域、状态机和冲突校验必须由服务端保证。

参考指南：

- `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/route.md`
- `node_modules/next/dist/docs/01-app/01-getting-started/05-server-and-client-components.md`
- `node_modules/next/dist/docs/01-app/01-getting-started/07-mutating-data.md`
- `node_modules/next/dist/docs/01-app/01-getting-started/08-caching-and-revalidating.md`
- `node_modules/next/dist/docs/01-app/02-guides/authentication.md`

### OpenSpec 任务归属

`complete-collaboration-publishing-governance` 负责旧变更中尚未完成的 AI 关系/录入修订、协作审计展示与发布撤回。旧变更 `family-collaboration-review-publishing-permissions` 的 8.2、9.1、9.2、9.3、9.4 保持未勾选，待本变更对应实现完成后再同步状态，避免两处重复实施或提前宣告完成。

### 收尾入口与动作映射

| 区域 | 入口或服务 | 动作与约束 |
| --- | --- | --- |
| AI intake 解析 | `/api/agent/intake`、`runIntakeAgent`、`runIntakeContinuation` | `family.read.workspace`，只生成候选草稿 |
| AI intake 应用 | `/api/agent/intake/apply`、`applyIntakeDraft`、`agent-panel.tsx` | `revision.create`，改为创建修订组，禁止正式表写入 |
| AI 关系建议 | `/api/agent/relationship`、`runRelationshipAgent`、unified agent tools | 读取 `family.read.workspace`；接受建议使用 `revision.create` |
| 修订组工作区 | `/api/revisions`、review queue、组详情/提交/审校 | `family.read.workspace`、`revision.submit`、`review.read`、`review.decide` |
| 修订组发布 | editorial publish coordinator | `publish.manage`，序列化事务与正式图完整性校验 |
| 来源写入 | revision/group create、submit | `revision.create` / `revision.submit`，同家族来源校验 |
| 来源读取与文件 | 修订详情、资料详情、文件 preview/download | `family.read.workspace` 或 `family.read.published`；文件继续独立授权 |
| 普通正式读取 | tree/person/timeline/relationship/material services、active query helpers | `family.read.published`，排除未发布与已撤回内容 |
| 导出与快照 | import-export、exchange package、snapshot/material snapshot | `export.read` / `recovery.manage`，只包含当前有效正式数据 |
| 协作审计 | operation-history service、settings history panel | `audit.read`（OWNER-only），只返回安全摘要 |
| 发布撤回 | preview/confirm route 与 withdrawal service | `publish.manage`，确认绑定版本、依赖计划、幂等事务 |
