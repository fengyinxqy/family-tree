## Context

当前录入流转是单次请求-响应模式：用户输入口述文本，Agent 返回 `IntakeDraft`（含人物、关系、歧义项、问题）。草稿中有 `readyToApply: false` 时，用户只能看到有哪些问题，但无法在原草稿基础上补充信息。

V1.1 路线图明确要求升级为多轮澄清：Agent 针对重名、缺失关系信息、代际不明提出追问，用户用一句话补充，草稿增量更新。

项目约束：
- 不引入新的持久化存储（无 Draft 表）
- API 保持无状态，前端持有完整草稿状态
- 向后兼容现有单次录入行为

## Goals / Non-Goals

**Goals:**
- 用户可在已生成草稿上追加一句补充信息，Agent 返回更新后的草稿
- 支持重点可补充澄清：重名匹配、人物性别未知、关系方向/类型不明、代际不明
- 草稿卡片展示澄清对话历史，提供补充输入框
- 澄清最多 5 轮，超限后提示改为手动录入或重新开始

**Non-Goals:**
- 不在服务端持久化草稿状态（草稿生命周期限于浏览器会话）
- 不支持并发多轮（每次补充串行处理）
- 不改变 `apply` 接口的行为

## Decisions

### D1: 无状态续写 — 前端传递完整 previousDraft

**选择**: API 接收可选 `previousDraft` 字段 + `clarificationText`，服务端不存储草稿状态。

**备选方案**: 服务端为每个草稿分配 sessionId，存储在内存/Redis。
- 拒绝理由：增加基础设施复杂度，草稿有效期管理复杂，与现有无状态 API 风格不一致。

**影响**: 每次续写请求携带完整的前一轮草稿 JSON，前端负责维护草稿状态与本地澄清历史；服务端不生成 `draftSessionId`。

### D2: 续写 Prompt 策略 — 结构化上下文注入

**选择**: 新建 `runIntakeContinuation()` 函数，构造专用 prompt 注入：
1. 前一轮草稿的结构化摘要（人物列表、关系列表、未解决歧义）
2. 用户补充文本
3. 要求 LLM 仅输出需要**补全、修正歧义或新增**的条目，最终由 `mergeDraftWithClarification()` 在字段级别合入

**备选方案**: 重新发送全部对话文本让 LLM 重新解析。
- 拒绝理由：token 浪费，可能丢失已确认的匹配结果，同一人名可能被解析为不同 ref。

**影响**: 需要在 `tools.ts` 中实现 `mergeDraftWithClarification()` 将 LLM 增量输出合并回原草稿，并明确哪些字段允许补全、哪些字段不允许回退。

### D3: Ambiguity kind 扩展

**选择**: 在现有 `DraftAmbiguity.kind` 联合类型中新增 `person_gender_unknown`、`generation_unclear` 和 `relationship_direction_unknown`，并为所有可澄清项补充 `question` 字段。

当前类型：`person_match | missing_reference | duplicate_relationship`

新增：
- `person_gender_unknown`：人物性别未知，当前草稿不能安全写入
- `generation_unclear`：代际不明
- `relationship_direction_unknown`：关系方向或角色不明，如只知道“是亲属/是父母之一”但无法落到现有 `spouse | child` 模型

每种歧义附带 `question` 字段（自然语言追问），前端可展示并引导用户回答。

说明：`missing_reference` 与 `duplicate_relationship` 继续保留为阻塞项，但不强制要求每种都能通过一句补充自动解决；其中 `missing_reference` 在补充文本补齐人物引用时仍可被合并逻辑消解。

### D4: 字段级合并，而不是条目级锁死

**选择**: `mergeDraftWithClarification()` 以字段级规则合并，而不是按 `action` 粗暴锁定整条记录：
1. `action: "reuse"` 的人物保留 `existingPersonId` 不变，不允许回退成 `create`
2. `action: "create"` 的人物若仍关联歧义，可补全 `gender`、`birthDate`、`deathDate`、`bio`、`evidence`
3. 关系记录若此前因 `missing_reference` 或方向不明被跳过，补充文本补齐后允许恢复为 `create`
4. 已解决的歧义移除；新增不确定项可继续追加

**备选方案**: 只要条目已存在就视作“已确认”，禁止后续任何字段变化。
- 拒绝理由：与当前数据模型不符。现有草稿里 `gender: "unknown"`、缺失日期、缺失关系方向都需要通过后续补充来完成，否则无法顺利写库。

### D5: 前端交互 — 澄清面板嵌入草稿卡片

**选择**: 在 `DraftSummary` 组件内新增澄清区：
1. 每个未解决歧义显示追问文本 + 可展开的"回答此问题"
2. 底部新增通用补充输入框（一句话模式）
3. 补充提交后展示加载状态，收到更新草稿后替换当前草稿
4. 草稿卡片保留澄清对话历史（时间线），该历史仅保存在前端本地 state，不进入 `IntakeDraft` schema

**备选方案**: 在 conversation log 中实现多轮对话。
- 拒绝理由：录入草稿与对话日志是不同概念，草稿是操作对象而非聊天。澄清应围绕草稿本身展开。

## Risks / Trade-offs

- **[R1] 多轮累积歧义过多**: 用户反复补充但歧义不消失 → 前端限制最多 5 轮澄清，超限提示切换为手动录入
- **[R2] LLM 在续写轮次中丢失上下文**: 之前的确定项被错误修改 → `mergeDraftWithClarification()` 锁定不可回退字段（如 `existingPersonId`），但允许与歧义直接相关的字段被补全
- **[R3] 草稿 JSON 过大随轮次膨胀**: 每轮传递完整草稿 → 限制澄清轮次（最多 5 轮），超过建议清空重新开始
