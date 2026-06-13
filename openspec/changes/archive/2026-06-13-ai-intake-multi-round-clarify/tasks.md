## 1. 类型与 Schema 扩展

- [x] 1.1 在 `types.ts` 中扩展 `DraftAmbiguity.kind`，新增 `person_gender_unknown`、`generation_unclear` 和 `relationship_direction_unknown`，并为 `DraftAmbiguity` 新增 `question` 可选字段
- [x] 1.2 在 `schemas.ts` 中同步更新 `draftAmbiguitySchema.kind` 枚举和 `intakeRouteRequestSchema`，新增可选 `previousDraft`、`clarificationText` 字段
- [x] 1.3 为扩展后的 schema 添加 Zod 验证测试用例（重点覆盖 `draftAmbiguitySchema` 与 `intakeRouteRequestSchema`）

## 2. Agent 续写引擎

- [x] 2.1 在 `intake-agent.ts` 中实现 `buildContinuationPrompt()` — 将前轮草稿的结构化摘要（已确认人物/关系、未解决歧义）和用户补充文本拼接为 LLM prompt
- [x] 2.2 在 `intake-agent.ts` 中实现 `runIntakeContinuation()` — 调用 LLM 获取增量提取结果
- [x] 2.3 在 `tools.ts` 中实现 `mergeDraftWithClarification()` — 将 LLM 增量输出按字段级规则合并到原草稿：复用结果不可回退、与歧义相关的字段允许补全、新条目追加、被解决的歧义移除、新歧义追加，并重新计算 `readyToApply`
- [x] 2.4 为 `mergeDraftWithClarification` 编写单元测试（覆盖：确认人物匹配、补充人物性别、补充缺失关系引用、复用结果不被覆盖、歧义新增与移除）

## 3. API 路由扩展

- [x] 3.1 修改 `POST /api/agent/intake` 路由：检测请求体中是否存在 `previousDraft` + `clarificationText`，存在则调用 `runIntakeContinuation()` 而非 `runIntakeAgent()`
- [x] 3.2 为续写模式添加接口测试（模拟首次录入→补充澄清的完整流程）

## 4. 前端澄清交互

- [x] 4.1 扩展 `DraftSummary` 组件：当 `draft.readyToApply === false` 时，在歧义列表下方渲染补充输入框和"补充澄清"按钮
- [x] 4.2 实现前端续写逻辑：`handleClarify()` — 携带 `previousDraft` + `clarificationText` 调用 API，收到响应后替换当前 draft 状态
- [x] 4.3 添加澄清轮次计数器（最多 5 轮），超限时提示用户重新开始或切换手动录入
- [x] 4.4 添加澄清历史时间线展示 — 在草稿卡片中展示每轮补充的用户文本摘要；该历史仅保存在前端本地 state，不进入共享 API schema
- [x] 4.5 端到端验证：手动测试 4 类可补充澄清场景（重名确认、人物性别补充、补充关系方向、代际澄清），确保每类至少能通过一次补充完成

## 5. 文档与收尾

- [x] 5.1 更新 API 文档或注释，说明新增的 `previousDraft` 和 `clarificationText` 字段用法
- [x] 5.2 运行 `npx tsc --noEmit` 确认无类型错误
