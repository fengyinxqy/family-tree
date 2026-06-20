# 家谱云 · Family Genealogy Copilot

[English README](./README.en.md) | [MIT License](./LICENSE)

一个面向中文家谱整理场景的 AI 家谱产品原型。
它把传统家谱管理、可视化世系浏览、人物档案维护，以及 AI 识别录入与亲属关系推理整合到同一个工作台里，适合作为你的 GitHub 开源作品，也很适合作为一个完整的 AI 产品项目来展示。

## 项目定位

**家谱云** 不是单纯的 CRUD 后台，而是一个围绕"家谱资料数字化"设计的 AI 应用：
- 用树状图、世系表、分支图、时间轴来管理家族结构
- 用 AI 把自然语言、图片、文档中的家谱信息转成结构化草稿
- 用确定性亲属关系引擎回答"谁和谁是什么关系"
- 用统一的人物档案页维护生平、籍贯、事件、备注与关系网络

当前版本更偏向 **MVP / 产品原型**，但已经具备一个开源 AI 项目首页应有的完整叙事。

## 效果图
![家谱云目标效果图](./target.png)

## 为什么这个项目值得展示

- **产品感完整**：不是单点 AI Demo，而是有明确用户场景、界面工作流和业务闭环的产品原型
- **AI 与业务结合自然**：AI 负责理解、抽取、补全建议；核心亲属推理仍由规则引擎保证可控与可解释
- **中文垂直场景明确**：聚焦中文家谱、族谱、亲属称谓与资料整理
- **前后端一体化**：从界面、数据模型、认证、导入导出到 AI 接口设计都在同一仓库内

## 核心功能

### 1. 家谱工作台
- 树状图浏览家族结构
- 世系表查看代际成员
- 分支图聚焦某一支脉
- 时间轴查看人物事件
- 代际筛选、节点聚焦、右侧助手联动

### 2. 人物档案管理
- 维护姓名、性别、生卒、人物简介
- 记录别名、籍贯、备注、代际标签
- 管理出生、婚姻、迁徙等人生事件
- 补充父母、配偶、子女关系

### 3. 全局搜索（Ctrl+K）
- 点击顶部栏搜索框或按 `Ctrl+K` / `Cmd+K` 唤起搜索面板
- 支持按姓名、别名模糊搜索
- 键盘上下键导航、回车选中
- 选中后直接跳转至人物详情页

### 4. AI 识别录入
- 输入自然语言叙述，自动抽取人物与关系草稿
- 支持多轮澄清，降低一次性录入的歧义
- 草稿确认后再落库，避免错误写入
- 适合接入图片 OCR、扫描件解析、文档导入等入口

### 5. AI 亲属关系问答
- 支持提问"王丽和王建国是什么关系？"
- 自动匹配人物
- 返回推理路径与中文关系解释
- 复杂关系由规则引擎进行确定性推导

### 6. 导入导出
- 备份导出当前家谱数据
- 从备份恢复家谱内容
- 为后续支持 GEDCOM 等格式预留空间

## AI 设计思路

这个项目的 AI 设计不是"把一切都交给模型"，而是采用更适合产品落地的分层方式：

- **大模型负责**：自然语言理解、信息抽取、澄清问题生成
- **业务规则负责**：亲属路径计算、关系判定、结构一致性
- **人工确认负责**：最终草稿确认与资料修正

这样的设计更适合真实业务，也更适合拿来展示你的产品思维和工程判断。

## 技术架构图

```mermaid
flowchart TD
  User["用户 / 家谱整理者"]

  subgraph Frontend["前端工作台"]
    UI["Next.js 16 + React 19"]
    Tree["家谱树 / 世系表 / 人物档案"]
    AgentPanel["AI 助手面板"]
  end

  subgraph Backend["应用后端"]
    Routes["App Router API Routes"]
    Auth["NextAuth.js v5"]
    Services["业务服务层"]
  end

  subgraph AI["AI 能力层"]
    Provider["OpenAI / DeepSeek"]
    Structured["Zod + JSON Schema 结构化输出"]
    Agent["Intake Agent / Relationship Agent"]
  end

  subgraph Domain["确定性业务逻辑"]
    Draft["Draft 草稿模型"]
    RuleEngine["Relationship Engine 亲属关系推理"]
    ImportExport["导入导出"]
  end

  subgraph Data["数据层"]
    Prisma["Prisma 7"]
    Postgres["PostgreSQL"]
  end

  User --> UI
  UI --> Tree
  UI --> AgentPanel
  UI --> Routes
  Routes --> Auth
  Routes --> Services
  Services --> Prisma
  Prisma --> Postgres
  Routes --> Agent
  Agent --> Provider
  Agent --> Structured
  Structured --> Draft
  Services --> Draft
  Services --> RuleEngine
  Services --> ImportExport
  RuleEngine --> Prisma
```

## AI 工作流图

```mermaid
flowchart TD
  Input["用户输入自然语言家谱信息"]
  Context["读取当前家谱上下文<br/>已有人物 / 已有关系"]
  LLM["LLM 结构化抽取"]
  Schema["Zod / JSON Schema 校验"]
  Draft["生成 IntakeDraft<br/>人物 / 关系 / 证据 / 歧义"]
  Ambiguity{"是否存在歧义或缺失信息？"}
  Clarify["生成追问<br/>等待用户补充"]
  Merge["合并补充信息<br/>mergeDraftWithClarification"]
  Confirm["用户确认草稿"]
  Apply["事务写入数据库<br/>applyIntakeDraft"]
  Sync["同步代际信息<br/>syncGenerationNumbersForComponent"]
  Query["关系问答"]
  NER["AI 提取 sourceName / targetName"]
  Match["匹配人物"]
  Engine["BFS + hop pattern<br/>确定性亲属关系推理"]
  Answer["返回关系称谓、路径与解释"]

  Input --> Context
  Context --> LLM
  LLM --> Schema
  Schema --> Draft
  Draft --> Ambiguity
  Ambiguity -- "是" --> Clarify
  Clarify --> Merge
  Merge --> Draft
  Ambiguity -- "否" --> Confirm
  Confirm --> Apply
  Apply --> Sync

  Query --> NER
  NER --> Match
  Match --> Engine
  Engine --> Answer
```

## 技术栈

### 前端
- Next.js 16
- React 19
- Tailwind CSS 4
- shadcn/ui
- @xyflow/react

### 后端与数据
- Next.js App Router API Routes
- Prisma 7
- PostgreSQL
- NextAuth.js v5

### AI 与工程能力
- Zod schema 驱动的结构化输入输出
- 可切换 AI Provider
  - DeepSeek
  - OpenAI
- TypeScript 规则引擎进行亲属关系推理
- 统一 Agent 入口（支持多轮对话草稿生成与关系问答）

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

复制 `.env.example` 为 `.env`：
```bash
cp .env.example .env
```

示例环境变量：
```env
DATABASE_URL="postgresql://family:family123@localhost:5432/familydb"
AUTH_SECRET="generate-a-random-secret-here"

AI_PROVIDER="deepseek"
DEEPSEEK_BASE_URL="https://api.deepseek.com"
DEEPSEEK_API_KEY="your-deepseek-api-key"
DEEPSEEK_MODEL="deepseek-v4-flash"

OPENAI_API_KEY="your-openai-api-key"
OPENAI_AGENT_MODEL="gpt-5.5"
```

### 3. 启动数据库
如果你使用 Docker：
```bash
docker compose up -d postgres
```

### 4. 执行数据库迁移
```bash
npx prisma migrate dev
```

### 5. 启动开发服务器

```bash
npm run dev
```

打开 `http://localhost:3000` 即可访问。

## 常用脚本

```bash
npm run dev
npm run build
npm run start
npm run lint
npm test
```

## 项目结构

```text
src/
  app/           Next.js 页面与 API 路由
  components/    UI 组件、树图组件、AI 面板、全局搜索
  lib/           规则引擎、AI schema、工具函数、Agent 入口
  services/      业务服务层
  types/         TypeScript 类型定义
prisma/
  schema.prisma  数据模型
  migrations/    数据库迁移
docs/
  agent-mvp.md   AI 能力设计说明
public/          静态资源
target.png       项目目标效果图
```

## 当前状态
当前仓库已经具备以下基础能力：
- 用户注册与登录
- 家谱树可视化浏览
- 全局搜索（Ctrl+K 快捷唤起）
- 人物与关系维护
- AI 录入草稿与关系问答接口
- 数据导入导出
- 私有文献与媒体资料库（扫描件、照片、PDF、人物/事件关联）

目前更适合定位为：
- **AI 产品原型**
- **垂直场景智能应用**
- **可持续迭代的 MVP 开源项目**


## 开发与质量

### 环境前提

- Node.js >= 20
- PostgreSQL（通过 `DATABASE_URL` 环境变量配置）
- 首次运行前执行 `npx prisma migrate deploy` 初始化数据库

### 文献与媒体存储

- `FILE_STORAGE_ROOT`：私有文件根目录，必须位于 `public/` 之外；开发环境默认 `.data/materials`。
- 生产环境必须显式配置 `FILE_STORAGE_ROOT` 为持久卷或持久文件系统路径；临时/serverless 文件系统不受支持。
- `FILE_MAX_BYTES`：单文件最大字节数，默认 `20971520`（20 MiB）。
- `MATERIAL_MAX_FILES`：单条资料最多文件数，默认 `50`。
- 支持 PDF、JPEG、PNG、WebP 与 TIFF；服务端会校验文件签名、声明类型、大小和 SHA-256。
- 导出默认生成 V2 ZIP 交换包，包含 JSON 清单与 `files/` 载荷；仍支持导入旧版 V1 JSON 备份。
- 文件下载始终经过家谱授权接口，不应把存储目录映射为静态公开路径。

### 质量检查命令

| 命令 | 用途 |
|------|------|
| `npm run lint` | ESLint 静态检查 |
| `npm run typecheck` | TypeScript 类型检查 |
| `npm test` | 自动化测试（Node 原生测试运行器） |
| `npm run build` | 生产构建 |
| `npm run quality` | 统一质量门禁：依次执行 lint → typecheck → test → build |

质量门禁规则：任一步骤失败即返回非零退出码。CI 环境应调用 `npm run quality` 作为唯一验收入口。

### 工程约束

- **零 warning 基线**：`npm run lint` 必须零错误零警告，不允许使用全局限规则关闭或批量忽略
- **类型安全**：禁止在服务层使用 `any`，必须使用 Prisma 生成类型或领域类型
- **React 状态初始化**：读取 `localStorage` 等客户端 API 的状态必须使用 `useState` 惰性初始化器，避免在 `useEffect` 中同步 `setState`
- **Next.js 版本**：本项目使用 Next.js 16，编写代码前请阅读 `node_modules/next/dist/docs/` 中的相关指南

## 后续可以继续增强的方向

详细规划参见 [V1.2–V1.4 产品路线图](./docs/product-roadmap-v1.2-v1.4.md)。

- OCR / 图片识别接入
- GEDCOM 标准导入导出
- 多家族 / 多组织协作
- 家谱版本历史
- 更完整的文献、祠堂、相册模块
- 部署演示站与公开视频 Demo

## License

本项目使用 [MIT License](./LICENSE)。
