## Why

当前系统已经支持用户持续维护人物、关系与人物事件，但还没有把这些数据带走、备份或恢复的能力。`docs/v1.1-roadmap.md` 已经把导入导出列为 V1.1 的主链路能力之一，现在补上这块可以给用户最基础的数据安全感，也为后续跨环境迁移、批量初始化和更标准的交换格式打基础。

## What Changes

- 新增家谱数据导出能力，支持将当前用户可访问的完整家谱数据导出为结构化 JSON 备份文件。
- 新增家谱数据导入能力，支持从系统导出的 JSON 备份恢复人物、关系和事件数据。
- 为导入流程补充基础校验、冲突处理策略和导入结果反馈，避免无效或部分损坏的数据直接写入数据库。
- 为后续 Excel / GEDCOM 等外部格式扩展预留统一的导入导出能力边界，但本轮首发以 JSON 备份/恢复为核心。

## Capabilities

### New Capabilities
- `import-export`: 定义家谱数据的 JSON 导出、JSON 导入、校验与恢复规则

### Modified Capabilities
<!-- 当前无需要修改的现有 capability -->

## Impact

- **数据模型读取与写入编排**: `src/services/person.service.ts`, `src/services/relationship.service.ts`
- **新增导入导出服务与 API**: `src/services/*`, `src/app/api/*`
- **数据库一致性与事务策略**: Prisma 查询、批量写入、回滚逻辑
- **后续界面入口**: 设置页、工具页或家谱工作台中的导入导出入口
- **文档与测试**: `docs/v1.1-roadmap.md` 对齐，新增导入导出相关测试
