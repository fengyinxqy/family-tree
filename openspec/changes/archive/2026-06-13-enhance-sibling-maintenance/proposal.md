## Why

当前家族关系维护只会保存原始的父母、配偶、子女边，缺少对“同父母的同辈关系”这一层语义的自动补全。结果是用户在先后创建兄弟姐妹时，系统虽然已经具备推导条件，却没有在人物详情中显式呈现这类关系，导致关系维护体验不完整，也和用户对“长子/次子/女儿”创建后的直觉不一致。

## What Changes

- 在关系维护链路中补充“同辈关系自动识别”能力：当新增父母-子女关系后，系统自动识别该人物与同父或同母既有子女之间的兄弟、兄妹、姐妹关系。
- 同辈关系继续作为基于原始 `child` 关系推导出的视图数据，而不是新增会影响家族树布局的持久化连线。
- 扩展人物详情页的关系摘要与分组展示，使用户可以直接查看某人物的同辈成员及对应关系称谓。
- 保持现有家族树边线与 `Relationship` 原始模型不变，避免为兄弟姐妹关系新增图谱线条。

## Capabilities

### New Capabilities
- `relationship-maintenance`: 定义在维护父母-子女关系时，系统如何自动补全并返回同辈关系语义

### Modified Capabilities
- `person-detail-profile`: 人物详情页的关系摘要能力需要扩展到展示基于现有关系图推导出的同辈关系

## Impact

- **关系维护 API**: `src/app/api/relationships/route.ts`
- **人物详情数据组装**: `src/services/person.service.ts`
- **人物详情展示**: `src/app/person/[id]/page.tsx`
- **关系维护入口与文档**: `src/app/person/[id]/relationships/page.tsx`, `docs/v1.1-roadmap.md`
