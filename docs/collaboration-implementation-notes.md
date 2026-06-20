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

