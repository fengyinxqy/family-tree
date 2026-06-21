# AI 与 Agent 系统

## 系统定位

项目同时保留两代 AI 执行路径：

- 旧统一助手：一次请求内选择至多一个工具，用于兼容和快速回滚。
- 受约束 Agent Runtime：基于 LangChain JS 与 LangGraph，支持持久会话、多步工具调用、预算、人工介入、取消和恢复。

正式家谱数据始终受同一规则保护：AI 只能生成草稿或不可变修订组，不能直接批准或发布人物、事件和关系。

## 架构

```text
Agent 面板
   │
   ├─ AgentSession / AgentRun API
   │
   ▼
LangGraph 状态图
   ├─ 加载上下文
   ├─ LangChain 模型决策
   ├─ 工具执行与权限复核
   ├─ 预算检查
   ├─ 人工澄清 / 确认中断
   └─ 报告、草稿或修订组产物
        │
        └─ 修订组 → 人工审校 → 发布
```

产品侧的 `AgentSession`、`AgentMessage`、`AgentRun`、`AgentStep` 和 `AgentToolCall` 用于授权查询、界面展示和审计。LangGraph PostgreSQL checkpoint 表用于恢复图状态；`thread_id` 为会话 ID，`checkpoint_ns` 包含运行 ID，避免同一会话的不同运行串状态。

## 依赖基线

首次实现固定以下直接依赖，升级时必须运行模型、工具、检查点和中断恢复契约测试：

| 依赖 | 基线版本 | 用途 |
| --- | --- | --- |
| `@langchain/core` | `1.2.0` | 消息、模型和工具协议 |
| `@langchain/langgraph` | `1.4.4` | 状态图、中断、恢复和内存测试检查点 |
| `@langchain/langgraph-checkpoint-postgres` | `1.0.3` | 生产 PostgreSQL 检查点 |
| `@langchain/openai` | `1.5.1` | OpenAI 及 DeepSeek OpenAI 兼容接口 |

版本常量位于 `src/lib/agent/runtime/versions.ts`。每次运行会记录提供方、模型、提示词版本、图版本、状态版本和工具模式版本。

## 模型配置

模型工厂读取：

- `AI_PROVIDER=openai|deepseek`
- `OPENAI_API_KEY`、`OPENAI_AGENT_MODEL`
- `DEEPSEEK_API_KEY`、`DEEPSEEK_MODEL`、`DEEPSEEK_BASE_URL`

业务节点不得直接实例化模型客户端。DeepSeek 通过 LangChain OpenAI 兼容配置接入，并关闭 OpenAI Responses API。

## 有界运行

默认预算包括：最多 6 次模型决策、12 次工具调用、60 秒总耗时、20 秒单工具耗时、2 次失败重试以及 32,000 Token 上下文上限。任一硬预算耗尽后停止新的模型和工具调用，并以 `BUDGET_EXHAUSTED` 保存已有结果。

运行状态包括：

- `PENDING`、`RUNNING`
- `WAITING_FOR_USER`、`WAITING_FOR_CONFIRMATION`
- `COMPLETED`、`FAILED`、`CANCELLED`、`BUDGET_EXHAUSTED`

同一会话只能有一个活动运行，由服务检查和 PostgreSQL 部分唯一索引共同保证。

## 工具安全

工具注册表要求每个工具声明名称、版本、Zod 输入输出模式、权限动作、超时和副作用等级：

- `READ`：人物、关系、缺口、资料引用和确定性推理。
- `PROPOSE`：创建待审修订产物，必须绑定参数哈希、家谱修订号、有效期并取得确认。

模型传入的 `treeId`、`userId`、`createdBy` 和对象存储键会被拒绝。每次执行都根据服务端会话重新确定家谱，并重新调用集中式授权服务。发布、批准、撤回、删除和成员管理工具不会注册给 Agent。

## 资料补全 Agent

资料补全 Agent 首先定位一个人物或有限分支，然后检查字段、直系关系和资料引用。它必须区分：

- 数据库字段缺失；
- 已授权资料中未发现证据；
- 多个来源互相冲突；
- 信息已经完整。

没有新事实时生成缺口报告；用户明确补充事实时生成录入草稿；用户确认后才能创建不可变修订组。

## OCR 扩展边界

本阶段不实现 OCR，但资料工具结果已经定义以下字段：资料 ID、媒体对象 ID、页码、区域、文本片段、置信度、提取器和模型版本。未来 OCR 工具必须以授权后的资料或媒体 ID 为输入，不允许模型直接提交存储路径；OCR 结果仍需经过匹配、冲突分析、人工确认和修订审校。

## Next.js 16 路由约定

实现前已读取仓库内 Next.js 16 的 Route Handlers、Streaming 和 Runtime 指南。Agent API 采用：

- App Router `route.ts` 和原生 Web `Request`/`Response`；
- 动态路由的 `params` 按 Promise 等待；
- Node.js Runtime，以支持 PostgreSQL、Prisma 和 LangGraph；
- 原生 `ReadableStream` 输出 NDJSON；
- 动态运行接口显式禁用缓存。

## 功能开关与回滚

同时设置 `AGENT_RUNTIME_ENABLED=true` 和 `NEXT_PUBLIC_AGENT_RUNTIME_ENABLED=true` 后，新面板使用持久会话和 Agent Run API。关闭开关后，旧 `/api/agent/chat` 工具路由仍可工作；新 Agent 业务表和 checkpoint 表保留为只读历史，不需要删除。

详细部署、排障和回滚步骤见 `docs/agent-runtime-operations.md`。
