# GPT-5.4 + Reasonix 工作流

## 目标

在这个仓库里，功能设计和 OpenSpec 提案由 Codex GPT-5.4 完成，功能的实际开发默认交给 Reasonix，并固定使用 `DeepSeek v4 Pro`。

## 角色分工

### Codex GPT-5.4 负责

- 需求澄清与方案探索
- OpenSpec 提案生成与更新
- 拆分 `proposal.md`、`design.md`、`tasks.md`
- 定义验收标准、风险和边界
- 开发完成后的 review、验证和收尾

### Reasonix + DeepSeek v4 Pro 负责

- 基于已批准的 OpenSpec change 执行实际编码
- 按 `tasks.md` 顺序完成实现
- 在实现前读取 OpenSpec apply 指令和全部上下文文件
- 完成任务后更新任务勾选状态
- 运行必要验证并汇报结果

## 标准流程

1. 用户提出功能需求。
2. Codex GPT-5.4 负责探索、设计，并生成或更新 OpenSpec change。
3. 当 `proposal.md`、`design.md`、`tasks.md` 准备好后，由 Codex 明确 change 名称和实现边界。
4. 实现阶段切换到 Reasonix，默认模型为 `deepseek-pro/deepseek-v4-pro`。
5. Reasonix 读取：
   - `openspec status --change "<change-name>" --json`
   - `openspec instructions apply --change "<change-name>" --json`
   - apply 指令列出的全部 `contextFiles`
6. Reasonix 只实现 pending tasks，不擅自扩 scope。
7. Codex 回到仓库做 review、补充修正、同步任务状态，并决定是否归档该 change。

## 仓库内启动方式

优先使用仓库脚本：

```powershell
npm run reasonix:apply -- <change-name>
```

示例：

```powershell
npm run reasonix:apply -- add-member-search
```

这个脚本会：

- 固定使用 `deepseek-pro/deepseek-v4-pro`
- 让 Reasonix 先读取 OpenSpec apply 上下文
- 提醒它遵守本仓库的 Next.js 16 约束
- 要求它完成后回报修改文件、验证结果和剩余风险

## 对 Reasonix 的实现要求

- 只做实现，不做新的产品设计决策
- 若要修改 Next.js 相关代码，先读 `node_modules/next/dist/docs/` 相关文档
- 不修改 `proposal/design/spec`，除非实现被阻塞且需要显式记录 blocker
- 保持改动最小、聚焦，避免顺手重构无关内容
- 至少运行：
  - `npm run lint`
  - `npx tsc --noEmit`
  - 如果改动触及测试范围，再运行 `npm test`

## 何时回到 Codex

以下情况应回到 Codex GPT-5.4：

- 需要重新定义需求边界
- 实现暴露出设计冲突
- OpenSpec 任务拆分不合理
- 需要做最终代码审查和验收结论

## 一句话约定

默认规则是：`Codex 负责想清楚并写清楚，Reasonix 负责把 approved change 做出来。`
