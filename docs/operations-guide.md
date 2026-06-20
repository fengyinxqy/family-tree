# 协作、发布与管控操作指南

## 修订组

### 基本概念
- **修订组（Revision Group）** 是 AI 多轮录入和关系建议的输出容器，包含一个或多个有序修订成员。
- **独立修订（Standalone Revision）** 是仅含一个已有端点关系的修订（如纯关系建议），不需要组容器。
- 修订组成员在发布前使用临时引用（`tmp:person-0`）相互引用，避免正式标识符提前暴露。

### 限制
- 最大成员数：200 个
- 临时引用模式：`tmp:[a-zA-Z0-9_-]{1,120}`
- 发布事务使用 Serializable 隔离级别

## 工作流

DRAFT → IN_REVIEW → APPROVED → PUBLISHED
                → CHANGES_REQUESTED（退回）

- DRAFT：创建后可修改 payload
- IN_REVIEW：提交审校，不可修改
- CHANGES_REQUESTED：退回，需要派生新草稿
- APPROVED：通过审校，可发布
- PUBLISHED：已发布到正式数据

### 各阶段权限要求
- 创建修订/组：EDITOR 及以上
- 提交审校：EDITOR 及以上
- 审校决定：REVIEWER 及以上（不可自审，OWNER/ADMIN 可自审需填写覆盖原因）
- 发布：ADMIN 及以上
- 撤回：ADMIN 及以上
- 查看审计历史：仅 OWNER

## 来源追溯

提交审校前必须声明至少一个来源条目，支持四种来源类型：

| 类型 | 说明 | 验证规则 |
|------|------|----------|
| MATERIAL | 引用已有文献资料 | 资料必须属于当前家族且未被删除
| MEDIA_OBJECT | 引用已有媒体文件 | 媒体必须属于当前家族
| INTAKE_SNAPSHOT | AI 录入原文快照 | 自动生成，包含 SHA-256 哈希和前 500 字符摘要
| MANUAL_KNOWLEDGE | 人工知识声明 | 不需要外部引用，但必须填写理由

## 撤回操作

### 预览
1. POST `/api/publications/withdraw` 传入 `{action: "preview", entityType, entityId}`
2. 系统检查目标实体的依赖冲突（如人员撤回需检查活跃关系）
3. 返回依赖报告和 5 分钟有效的一次性确认 ID

### 确认
1. POST `/api/publications/withdraw` 传入 `{action: "confirm", confirmationId, entityType, entityId, reason}`
2. 系统校验确认有效性、重新授权
3. 在 Serializable 事务中执行撤回、递增多修订号、写入审计
4. 返回操作结果

### 撤回后行为
- 在普通读视图中（树图、人物详情、资料列表、导出等）不可见
- 审计历史中保留完整记录（操作者、时间、原因）
- 已发布修订的历史版本不受影响
- 同一实体不可重复撤回

### 依赖冲突规则
| 撤回类型 | 冲突条件 |
|----------|----------|
| PERSON | 存在活跃关系（配偶/亲子）或资料关联
| SOURCE_MATERIAL | 存在活跃媒体文件
| RELATIONSHIP | 无冲突
| PERSON_EVENT | 无冲突
| MEDIA_OBJECT | 无冲突
| MATERIAL_LINK | 无冲突

## 迁移与回滚

### 迁移策略
1. 创建 revision_group、revision_provenance 表并添加 withdrawn 字段
2. 创建必要索引
3. 已有正式记录保持可见（`withdrawnAt IS NULL`）
4. 不伪造已有记录的来源

### 回滚策略
1. 禁用 AI 录入应用、来源提交和撤回端点
2. 已有正式记录和已发布修订保持有效
3. 新修订组和来源记录转为只读历史
4. 可见性默认保持最近一次成功发布的状态

## 审计历史

审计操作在业务事务中自动创建，支持以下协作操作类型：

- 人物/关系创建、修改、删除、恢复
- 修订创建、提交、审校、发布
- 修订组创建、提交、审校、发布
- 内容撤回
- 成员邀请、接受、撤销
- 角色变更、停用、重新激活
- 所有权移交
- 快照创建与恢复

安全摘要规则：
- 只包含稳定 ID、内容类型、计数、角色、状态和安全来源标签
- 邀请令牌、完整修订 payload、录入原文、凭证和文件字节不写入审计摘要
- 撤回操作写入操作者、时间、原因

## 管理员检查清单

- [ ] 确认 migration 已成功执行
- [ ] 确认已有正式记录可见
- [ ] 测试 AI 录入 → 创建修订组 → 提交审校流程
- [ ] 测试审校通过 → 发布流程
- [ ] 测试撤回预览和确认流程
- [ ] 测试撤回后内容在普通视图中不可见
- [ ] 测试撤回后审计历史记录保留
- [ ] 测试角色矩阵：OWNER/ADMIN/EDITOR/REVIEWER/VIEWER
- [ ] 测试跨家族 ID 不会泄露其他家族的数据
