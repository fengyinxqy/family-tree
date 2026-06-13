# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概览

家谱系统 — 家族族谱管理与可视化平台。用户可手动录入人物/关系，也可通过 AI Agent 用自然语言批量录入，并计算任意两人之间的亲属关系。

> **重要提醒**: 本项目使用 Next.js 16，其 API、约定和文件结构可能与训练数据中的版本有重大差异。在编写任何代码前，先阅读 `node_modules/next/dist/docs/` 中的相关指南，并注意弃用通知。

## 开发命令

```bash
npm run dev           # 启动开发服务器 (localhost:3000)
npm run build         # 生产构建
npm run start         # 启动生产服务器
npm run lint          # ESLint 检查
npx tsc --noEmit      # 类型检查（重要：项目未配置 build 时的类型检查）
```

### 数据库

```bash
npx prisma migrate dev --name <name>   # 创建并应用迁移（自动生成 Prisma Client）
npx prisma generate                    # 仅重新生成 Prisma Client
npx prisma db push                     # 直接推送 schema 到数据库（不生成迁移文件）

# 本地开发需要先启动 PostgreSQL（Docker）
docker compose up -d postgres
```

### Docker 部署

```bash
bash scripts/setup.sh                  # 一键初始化（启动 DB → 迁移 → 构建启动应用）
docker compose up -d --build           # 手动构建并启动所有服务
```

## 技术架构

| 层 | 技术 |
|---|---|
| 框架 | Next.js 16 (App Router, Server Components, Route Handlers) |
| 认证 | NextAuth.js v5 (Credentials Provider, JWT session) |
| 数据库 | PostgreSQL 16, Prisma 7 (PrismaPg adapter) |
| 前端 | React 19, Tailwind CSS 4, shadcn/ui (base-nova style), @xyflow/react |
| 表单 | React Hook Form + Zod 4 |
| AI | 直接调用 OpenAI/DeepSeek API（不通过 SDK），支持结构化输出 |

## 目录结构

```
src/
  app/                  # Next.js App Router — 页面与服务端 API 路由
    api/                # Route Handlers (persons, relationships, agent/*)
    tree/               # 家族树主页面（服务端组件，获取数据后传给客户端）
    person/             # 人物 CRUD 页面
    login/ + register/  # 认证页面
  components/           # React 组件
    ui/                 # shadcn/ui 组件库
    family-tree.tsx     # 家族树核心（@xyflow/react 渲染，垂直布局）
    family-tree-agent-shell.tsx  # Agent 面板外壳（桌面侧栏 + 移动端 Dialog）
    agent-panel.tsx     # Agent 交互面板（录入 + 关系问答两个 Tab）
    person-node.tsx     # 自定义 React Flow 节点（含性别色系、生卒年份）
    person-form.tsx     # 新增/编辑人物表单（包含日期选择、关系管理）
  lib/
    agent/              # AI Agent 模块
      openai.ts         # 提供商抽象层（OpenAI/DeepSeek），createStructuredCompletion()
      intake-agent.ts   # 录入 Agent：自然语言 → 结构化草稿
      relationship-agent.ts  # 关系 Agent：自然语言问题 → 亲属关系推理
      tools.ts          # 草稿构建、模糊匹配、落库事务
      types.ts + schemas.ts  # 类型定义与 Zod/JSON Schema 双重验证
    kinship/
      relationship-engine.ts  # 确定性亲属推理引擎（BFS 最短路径 + 中文称谓映射）
    tree-layout.ts      # 自研纵向树布局算法（BFS 分层、配偶成组、子节点居中）
    auth.ts             # NextAuth 配置（Credentials + JWT）
    prisma.ts           # Prisma 客户端单例（PrismaPg adapter）
    utils.ts            # cn() 工具函数
  services/             # Server Actions — 业务逻辑 + 权限校验
  types/                # PersonData, RelationshipData, TreeNode, TreeEdge
prisma/
  schema.prisma         # User, Person, Relationship 三表模型
```

## 核心设计决策

### 认证模式

- 使用 NextAuth Credentials Provider，密码经 bcrypt-ts 加密
- Session 策略为 JWT，cookie 名固定为 `next-auth.session-token`
- 中间件 (`src/middleware.ts`) 使用 `getToken()` 进行 JWT 验证，**不依赖 prisma**，兼容 Edge Runtime
- 受保护路径：`/tree`, `/person`, `/api/persons`, `/api/relationships`, `/api/agent`

### 数据隔离

所有人物/关系数据通过 `createdBy` 字段归属于创建用户。Server Actions 和 API Routes 均校验 `session.user.id` 与 `person.createdBy` 一致性。

### AI Agent 流水线

1. **录入 Agent** (`POST /api/agent/intake`): LLM 结构化提取 → 本地 `buildIntakeDraft()` 进行人物匹配（同名复用）、关系去重、歧义检测 → 返回可审阅草稿
2. **应用草稿** (`POST /api/agent/intake/apply`): 仅当 `readyToApply: true` 时接受，在 Prisma 事务中批量写入
3. **关系 Agent** (`POST /api/agent/relationship`): LLM 解析问题中的两个人名 → 模糊匹配 → 调用 `inferRelationship()` 进行 BFS 亲属路径查找 → 返回中文称谓

关键原则：**LLM 只负责 NLU 提取，亲属关系推理由确定性 TypeScript 引擎执行**，不依赖模型"知道"中文亲属称谓。

### AI 提供商配置

- 通过 `AI_PROVIDER` 环境变量切换：`openai` 或 `deepseek`
- OpenAI 路径使用 `json_schema` 严格模式；DeepSeek 使用 `response_format: json_object` 并在 system prompt 中内联 schema
- DeepSeek 是当前默认配置

### 家族树布局

`src/lib/tree-layout.ts` 实现自研纵向（上→下）布局：
1. 构建邻接图（spouse / children / parent maps）
2. 找出根节点（无父母的人物）
3. BFS 分配层级（世代）
4. 按层分配 x 坐标：配偶通过 DFS 找连通分量成组，组内男左 → 女右，组间均匀分布
5. 用户拖拽后的位置（`pos_x`, `pos_y`）优先于自动布局

### React Flow 集成

- `@xyflow/react` 渲染节点和边，包裹在 `ReactFlowProvider` 中
- 自定义节点 `PersonNode` 用性别色系区分（蓝=男，粉=女），点击跳转到人物详情页
- 节点可拖拽，`onNodeDragStop` 时通过 `PATCH /api/persons/:id/position` 持久化位置
- 配偶边为虚线橙色（`straight` 类型），亲子边为实线灰色（`smoothstep` 类型）
- 空树时显示引导卡片，提示用户手动添加或使用 Agent

### 亲属推理引擎

`src/lib/kinship/relationship-engine.ts`:
- 将 Person + Relationship 数据构建为有向图（spouse 双向、parent/child 单向）
- BFS 最短路搜索（最大深度 5）
- 按路径 hop 序列匹配中文称谓（父亲/母亲/兄弟/姐妹/祖父/祖母/孙子/孙女/叔伯/姑姨）
- 支持按目标性别返回不同称谓
