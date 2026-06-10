# 家谱系统

家族族谱管理与可视化系统，基于 Next.js 构建。

## 技术栈

- **前端**: Next.js 16, React 19, Tailwind CSS 4, shadcn/ui
- **状态管理**: React Hook Form + Zod 验证
- **可视化**: @xyflow/react (族谱树形图)
- **认证**: NextAuth.js v5
- **数据库**: PostgreSQL 16 + Prisma 7
- **部署**: Docker / Vercel

## 快速开始

### 本地开发

```bash
# 1. 安装依赖
npm install

# 2. 配置环境变量（复制并编辑 .env）
cp .env.example .env

# 3. 启动 PostgreSQL（通过 Docker）
docker compose up -d postgres

# 4. 运行数据库迁移
npx prisma migrate dev --name init

# 5. 启动开发服务器
npm run dev
```

打开 [http://localhost:3000](http://localhost:3000) 访问系统。

### Docker 一键部署

```bash
# 使用初始化脚本（推荐）
bash scripts/setup.sh

# 或手动执行
docker compose up -d --build
```

## 项目结构

```
src/
  app/           # Next.js App Router 页面与 API 路由
  components/    # React 组件
  lib/           # 工具函数（Prisma 客户端、认证配置等）
  services/      # 业务逻辑服务层
  types/         # TypeScript 类型定义
prisma/          # 数据库 schema 与迁移文件
```

## 开发

```bash
# 类型检查
npx tsc --noEmit
```
