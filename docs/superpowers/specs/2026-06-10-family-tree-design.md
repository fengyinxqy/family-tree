# 家谱系统设计文档

> 日期：2026-06-10 | 状态：已确认

## 一、项目概述

一个多家族通用的家谱管理 Web 平台。用户可以创建/加入家族，在家族内录入人物和关系信息，以交互式树形图浏览家谱。

### 核心定位

| 维度 | 决策 |
|------|------|
| 使用范围 | 多家族通用平台，每个家族数据隔离 |
| 访问方式 | Web 网页端为主 |
| 数据范围 | 基础信息（姓名、性别、生卒年月、配偶、子女） |
| 树形视图 | 纵向（自上而下）+ 横向（自左而右），可切换 |
| 数据录入 | 纯手工录入，不支持导入 |
| 权限模型 | 家族管理员制（管理员 / 编辑者 / 查看者） |

---

## 二、技术栈

| 层级 | 选型 | 说明 |
|------|------|------|
| 全栈框架 | Next.js 15 (App Router) | React Server Components + Server Actions |
| 语言 | TypeScript | 类型安全 |
| ORM | Prisma | 类型安全 DB 操作，自动 Migration |
| 数据库 | PostgreSQL 16 | 关系型数据库 |
| 认证 | NextAuth.js v5 | JWT 会话，邮箱密码登录 |
| 树形图 | React Flow | 交互式节点图，自定义节点和布局 |
| 样式 | Tailwind CSS | 原子化 CSS |
| UI 组件 | shadcn/ui | 可定制 React 组件库 |
| 表单验证 | Zod | TypeScript 优先的 Schema 验证 |

---

## 三、系统架构

```
展示层 (React Server Components + Client Components)
  ├── 家谱树视图  ├── 人物详情  ├── 管理后台  └── 仪表盘
        ↓
API 层 (Next.js API Routes / Server Actions)
  ├── REST API  ├── Server Actions  └── 中间件(鉴权)
        ↓
业务逻辑层 (Service Layer)
  ├── 家族管理  ├── 人物管理  ├── 关系管理  └── 权限控制
        ↓
数据层 (Prisma ORM + PostgreSQL)
```

### 关键架构决策

1. **多租户隔离**：所有业务表通过 `family_id` 外键隔离，中间件注入当前家族上下文
2. **家谱树渲染**：服务端加载数据，客户端 React Flow 渲染交互式树形图
3. **Server Actions 混合策略**：数据变更用 Server Actions，查询用 REST API 便于缓存

---

## 四、数据模型

### 核心表结构（5 张表）

**User（用户表）**
- `id`, `email`, `name`, `password_hash`, `created_at`

**Family（家族表）**
- `id`, `name`, `description`, `created_by` → User, `created_at`

**Person（人物表）⭐ 核心**
- `id`, `family_id` → Family, `name`, `gender`, `birth_date`, `death_date`, `bio`, `created_at`, `updated_at`

**Relationship（关系表）**
- `id`, `family_id` → Family, `type`（`spouse` / `child`）, `person_a` → Person, `person_b` → Person, `sort_order`, `created_at`

**FamilyMember（家族成员角色表）**
- `id`, `user_id` → User, `family_id` → Family, `role`（`admin` / `editor` / `viewer`）, `joined_at`

### 关系说明

- **配偶关系 (spouse)**：双向，person_a 和 person_b 互为配偶
- **子女关系 (child)**：单向，person_a 为父/母，person_b 为子女。结合配偶关系可推断双亲
- **排序**：子女之间通过 `sort_order` 控制长幼顺序；配偶按结婚时间排序

### 多租户隔离

每张业务表（Person、Relationship）带 `family_id` 外键。所有查询自动带 `WHERE family_id = ?` 条件，跨家族数据绝不泄漏。

---

## 五、功能模块与路由

### 路由结构

```
/                           首页 / 落地页
/login                      登录
/register                   注册
/dashboard                  个人仪表盘（我的家族列表）

/f/[familyId]               家族上下文入口
  ├── /tree                 家谱树视图 ⭐ 核心
  ├── /person/[id]          人物详情页
  ├── /person/new           新增人物
  ├── /members              家族成员管理（管理员）
  └── /settings             家族设置（管理员）
```

### 六大功能模块

1. **🌳 家谱树浏览（核心）**：交互式树形图，纵向/横向切换，缩放拖拽，点击节点展开详情，世代折叠/展开，搜索定位
2. **🧑 人物管理**：新增/编辑/删除人物，基本信息录入，添加配偶/子女
3. **🏠 家族管理**：创建/编辑家族，邀请成员，角色分配，删除成员
4. **🔐 用户认证**：邮箱注册/登录，JWT Session，密码加密，路由保护
5. **🔍 搜索导航**：家族内全局搜索人物，结果高亮定位到树节点，面包屑导航
6. **📊 个人仪表盘**：家族列表，快速切换，统计概览（人口数、世代数）

---

## 六、权限模型

### 三级角色矩阵

| 操作 | 👑 管理员 | ✏️ 编辑者 | 👁️ 查看者 |
|------|:--:|:--:|:--:|
| 浏览家谱树 | ✓ | ✓ | ✓ |
| 查看人物详情 | ✓ | ✓ | ✓ |
| 新增/编辑人物 | ✓ | ✓ | ✗ |
| 删除人物 | ✓ | ✗ | ✗ |
| 管理成员/角色 | ✓ | ✗ | ✗ |
| 修改家族设置 | ✓ | ✗ | ✗ |
| 删除家族 | ✓ | ✗ | ✗ |

### 执行流程

```
用户请求 → NextAuth 中间件（验证登录态）→ 家族上下文中间件（提取 familyId + 角色）
  → 权限守卫（角色-操作检查）→ API / 页面
```

### 关键决策

- **家族创建者即首位管理员**，不可被降级或移除
- **多层防护**：前端 UI 隐藏按钮 + API 层角色校验 + DB 查询 family_id 过滤
- **邀请制加入**：管理员生成邀请链接（带过期时间），新用户默认 `viewer`

---

## 七、部署方案

### Docker Compose 双容器

```
┌─────────────┐     ┌──────────────┐
│   nextjs    │────▶│  postgres    │
│  (port 3000)│     │  (port 5432) │
└─────────────┘     └──────────────┘
```

```bash
# 一键启动
docker compose up -d

# 数据库初始化
docker compose exec nextjs npx prisma migrate deploy
```

### 项目目录结构

```
family/
├── src/
│   ├── app/          # Next.js App Router 页面路由
│   ├── components/   # React 组件（UI + 业务）
│   ├── lib/          # 工具函数、Prisma 客户端、Auth 配置
│   ├── services/     # 业务逻辑层
│   └── types/        # TypeScript 类型定义
├── prisma/
│   └── schema.prisma # 数据模型定义
├── Dockerfile
├── docker-compose.yml
└── package.json
```

---

## 八、非功能需求

- **响应式设计**：适配桌面和移动端浏览器
- **性能**：家谱树初次加载 ≤ 2 秒（单家族 ≤ 500 人物节点）
- **安全**：密码 bcrypt 加密，JWT 过期策略，CSRF 防护，SQL 注入防护（Prisma 参数化查询）
- **数据完整性**：删除人物时级联处理关联关系，配偶关系双向一致性
