## 1. Search interaction refinement

- [x] 1.1 梳理 `src/components/member-search.tsx` 的输入、结果列表、空态和清空行为，统一搜索状态管理
- [x] 1.2 优化搜索结果匹配与展示细节，确保键盘导航、激活项切换和结果选择行为稳定可预期

## 2. Tree focus coordination

- [x] 2.1 调整 `src/components/family-tree.tsx` 中的搜索选中逻辑，确保选中结果后稳定居中到目标节点
- [x] 2.2 强化搜索高亮在树重排、节点刷新和清空搜索时的同步行为，避免残留或丢失状态

## 3. Verification

- [x] 3.1 为成员搜索与树图定位补充交互测试，覆盖命中结果、空结果、键盘选择、高亮和清空恢复场景
- [x] 3.2 运行相关测试与静态检查，确认搜索与树图定位增强未破坏现有家谱工作台交互
