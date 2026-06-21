# Genealogy Completion Agent

## Purpose

定义资料补全 Agent 的行为规范，确保其在明确范围内聚焦调查家谱缺口、区分缺失与未发现、提供可追溯依据，并产出受审校保护的修订草稿。本规范还规定了未来 OCR 工具接入时的数据协议要求。

## Requirements

### Requirement: 资料补全 Agent 必须在明确范围内调查家谱缺口
系统 SHALL 允许用户指定一个人物或家谱分支作为资料补全范围。Agent MUST 先解析并确认目标范围，再调查相关人物、关系、事件和资料引用，不得无界遍历整个家谱。

#### Scenario: 用户要求检查某一人物资料
- **WHEN** 用户要求检查一个可唯一匹配人物的资料完整性
- **THEN** Agent SHALL 收集该人物及完成判断所需的直接相关信息
- **AND** Agent SHALL 输出范围内的缺失项、冲突项和已有证据摘要

#### Scenario: 用户给出的范围不明确
- **WHEN** 姓名对应多个人物或"这一支"没有可确定的起点
- **THEN** Agent MUST 暂停并请求用户选择目标
- **AND** Agent MUST NOT 自主扩大调查范围

### Requirement: 资料补全 Agent 必须区分缺失、未发现与冲突
Agent MUST 将数据库字段缺失、已检索来源中未发现信息、候选事实互相冲突和信息已经完整区分为不同结论。Agent MUST NOT 将未发现的信息表述为事实不存在。

#### Scenario: 资料中没有出现出生日期
- **WHEN** 人物出生日期为空且已授权资料中未找到相关内容
- **THEN** Agent SHALL 将结论标记为"当前未发现出生日期证据"
- **AND** Agent MUST NOT 推断或编造日期

#### Scenario: 两份资料给出不同日期
- **WHEN** 多个来源对同一字段给出不一致值
- **THEN** Agent SHALL 将其标记为冲突并保留各自来源定位
- **AND** Agent MUST 请求人工判断，不得自行覆盖任一值

### Requirement: 资料补全 Agent 必须执行聚焦的多步调查
Agent SHALL 根据前一步结果选择必要的只读工具，并 MUST 在已有信息足够、没有可用工具或继续调查价值低于预算时停止。Agent 提问 MUST 聚焦于会改变匹配、完整性判断或修订内容的关键信息。

#### Scenario: 关系查询揭示缺失父母信息
- **WHEN** 人物查询显示父母关系缺失且现有资料可能包含父母信息
- **THEN** Agent SHALL 在预算内继续查询相关授权资料或人物候选
- **AND** Agent SHALL 根据结果形成问题或缺口结论

#### Scenario: 缺失项过多
- **WHEN** 调查发现多个缺失项但只有少数会阻塞人物匹配或关系方向
- **THEN** Agent SHALL 优先询问阻塞性问题
- **AND** Agent SHALL 将其余缺失项保留在报告中而不一次性轰炸用户

### Requirement: 资料补全结果必须包含可追溯依据
Agent 生成的缺口报告、候选事实和修订草稿 MUST 引用支持结论的数据库对象或来源定位，并 MUST 记录使用的工具与模型版本。无法获得来源时 MUST 明确标记信息来自用户陈述或 Agent 分析，而不得伪造引用。

#### Scenario: 候选事实来自已上传资料
- **WHEN** Agent 从资料工具获得带页码或文本片段定位的候选事实
- **THEN** 结果 SHALL 保留资料标识、定位和置信信息
- **AND** 后续修订组 SHALL 通过既有来源追溯机制关联该资料

#### Scenario: 信息来自当前用户回答
- **WHEN** 用户在澄清阶段提供一个新事实且没有外部资料
- **THEN** Agent SHALL 将来源标记为用户陈述
- **AND** 系统 SHALL 保留安全来源摘要而不得声称存在文献证据

### Requirement: 资料补全 Agent 必须产出报告或受审校保护的修订草稿
当调查只发现缺口而没有可写入事实时，Agent SHALL 生成报告并结束。当用户提供了足够且通过结构校验的新事实时，Agent SHALL 生成可审阅草稿；仅在明确确认后，系统 SHALL 将草稿转换为不可变修订组。

#### Scenario: 调查未产生新事实
- **WHEN** Agent 完成调查但没有获得可写入的新人物、事件或关系事实
- **THEN** 系统 SHALL 返回缺口报告
- **AND** 系统 SHALL NOT 创建空修订组

#### Scenario: 用户确认资料补全草稿
- **WHEN** 用户审阅并确认一个已准备就绪的资料补全草稿
- **THEN** 系统 SHALL 通过既有授权服务创建不可变修订组
- **AND** 正式记录 MUST 保持不变，直至修订组完成审校与发布

### Requirement: 资料补全 Agent 工具协议必须支持未来 OCR 结果
资料工具的输出模式 MUST 能表达来源资料、媒体对象、页码或区域定位、文本片段、置信度、提取器及模型版本。运行时 MUST 将该模式视为普通的授权结构化工具结果，使未来 OCR 能在不改变 Agent 会话和审批协议的情况下接入。

#### Scenario: 后续接入 OCR 工具
- **WHEN** OCR 工具返回符合资料工具模式的候选文本和定位
- **THEN** 资料补全 Agent SHALL 能将结果用于后续匹配、冲突分析和人工澄清
- **AND** OCR 结果 MUST NOT 绕过草稿确认、来源追溯或修订审校流程
