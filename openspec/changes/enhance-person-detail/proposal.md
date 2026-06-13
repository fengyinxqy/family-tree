## Why

当前人物详情页仍停留在“姓名 + 生卒 + 简介 + 亲属列表”的基础卡片层级，无法承载家谱长期维护所需要的别名、籍贯、备注与关键人生事件。`docs/v1.1-roadmap.md` 已将“人物详情增强”列为 v1.1 主链路能力之一，现在补齐这块可以让人物页从只读入口升级为持续沉淀家族档案的工作台。

## What Changes

- 为人物详情引入更完整的档案字段，覆盖别名、排行、籍贯和备注等补充信息
- 支持为人物记录关键事件，并按时间顺序展示出生、婚姻、迁徙、离世等人生节点
- 将当前分散的亲属列表整理为更清晰的关系摘要，帮助用户快速理解该人物在家谱中的位置
- 为人物详情数据读取与编辑链路补充一致的展示和校验规则，避免扩展字段后出现空态混乱或信息不一致

## Capabilities

### New Capabilities
- `person-detail-profile`: 为人物详情页提供增强档案字段、人物事件记录与关系摘要展示能力

### Modified Capabilities
<!-- 无现有 spec 需要修改 -->

## Impact

- **数据库模型**: `prisma/schema.prisma`
- **人物详情页**: `src/app/person/[id]/page.tsx`
- **人物编辑体验**: `src/components/person-form.tsx`, `src/app/person/[id]/edit/page.tsx`
- **人物 API / 服务层**: `src/app/api/persons/[id]/route.ts`, `src/app/api/persons/route.ts`, `src/services/person.service.ts`
- **文档与验证**: `docs/v1.1-roadmap.md` 对齐，新增与人物详情增强相关的测试覆盖
