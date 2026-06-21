# Agent Runtime 运维指南

## 部署顺序

1. 备份数据库，并确认现有 Prisma migration 全部应用。
2. 部署包含 Agent 业务表和 LangGraph checkpoint 表的迁移。
3. 保持 `AGENT_RUNTIME_ENABLED=false`，运行测试、类型检查和构建。
4. 使用测试账户创建会话，验证只读调查、人物歧义中断、取消和恢复。
5. 验证 PROPOSE 工具只创建 DRAFT 修订或修订组，正式人物、事件和关系未变化。
6. 同步启用服务端与客户端功能开关。

LangGraph checkpoint DDL 已纳入 Prisma 迁移历史。运行时仍会调用幂等的 `setup()`，用于核对官方 checkpoint 版本；不得在生产环境手工删除 checkpoint migration 记录。

## 日常检查

- 运行状态长期停留在 `RUNNING`：检查最后一个 AgentStep、工具超时和模型提供方日志。
- `WAITING_FOR_USER`：确认客户端展示候选项或补充问题。
- `WAITING_FOR_CONFIRMATION`：检查参数哈希、家谱修订号和过期时间。
- `BUDGET_EXHAUSTED`：查看模型轮次、工具次数、Token 和耗时，避免直接扩大所有默认预算。
- `INCOMPATIBLE_CHECKPOINT`：保留历史运行，创建新运行，不强行恢复旧图状态。

结构化日志的 `scope` 为 `agent-runtime`，关键事件包括 `step.completed`、`run.paused`、`run.finished` 和 `run.failed`。日志不得包含 API Key、Token、文件内容、对象存储键或完整业务 payload。

## 故障恢复

请求断开不保证后台继续运行。客户端重新连接后应读取会话详情：

- 若运行已完成，展示持久化消息和产物；
- 若等待人工介入，使用原 run ID 恢复；
- 若失败，保留轨迹并由用户创建新运行；
- PROPOSE 工具使用运行、工具名和参数哈希组成幂等键，恢复不得创建重复修订组。

## 权限检查

每次会话读取、运行恢复、取消和工具执行都重新校验当前成员权限。成员被停用、移出家谱或失去相应角色后，下一次请求必须立即失败。模型参数不能覆盖服务端确定的用户或家谱作用域。

## 回滚

1. 将 `NEXT_PUBLIC_AGENT_RUNTIME_ENABLED` 和 `AGENT_RUNTIME_ENABLED` 设为 `false` 并重新部署。
2. 旧统一助手继续通过 `/api/agent/chat` 工作。
3. 保留 Agent 业务表及 checkpoint 表，不回滚已发生的修订、审计或来源记录。
4. 若模型适配器升级导致问题，恢复 `package-lock.json` 中的已验证版本并重新运行契约测试。
5. 不使用 `prisma migrate reset` 处理 checkpoint drift；checkpoint DDL 必须始终由项目迁移历史管理。

## 后续 OCR 接入

OCR 属于长耗时工具。接入前需要另建 change，确定队列与工作器、文件大小、超时、保留期和失败重试。OCR 只接收已授权的资料/媒体 ID，输出结构化来源定位，不改变当前会话、预算、人工确认和修订发布协议。
