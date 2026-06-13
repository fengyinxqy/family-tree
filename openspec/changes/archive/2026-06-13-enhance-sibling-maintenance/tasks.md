## 1. Relationship write path

- [x] 1.1 收敛 `src/app/api/relationships/route.ts` 的写入逻辑到 `src/services/relationship.service.ts`
- [x] 1.2 在关系服务中补充父母-子女关系创建后的重验证与可复用校验逻辑

## 2. Derived sibling model

- [x] 2.1 新增纯函数，基于人物双向 `child` 关系推导同辈成员列表与 `兄弟 / 兄妹 / 姐妹` 标签
- [x] 2.2 扩展人物详情服务返回值，在 `getPerson` 结果中包含 `siblings` 视图数据

## 3. Person detail presentation

- [x] 3.1 更新 `src/app/person/[id]/page.tsx` 的关系摘要与分组展示，加入同辈关系 section
- [x] 3.2 调整详情页空态与统计文案，确保父母、配偶、子女、同辈四类视图保持一致

## 4. Verification

- [x] 4.1 为同辈推导逻辑补充单元测试，覆盖兄弟、兄妹、姐妹和单亲共享场景
- [x] 4.2 运行相关测试与静态检查，确认关系维护增强未破坏现有关系展示
