# 人物卡片布局优化 — 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**目标:** 将 PersonNode 卡片中的性别标签和生卒年份拆为两行，确保年份完整可见。

**架构:** 修改 `src/components/person-node.tsx` 中卡片 JSX 布局，宽度从 190px 扩至 200px，性别和年份从同一 flex 行拆为独立两行，去除年份 `truncate`。

**技术栈:** React 19, Tailwind CSS 4

---

### Task 1: 调整卡片布局

**文件:**
- 修改: `src/components/person-node.tsx:107-119`

- [ ] **Step 1: 修改卡片宽度**

将第 92 行的 `w-[190px]` 改为 `w-[200px]`：

```tsx
// 第 92 行 — 改前
className={cn(
  "app-frosted relative flex w-[190px] items-start gap-3 overflow-hidden rounded-[1.35rem] border px-3.5 py-3 text-left shadow-[0_14px_32px_color-mix(in_oklch,var(--foreground)_10%,transparent)] transition-all duration-200",
  ...
)}
// 改后
className={cn(
  "app-frosted relative flex w-[200px] items-start gap-3 overflow-hidden rounded-[1.35rem] border px-3.5 py-3 text-left shadow-[0_14px_32px_color-mix(in_oklch,var(--foreground)_10%,transparent)] transition-all duration-200",
  ...
)}
```

- [ ] **Step 2: 将性别标签和年份拆为两行**

将第 111-119 行的内容区替换：

```tsx
// 改前 (第 111-119 行)
<div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
  <span className="rounded-full border border-border/80 bg-background/65 px-2 py-0.5">
    {isMale ? "男" : "女"}
  </span>
  <span className="truncate">
    {birthYear}
    {deathYear ? ` - ${deathYear}` : ""}
  </span>
</div>

// 改后
<div className="mt-2 space-y-1 text-xs text-muted-foreground">
  <span className="inline-block rounded-full border border-border/80 bg-background/65 px-2 py-0.5">
    {isMale ? "男" : "女"}
  </span>
  <div>
    {birthYear}
    {deathYear ? ` - ${deathYear}` : ""}
  </div>
</div>
```

- [ ] **Step 3: 类型检查**

```bash
npx tsc --noEmit
```

预期: 无新增错误。

- [ ] **Step 4: 提交**

```bash
git add src/components/person-node.tsx
git commit -m "feat: 优化人物卡片布局 — 年份独立成行，宽度扩至200px"
```
