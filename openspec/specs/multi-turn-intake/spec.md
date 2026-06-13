# Multi-Turn Intake

## Purpose

支持 AI 家谱录入 Agent 的多轮澄清交互：当首次结构化提取存在歧义时，用户可通过补充文本进行澄清，系统自动将增量信息合并到原草稿中，直至歧义全部解决或达到轮次上限。

## Requirements

### Requirement: API 支持草稿续写

系统的 `POST /api/agent/intake` 接口 SHALL 接受可选的 `previousDraft` 和 `clarificationText` 字段。当两者都存在时，系统进入续写模式而非全新解析模式，返回基于前一轮草稿合并更新后的完整草稿。

#### Scenario: 首次录入（无 previousDraft）
- **WHEN** 客户端仅发送 `{ text: "..." }`（不含 `previousDraft`）
- **THEN** 系统执行全新结构化提取，返回完整 `IntakeDraft`

#### Scenario: 续写录入（含 previousDraft）
- **WHEN** 客户端发送 `{ text: "原始口述", previousDraft: <前轮草稿JSON>, clarificationText: "他的父亲叫王建国" }`
- **THEN** 系统调用续写 Agent，将补充信息合并到前轮草稿中，返回更新后的完整 `IntakeDraft`

#### Scenario: 续写保留已确认复用结果
- **WHEN** 前轮草稿中某人物的 `action` 为 `reuse`（已确认复用已有记录）
- **THEN** 续写操作 SHALL 保留该人物的 `action: "reuse"` 和 `existingPersonId`，不被覆盖

### Requirement: 草稿合并逻辑

系统 SHALL 实现 `mergeDraftWithClarification()` 函数，将 LLM 从补充文本中提取的增量修改合并到原草稿中。合并策略应在字段级别执行，而不是按整条记录锁死：不可回退的复用结果保持不变；与歧义直接相关的字段允许被补全；新条目追加；已解决的歧义移除，未解决或新出现的歧义保留。

#### Scenario: 确认人物匹配
- **WHEN** 前轮草稿中某个 person 的 `action` 为 `create`，且 `ambiguities` 中包含对应的 `person_match` 歧义
- **AND** 新提取中该 person 被标记为 `action: "reuse"` 并指定了 `existingPersonId`
- **THEN** 合并后该 person 的 `action` 变为 `reuse`，对应的 `person_match` 歧义被移除

#### Scenario: 补充人物性别
- **WHEN** 前轮草稿中某个 person 的 `gender` 为 `unknown`
- **AND** `ambiguities` 中包含对应的 `person_gender_unknown` 歧义
- **AND** 补充文本明确了该人物性别
- **THEN** 合并后该 person 的 `gender` SHALL 被更新为明确值，且对应歧义被移除

#### Scenario: 补充缺失关系引用
- **WHEN** 前轮草稿某条关系标记为 `action: "skip"`，原因为 `missing_reference`
- **AND** 补充文本明确了关系两端
- **THEN** 合并后该关系恢复为 `action: "create"`，对应的 `missing_reference` 歧义被移除

#### Scenario: 已确认复用结果不被覆盖
- **WHEN** 前轮草稿中某人物的 `action` 为 `reuse` 且无关联歧义
- **THEN** 合并后该条目的 `action: "reuse"` 与 `existingPersonId` SHALL 保持不变，不受 LLM 新输出影响

### Requirement: 澄清问题类型扩展

系统 SHALL 支持以下澄清类型，每种类型提供自然语言追问文本 `question` 字段：

- `person_match`: 同名人物匹配不唯一
- `person_gender_unknown`: 人物性别未知，导致当前草稿不能安全写入
- `missing_reference`: 关系引用的人物未在草稿中定义
- `duplicate_relationship`: 与已有数据重复
- `generation_unclear`: 无法确定代际关系（新增）
- `relationship_direction_unknown`: 关系类型或方向不明确（新增）

其中，`person_match`、`person_gender_unknown`、`generation_unclear`、`relationship_direction_unknown` 应优先作为可通过一句补充继续澄清的类型；`missing_reference` 在补齐引用时可被解决；`duplicate_relationship` 可继续作为阻塞提示存在。

#### Scenario: 检测人物性别未知
- **WHEN** 用户输入中提到某人物，但系统无法确定其性别
- **THEN** 系统生成 `kind: "person_gender_unknown"` 条目，`question` 字段要求用户补充该人物的性别或角色信息

#### Scenario: 检测代际不明
- **WHEN** 用户输入"张三是李四的亲戚"但未说明具体亲属关系
- **THEN** 系统在歧义列表中生成 `kind: "generation_unclear"` 条目，`question` 字段包含追问文本如"'张三'和'李四'之间是什么辈分关系？"

#### Scenario: 检测关系方向不明
- **WHEN** 用户输入能确定存在亲属关系，但不足以映射到当前 `spouse | child` 关系模型
- **THEN** 系统生成 `kind: "relationship_direction_unknown"` 条目，`question` 字段追问谁是父母、谁是子女，或双方是否为配偶

### Requirement: 前端澄清交互

草稿前端组件 SHALL 在草稿存在未解决歧义时显示补充输入区：
- 每个歧义条目显示其 `question`（追问文本）和 `options`（可选选项）
- 底部显示通用补充输入框，placeholder 为"补充一句话来澄清..."
- 提交后显示加载状态，收到更新草稿后替换当前展示
- 保留澄清对话历史

#### Scenario: 显示澄清追问
- **WHEN** 草稿包含 `generation_unclear` 歧义
- **THEN** 草稿卡片显示追问文本，用户可在下方输入框补充信息

#### Scenario: 补充后更新草稿
- **WHEN** 用户输入补充文本并提交
- **THEN** 系统发送续写请求，收到更新草稿后替换当前卡片内容，已解决的歧义消失，新的待确认项（如有）继续展示

#### Scenario: 所有歧义解决后可写入
- **WHEN** 草稿的 `readyToApply` 为 `true`（所有歧义已解决）
- **THEN** "确认写入家谱"按钮可用，用户可点击写入

### Requirement: 澄清轮次限制

系统 SHALL 将单份草稿的自动澄清轮次限制为最多 5 轮。

#### Scenario: 达到澄清上限
- **WHEN** 同一份草稿已经完成 5 次澄清请求，且仍未 `readyToApply`
- **THEN** 前端停止继续自动澄清，引导用户重新开始或切换为手动录入
