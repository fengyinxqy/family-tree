## Purpose

Define the engineering quality gates that every repository change must satisfy, including lint baseline, unified quality entry point, regression protection, and documentation requirements.

## Requirements

### Requirement: Lint 基线必须零错误零警告
仓库 SHALL 提供可重复执行的 lint 检查，并 MUST 在出现任意 ESLint error 或 warning 时返回失败。质量清账完成后，现有源代码 SHALL 在不使用全局规则关闭或批量忽略的情况下通过该检查。

#### Scenario: 干净代码通过 lint 门禁
- **WHEN** 开发者在完整安装依赖的仓库中执行 lint 质量检查
- **THEN** 检查以零退出码结束，并报告零 error、零 warning

#### Scenario: 新增 lint 告警被阻断
- **WHEN** 代码变更引入任意 ESLint warning 或 error
- **THEN** lint 质量检查以非零退出码结束

### Requirement: 仓库必须提供统一质量入口
仓库 SHALL 提供一个统一命令，按确定顺序执行 lint、TypeScript 类型检查、自动化测试和生产构建。任一阶段失败时，该命令 MUST 返回非零退出码，且各阶段 MUST 仍可独立执行以支持快速诊断。

#### Scenario: 全部质量阶段通过
- **WHEN** 开发者或自动化环境执行统一质量命令且所有阶段成功
- **THEN** 命令以零退出码结束

#### Scenario: 任一质量阶段失败
- **WHEN** lint、类型检查、测试或生产构建中的任一阶段失败
- **THEN** 统一质量命令以非零退出码结束并保留失败阶段的输出

### Requirement: 清账不得改变既有产品行为
工程质量债务修复 MUST 保持现有家谱展示、成员搜索、设置持久化、快照恢复、人员与关系服务行为不变。涉及状态初始化、异步加载或领域类型的重构 SHALL 由现有测试或新增回归验证覆盖。

#### Scenario: 现有自动化测试保持通过
- **WHEN** 完成 lint 与类型债务修复后执行仓库测试套件
- **THEN** 所有既有测试和本变更新增的回归测试均通过

#### Scenario: 本地设置状态保持兼容
- **WHEN** 浏览器本地存储中存在已保存的默认视图、面板或头部折叠状态
- **THEN** 重构后的客户端组件恢复与变更前相同的用户设置，且不产生水合错误

### Requirement: 自动化环境必须复用统一质量入口
项目的持续集成或等价自动化环境 SHALL 使用锁定依赖安装，并 MUST 调用仓库定义的统一质量命令，而不是维护一套行为不同的重复检查序列。

#### Scenario: 自动化验证提交
- **WHEN** 自动化环境验证一次代码提交或合并请求
- **THEN** 它从锁文件安装依赖并执行统一质量命令

#### Scenario: 自动化阻断质量回归
- **WHEN** 提交导致统一质量命令失败
- **THEN** 自动化检查标记为失败并阻止该提交被视为质量合格

### Requirement: 工程文档必须说明质量验收方式
项目文档 SHALL 说明统一质量命令、各独立检查命令及必要环境前置条件，使开发者能够在本地复现自动化验收。

#### Scenario: 开发者查阅质量流程
- **WHEN** 开发者阅读项目开发文档
- **THEN** 文档提供可直接执行的 lint、类型检查、测试、构建和统一质量命令
