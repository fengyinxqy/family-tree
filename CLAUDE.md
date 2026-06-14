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
npm test              # 运行所有测试（Node.js 原生 test runner + tsx）
npx tsc --noEmit      # 类型检查（重要：项目未配置 build 时的类型检查）
```

### 运行单个测试

```bash
node --import tsx --test src/lib/kinship/__tests__/relationship-engine.test.ts
node --import tsx --test src/lib/agent/__tests__/schemas.test.ts
node --import tsx --test src/services/import-export-core.test.ts
```

测试位于 `src/**/*.test.ts`，使用 Node.js 原生 `node:test` 运行器。测试文件共计 8 个，分布在 `src/lib/agent/__tests__/`、`src/lib/kinship/__tests__/`、`src/services/` 等目录。

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

## 环境变量

复制 `.env.example` 为 `.env`，关键变量：

| 变量 | 说明 |
|---|---|
| `DATABASE_URL` | PostgreSQL 连接字符串 |
| `AUTH_SECRET` | NextAuth JWT 签名密钥 |
| `AI_PROVIDER` | `openai` 或 `deepseek`（当前默认 `deepseek`） |
| `DEEPSEEK_API_KEY` / `DEEPSEEK_BASE_URL` / `DEEPSEEK_MODEL` | DeepSeek 配置 |
| `OPENAI_API_KEY` / `OPENAI_AGENT_MODEL` | OpenAI 配置 |

## 技术架构

| 层 | 技术 |
|---|---|
| 框架 | Next.js 16 (App Router, Server Components, Route Handlers) |
| 认证 | NextAuth.js v5 (Credentials Provider, JWT session) |
| 数据库 | PostgreSQL 16, Prisma 7 (PrismaPg adapter) |
| 前端 | React 19, Tailwind CSS 4, shadcn/ui (base-nova style), @xyflow/react |
| 表单 | React Hook Form + Zod 4 |
| AI | 直接调用 OpenAI/DeepSeek API（不通过 SDK），支持结构化输出与 Function Calling |

## 目录结构

```
src/
  app/                              # Next.js App Router
    api/                            # Route Handlers
      agent/intake/                 # 录入 Agent（首次 + 续写澄清）
      agent/intake/apply/           # 应用草稿（批量写入）
      agent/chat/                   # 统一 Agent 入口（自动路由到录入/关系/分析工具）
      agent/relationship/           # 关系问答 Agent
      persons/                      # 人物 CRUD API（含位置持久化）
      relationships/                # 关系 CRUD API
      import-export/                # 备份导出 / 恢复导入 API
    tree/                           # 家族树主页面
    person/[id]/                    # 人物详情 + 关系 + 事件管理页
    login/ + register/              # 认证页面
  components/
    ui/                             # shadcn/ui 组件库（17 个组件）
    family-tree.tsx                 # 家族树核心（@xyflow/react 渲染，垂直布局）
    agent-panel.tsx                 # Agent 交互面板（录入 + 关系问答两个 Tab）
    person-node.tsx                 # 自定义 React Flow 节点（性别色系、生卒年份）
    person-form.tsx                 # 新增/编辑人物表单（日期选择、关系管理、事件管理）
    relationship-form.tsx           # 关系编辑表单
    import-export-panel.tsx         # 备份/恢复界面
    global-search.tsx / member-search.tsx  # 全局搜索 / 成员搜索面板
    login-form.tsx / register-form.tsx     # 认证表单
    app-surface.tsx / workspace-route-shell.tsx  # 布局外壳
  lib/
    agent/                          # AI Agent 模块
      openai.ts                     # 提供商抽象层（OpenAI/DeepSeek），导出 createStructuredCompletion / createChatCompletion
      unified-agent.ts              # 统一 Agent：Function Calling 路由（extract_family_data / query_relationship / analyze_person_gaps）
      intake-agent.ts               # 录入 Agent：自然语言 → 结构化草稿
      relationship-agent.ts         # 关系 Agent：自然语言问题 → 亲属关系推理
      tools.ts                      # 草稿构建、模糊匹配、落库事务、人物上下文查询
      types.ts + schemas.ts         # 类型定义与 Zod/JSON Schema 双重验证
      __tests__/                    # schemas / merge-draft / api-continuation 测试
    kinship/
      relationship-engine.ts        # 确定性亲属推理引擎（BFS 最短路径 + 中文称谓映射）
      __tests__/                    # relationship-engine 测试（600+ 行）
    relationships/
      derived-siblings.ts           # 派生兄弟姐妹关系计算
    family-graph.ts                 # 家族图谱分析（世系组、时间线、建议）
    member-search.ts                # 成员搜索评分与匹配
    import-export/
      backup-format.ts              # 备份格式定义与验证
    tree-layout.ts                  # 自研纵向树布局算法（BFS 分层、配偶成组、子节点居中）
    auth.ts                         # NextAuth 配置（Credentials + JWT）
    prisma.ts                       # Prisma 客户端单例（PrismaPg adapter）
    utils.ts                        # cn() 工具函数
  services/                         # Server Actions — 业务逻辑 + 权限校验
    family-tree-space.service.ts    # 多树空间管理（创建/切换/删除 + cookie 持久化活跃空间）
    family-workspace.service.ts     # 聚合人物+关系+事件数据为树工作区
    person.service.ts               # 人物 CRUD + 事件管理 + 位置更新 + 代次同步
    relationship.service.ts         # 关系 CRUD + 代次编号同步
    import-export-core.ts           # 备份导出/恢复导入核心逻辑
    import-export.service.ts        # 导入导出服务包装器
  types/                            # PersonData, PersonEventData, RelationshipData, TreeNode, TreeEdge
  middleware.ts                      # JWT 认证守卫（Edge Runtime 兼容）
prisma/
  schema.prisma                     # 数据模型（5 个表，见下文）
  migrations/                       # 数据库迁移历史
```

## 数据模型（5 个表）

| 模型 | 关键字段 | 说明 |
|---|---|---|
| **User** | id, email (unique), name, passwordHash | 用户账户 |
| **FamilyTree** | id, name, description, ownerId → User | 家谱空间（多树隔离），每用户可创建多个 |
| **Person** | id, name, gender, birthDate, deathDate, aliases[], generationNumber, generationLabel, nativePlace, notes, posX, posY, createdBy → User, treeId → FamilyTree | 人物，归属于用户和家谱空间 |
| **PersonEvent** | id, personId → Person (Cascade), type (birth/death/marriage/migration/other), title, dateLabel, location, description, sortOrder | 人物生平事件 |
| **Relationship** | id, type (spouse/child), personAId → Person, personBId → Person, label, sortOrder | 人物关系（配偶或亲子） |

所有人物/关系数据通过 `createdBy` 和 `treeId` 实现数据隔离。

## 核心设计决策

### 认证模式

- NextAuth Credentials Provider，密码经 bcrypt-ts 加密
- Session 策略为 JWT，cookie 名固定为 `next-auth.session-token`
- 中间件 (`src/middleware.ts`) 使用 `getToken()` 进行 JWT 验证，**不依赖 prisma**，兼容 Edge Runtime
- 受保护路径：`/tree`, `/person`, `/api/persons`, `/api/relationships`, `/api/agent`, `/api/import-export`

### 多树空间（FamilyTree Space）

- 每个用户可以创建多个家谱空间（FamilyTree），不同空间的数据完全隔离
- `family-tree-space.service.ts` 管理空间的 CRUD，通过 cookie `family.active_tree_id` 持久化当前活跃空间
- `getActiveFamilyTreeForUser()` 获取当前活跃空间（不存在则自动创建默认空间），所有 API 和 Service 操作均限定在当前活跃空间内
- 删除空间时至少保留 1 个（`ensureDefaultFamilyTreeForUser` 兜底）

### 数据隔离

所有人物/关系数据通过 `createdBy` + `treeId` 双重归属。Server Actions 和 API Routes 均校验 `session.user.id` 与当前活跃空间。

### AI Agent 流水线

1. **统一 Agent** (`POST /api/agent/chat`): 接收用户自然语言消息，通过 Function Calling 自动路由到对应工具：
   - `extract_family_data`：提取人物和关系结构化数据 → 调用 `runIntakeAgent()`
   - `query_relationship`：查询两人之间的亲属关系路径 → 调用 `runRelationshipAgent()`
   - `analyze_person_gaps`：分析人物资料缺口
2. **录入 Agent** (`POST /api/agent/intake`): LLM 结构化提取 → 本地 `buildIntakeDraft()` 进行人物匹配（同名复用）、关系去重、歧义检测 → 返回可审阅草稿。支持续写模式（`previousDraft` + `clarificationText`）进行多轮澄清
3. **应用草稿** (`POST /api/agent/intake/apply`): 仅当 `readyToApply: true` 时接受，在 Prisma 事务中批量写入人物和关系
4. **关系 Agent** (`POST /api/agent/relationship`): LLM 解析问题中的两个人名 → 模糊匹配 → 调用 `inferRelationship()` 进行 BFS 亲属路径查找 → 返回中文称谓

关键原则：**LLM 只负责 NLU 提取，亲属关系推理由确定性 TypeScript 引擎执行**，不依赖模型"知道"中文亲属称谓。

### AI 提供商配置

- 通过 `AI_PROVIDER` 环境变量切换：`openai` 或 `deepseek`
- OpenAI 路径使用 `json_schema` 严格模式；DeepSeek 使用 `response_format: json_object` 并在 system prompt 中内联 schema
- `createChatCompletion()` 支持 Function Calling（用于统一 Agent），temperature 固定 0.3
- DeepSeek 是当前默认配置

### 家族树布局

`src/lib/tree-layout.ts` 实现自研纵向（上→下）布局：
1. 构建邻接图（spouse / children / parent maps）
2. 找出根节点（无父母的人物）
3. BFS 分配层级（代次），代入 `generationNumber` 字段
4. 按层分配 x 坐标：配偶通过 DFS 找连通分量成组，组内男左 → 女右，组间均匀分布
5. 用户拖拽后的位置（`posX`, `posY`）优先于自动布局

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

### 导入导出

- `src/services/import-export-core.ts` 负责备份导出（将当前空间数据序列化为 JSON 文档）和恢复导入（验证文档格式后批量写入）
- `src/lib/import-export/backup-format.ts` 定义备份文档的 schema 和验证逻辑
- API 路由位于 `/api/import-export/export` 和 `/api/import-export/import`
