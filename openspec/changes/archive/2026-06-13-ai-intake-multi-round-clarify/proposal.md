## Why

当前 AI 录入是一次性的：用户输入一段口述，Agent 生成草稿后，如果存在歧义（重名、缺信息、代际不清），用户只能看到提示但无法通过对话补充信息来修正草稿。这导致用户必须重新输入整段口述，或者放弃 Agent 改为手动添加。多轮澄清能力是将 Agent 从"演示"推向"实用"的关键一步。

## What Changes

- 草稿状态从一次性变为可续写：前端持有当前草稿，Agent 能基于已有草稿和用户补充信息增量更新草稿
- 新增前端续写交互：草稿区增加补充输入框，用户在草稿下方直接回应澄清问题
- Agent prompt 升级：从单次解析变为多轮对话，LLM 在上下文中理解之前的提取结果和待确认项
- API 扩展：现有 `/api/agent/intake` 新增可选 `previousDraft` 和 `clarificationText` 字段，支持续写模式
- 澄清问题格式化：`ambiguities` 中的每条记录增加可回复的追问文本，前端可逐条展示和回答
- 重点支持 4 类可补充澄清：重名（`person_match`）、人物性别未知（`person_gender_unknown`）、关系方向/类型不明（`relationship_direction_unknown`）、代际不明（`generation_unclear`）；同时保留现有 `missing_reference` 与 `duplicate_relationship` 阻塞项

## Capabilities

### New Capabilities

- `multi-turn-intake`: 录入草稿的多轮续写能力 — 草稿状态可迭代更新，用户可通过补充一句话进行澄清，Agent 在保留已有确定项的基础上修正不确定部分

### Modified Capabilities

<!-- 无现有 spec 需要修改 -->

## Impact

- **API 层**: `POST /api/agent/intake` — 新增可选字段 `previousDraft` 和 `clarificationText`（向后兼容，不传则与当前行为一致）
- **类型与 Schema**: 扩展 `DraftAmbiguity.kind` 与请求体 schema，补充 `question` 等字段；不引入服务端 `draftSessionId`
- **前端组件**: `agent-panel.tsx` — 草稿卡片增加补充输入框，并在前端本地维护澄清对话历史展示
- **Agent 逻辑**: `intake-agent.ts` — 新增 `runIntakeContinuation()` 函数，`tools.ts` — 新增 `mergeDraftWithClarification()`
