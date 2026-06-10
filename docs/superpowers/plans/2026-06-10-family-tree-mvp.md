# 家谱系统 MVP 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 构建单人使用的家谱管理 MVP —— 录入人物和关系，以交互式树形图浏览。

**Architecture:** Next.js 15 全栈应用，Prisma + PostgreSQL 存储，React Flow 渲染家谱树。Server Actions 处理数据变更，REST API 提供查询。

**Tech Stack:** Next.js 15, TypeScript, Prisma, PostgreSQL, NextAuth.js v5, React Flow, Tailwind CSS, shadcn/ui, Zod, Docker

---

## 文件结构总览

```
family/
├── prisma/
│   └── schema.prisma
├── src/
│   ├── app/
│   │   ├── layout.tsx                    # 根布局
│   │   ├── page.tsx                      # 首页 → 重定向到 /tree
│   │   ├── login/page.tsx
│   │   ├── register/page.tsx
│   │   ├── tree/page.tsx                 # 家谱树页 ⭐
│   │   ├── person/[id]/page.tsx          # 人物详情
│   │   ├── person/new/page.tsx           # 新增人物
│   │   ├── person/[id]/edit/page.tsx     # 编辑人物
│   │   └── api/
│   │       ├── auth/[...nextauth]/route.ts
│   │       ├── persons/route.ts          # GET 列表 / POST 新增
│   │       ├── persons/[id]/route.ts     # GET/PUT/DELETE
│   │       └── relationships/route.ts    # POST 新增关系
│   ├── components/
│   │   ├── ui/                           # shadcn/ui 组件（自动生成）
│   │   ├── family-tree.tsx               # React Flow 树组件
│   │   ├── person-node.tsx               # 自定义人物节点
│   │   ├── person-card.tsx               # 人物详情卡片（侧边栏）
│   │   ├── person-form.tsx               # 人物表单（新增/编辑）
│   │   ├── relationship-form.tsx         # 关系表单
│   │   ├── login-form.tsx
│   │   └── header.tsx
│   ├── lib/
│   │   ├── prisma.ts                     # Prisma 客户端单例
│   │   ├── auth.ts                       # NextAuth 配置
│   │   └── utils.ts
│   ├── services/
│   │   ├── person.service.ts
│   │   └── relationship.service.ts
│   └── types/
│       └── index.ts
├── Dockerfile
├── docker-compose.yml
├── tailwind.config.ts
├── tsconfig.json
├── next.config.js
└── package.json
```

---

## Phase 1: 项目初始化

### Task 1: 创建 Next.js 项目

- [ ] **Step 1: 创建项目**

```bash
cd d:/programing/family
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --no-turbopack
```

- [ ] **Step 2: 安装核心依赖**

```bash
npm install prisma @prisma/client next-auth@beta @auth/prisma-adapter zod reactflow @xyflow/react
npm install -D @types/node
```

- [ ] **Step 3: 初始化 Prisma**

```bash
npx prisma init
```

- [ ] **Step 4: 初始化 shadcn/ui**

```bash
npx shadcn@latest init -d
npx shadcn@latest add button input label card dialog select form toast
```

- [ ] **Step 5: 验证项目能启动**

```bash
npm run dev
# 打开 http://localhost:3000，看到 Next.js 默认页面
```

---

## Phase 2: 数据层

### Task 2: 定义 Prisma Schema

**Files:** Create: `prisma/schema.prisma`

- [ ] **Step 1: 编写 Schema**

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id            String    @id @default(cuid())
  email         String    @unique
  name          String
  passwordHash  String
  createdAt     DateTime  @default(now()) @map("created_at")
  persons       Person[]

  @@map("users")
}

model Person {
  id          String    @id @default(cuid())
  name        String
  gender      String    // "male" | "female"
  birthDate   String?   @map("birth_date")
  deathDate   String?   @map("death_date")
  bio         String?
  createdAt   DateTime  @default(now()) @map("created_at")
  updatedAt   DateTime  @updatedAt @map("updated_at")
  createdBy   String    @map("created_by")
  creator     User      @relation(fields: [createdBy], references: [id])
  // 作为 person_a 的关系（配偶或作为父/母的子女关系）
  relationsA  Relationship[] @relation("PersonA")
  // 作为 person_b 的关系（作为子女的关系）
  relationsB  Relationship[] @relation("PersonB")

  @@map("persons")
}

model Relationship {
  id        String   @id @default(cuid())
  type      String   // "spouse" | "child"
  personAId String   @map("person_a_id")
  personBId String   @map("person_b_id")
  sortOrder Int      @default(0) @map("sort_order")
  createdAt DateTime @default(now()) @map("created_at")
  personA   Person   @relation("PersonA", fields: [personAId], references: [id], onDelete: Cascade)
  personB   Person   @relation("PersonB", fields: [personBId], references: [id], onDelete: Cascade)

  @@map("relationships")
}
```

- [ ] **Step 2: 配置环境变量**

创建 `.env`:
```env
DATABASE_URL="postgresql://family:family123@localhost:5432/familydb"
AUTH_SECRET="generate-a-random-secret-here"
```

- [ ] **Step 3: 创建 Prisma 客户端单例**

创建 `src/lib/prisma.ts`:
```typescript
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma = globalForPrisma.prisma || new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
```

---

## Phase 3: 用户认证

### Task 3: NextAuth 配置

**Files:** Create: `src/lib/auth.ts`, `src/app/api/auth/[...nextauth]/route.ts`

- [ ] **Step 1: 编写 NextAuth 配置**

`src/lib/auth.ts`:
```typescript
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { compare } from "bcrypt-ts";
import { prisma } from "./prisma";

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Credentials({
      credentials: {
        email: { label: "邮箱", type: "email" },
        password: { label: "密码", type: "password" },
      },
      async authorize(credentials) {
        const { email, password } = credentials as {
          email: string;
          password: string;
        };
        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) return null;
        const valid = await compare(password, user.passwordHash);
        if (!valid) return null;
        return { id: user.id, email: user.email, name: user.name };
      },
    }),
  ],
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
});
```

- [ ] **Step 2: 编写 API 路由处理**

`src/app/api/auth/[...nextauth]/route.ts`:
```typescript
import { handlers } from "@/lib/auth";
export const { GET, POST } = handlers;
```

- [ ] **Step 3: 安装 bcrypt-ts**

```bash
npm install bcrypt-ts
```

### Task 4: 注册页面

**Files:** Create: `src/app/register/page.tsx`, `src/components/register-form.tsx`

- [ ] **Step 1: 编写注册表单组件**

`src/components/register-form.tsx`:
```typescript
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function RegisterForm() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const formData = new FormData(e.currentTarget);
    const res = await fetch("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({
        name: formData.get("name"),
        email: formData.get("email"),
        password: formData.get("password"),
      }),
      headers: { "Content-Type": "application/json" },
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "注册失败");
      setLoading(false);
      return;
    }

    router.push("/login");
  }

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle className="text-center">注册</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">姓名</Label>
            <Input id="name" name="name" required placeholder="你的姓名" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">邮箱</Label>
            <Input id="email" name="email" type="email" required placeholder="your@email.com" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">密码</Label>
            <Input id="password" name="password" type="password" required minLength={6} placeholder="至少6位" />
          </div>
          {error && <p className="text-red-500 text-sm">{error}</p>}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "注册中..." : "注册"}
          </Button>
        </form>
        <p className="text-center text-sm mt-4 text-gray-500">
          已有账号？<a href="/login" className="text-blue-600 hover:underline">去登录</a>
        </p>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: 编写注册 API**

`src/app/api/auth/register/route.ts`:
```typescript
import { NextResponse } from "next/server";
import { hash } from "bcrypt-ts";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  const { name, email, password } = await request.json();

  if (!name || !email || !password) {
    return NextResponse.json({ error: "请填写所有字段" }, { status: 400 });
  }

  if (password.length < 6) {
    return NextResponse.json({ error: "密码至少6位" }, { status: 400 });
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ error: "该邮箱已注册" }, { status: 400 });
  }

  const passwordHash = await hash(password, 10);
  await prisma.user.create({
    data: { name, email, passwordHash },
  });

  return NextResponse.json({ success: true });
}
```

- [ ] **Step 3: 编写注册页面**

`src/app/register/page.tsx`:
```typescript
import { RegisterForm } from "@/components/register-form";

export default function RegisterPage() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <RegisterForm />
    </main>
  );
}
```

### Task 5: 登录页面

**Files:** Create: `src/app/login/page.tsx`, `src/components/login-form.tsx`

- [ ] **Step 1: 编写登录表单组件**

`src/components/login-form.tsx`:
```typescript
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function LoginForm() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const formData = new FormData(e.currentTarget);
    const result = await signIn("credentials", {
      email: formData.get("email"),
      password: formData.get("password"),
      redirect: false,
    });

    if (result?.error) {
      setError("邮箱或密码错误");
      setLoading(false);
      return;
    }

    router.push("/tree");
  }

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle className="text-center">登录</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">邮箱</Label>
            <Input id="email" name="email" type="email" required placeholder="your@email.com" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">密码</Label>
            <Input id="password" name="password" type="password" required placeholder="输入密码" />
          </div>
          {error && <p className="text-red-500 text-sm">{error}</p>}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "登录中..." : "登录"}
          </Button>
        </form>
        <p className="text-center text-sm mt-4 text-gray-500">
          没有账号？<a href="/register" className="text-blue-600 hover:underline">去注册</a>
        </p>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: 编写登录页面**

`src/app/login/page.tsx`:
```typescript
import { LoginForm } from "@/components/login-form";

export default function LoginPage() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <LoginForm />
    </main>
  );
}
```

### Task 6: 认证中间件

**Files:** Create: `src/middleware.ts`

- [ ] **Step 1: 编写中间件保护路由**

`src/middleware.ts`:
```typescript
export { auth as middleware } from "@/lib/auth";

export const config = {
  matcher: ["/tree/:path*", "/person/:path*", "/api/persons/:path*", "/api/relationships/:path*"],
};
```

---

## Phase 4: 人物管理

### Task 7: 类型定义

**Files:** Create: `src/types/index.ts`

- [ ] **Step 1: 定义共享类型**

`src/types/index.ts`:
```typescript
export interface PersonData {
  id: string;
  name: string;
  gender: "male" | "female";
  birthDate: string | null;
  deathDate: string | null;
  bio: string | null;
  createdAt: string;
}

export interface RelationshipData {
  id: string;
  type: "spouse" | "child";
  personAId: string;
  personBId: string;
  sortOrder: number;
}

// 家谱树节点（React Flow 用）
export interface TreeNode {
  id: string;
  type: "person";
  position: { x: number; y: number };
  data: PersonData & { spouseIds: string[]; childrenIds: string[]; parentIds: string[] };
}

// 家谱树连线
export interface TreeEdge {
  id: string;
  source: string;
  target: string;
  type: "spouse" | "parent-child";
}
```

### Task 8: Person Service

**Files:** Create: `src/services/person.service.ts`

- [ ] **Step 1: 编写人物服务层**

`src/services/person.service.ts`:
```typescript
"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export async function getPersons() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("未登录");

  return prisma.person.findMany({
    where: { createdBy: session.user.id },
    orderBy: { createdAt: "asc" },
  });
}

export async function getPerson(id: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("未登录");

  const person = await prisma.person.findUnique({
    where: { id },
    include: {
      relationsA: { include: { personB: true } },
      relationsB: { include: { personA: true } },
    },
  });

  if (!person || person.createdBy !== session.user.id) {
    throw new Error("人物不存在");
  }

  return { ...person, children: [] }; // TODO: extract relationships
}

export async function createPerson(data: {
  name: string;
  gender: string;
  birthDate?: string;
  deathDate?: string;
  bio?: string;
}) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("未登录");

  const person = await prisma.person.create({
    data: {
      ...data,
      createdBy: session.user.id,
    },
  });

  revalidatePath("/tree");
  return person;
}

export async function updatePerson(
  id: string,
  data: { name?: string; gender?: string; birthDate?: string; deathDate?: string; bio?: string }
) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("未登录");

  const person = await prisma.person.findUnique({ where: { id } });
  if (!person || person.createdBy !== session.user.id) throw new Error("无权操作");

  const updated = await prisma.person.update({ where: { id }, data });
  revalidatePath("/tree");
  return updated;
}

export async function deletePerson(id: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("未登录");

  const person = await prisma.person.findUnique({ where: { id } });
  if (!person || person.createdBy !== session.user.id) throw new Error("无权操作");

  // 删除此人的所有关系
  await prisma.relationship.deleteMany({
    where: { OR: [{ personAId: id }, { personBId: id }] },
  });

  await prisma.person.delete({ where: { id } });
  revalidatePath("/tree");
}
```

### Task 9: Person API Routes

**Files:** Create: `src/app/api/persons/route.ts`, `src/app/api/persons/[id]/route.ts`

- [ ] **Step 1: 人物列表 + 新增 API**

`src/app/api/persons/route.ts`:
```typescript
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const persons = await prisma.person.findMany({
    where: { createdBy: session.user.id },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json(persons);
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const body = await request.json();
  const person = await prisma.person.create({
    data: { ...body, createdBy: session.user.id },
  });

  return NextResponse.json(person, { status: 201 });
}
```

- [ ] **Step 2: 人物详情/更新/删除 API**

`src/app/api/persons/[id]/route.ts`:
```typescript
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const { id } = await params;
  const person = await prisma.person.findUnique({
    where: { id },
    include: {
      relationsA: { include: { personB: true } },
      relationsB: { include: { personA: true } },
    },
  });

  if (!person || person.createdBy !== session.user.id) {
    return NextResponse.json({ error: "不存在" }, { status: 404 });
  }

  return NextResponse.json(person);
}

export async function PUT(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const { id } = await params;
  const person = await prisma.person.findUnique({ where: { id } });
  if (!person || person.createdBy !== session.user.id) {
    return NextResponse.json({ error: "无权操作" }, { status: 403 });
  }

  const body = await request.json();
  const updated = await prisma.person.update({ where: { id }, data: body });
  return NextResponse.json(updated);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const { id } = await params;
  const person = await prisma.person.findUnique({ where: { id } });
  if (!person || person.createdBy !== session.user.id) {
    return NextResponse.json({ error: "无权操作" }, { status: 403 });
  }

  await prisma.relationship.deleteMany({
    where: { OR: [{ personAId: id }, { personBId: id }] },
  });
  await prisma.person.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
```

### Task 10: 人物表单组件

**Files:** Create: `src/components/person-form.tsx`

- [ ] **Step 1: 编写人物新增/编辑表单**

`src/components/person-form.tsx`:
```typescript
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { PersonData } from "@/types";

interface Props {
  open: boolean;
  onClose: () => void;
  person?: PersonData; // 编辑模式时传入
}

export function PersonForm({ open, onClose, person }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [gender, setGender] = useState(person?.gender || "male");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const body = {
      name: formData.get("name"),
      gender,
      birthDate: formData.get("birthDate") || null,
      deathDate: formData.get("deathDate") || null,
      bio: formData.get("bio") || null,
    };

    const url = person ? `/api/persons/${person.id}` : "/api/persons";
    const method = person ? "PUT" : "POST";

    const res = await fetch(url, {
      method,
      body: JSON.stringify(body),
      headers: { "Content-Type": "application/json" },
    });

    if (res.ok) {
      onClose();
      router.refresh();
    }
    setLoading(false);
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{person ? "编辑人物" : "新增人物"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="name">姓名 *</Label>
            <Input id="name" name="name" required defaultValue={person?.name} />
          </div>
          <div>
            <Label>性别 *</Label>
            <Select value={gender} onValueChange={setGender}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="male">男</SelectItem>
                <SelectItem value="female">女</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="birthDate">出生日期</Label>
              <Input id="birthDate" name="birthDate" placeholder="如 1900-01-01" defaultValue={person?.birthDate || ""} />
            </div>
            <div>
              <Label htmlFor="deathDate">逝世日期</Label>
              <Input id="deathDate" name="deathDate" placeholder="如 1980-12-31" defaultValue={person?.deathDate || ""} />
            </div>
          </div>
          <div>
            <Label htmlFor="bio">简介</Label>
            <Input id="bio" name="bio" defaultValue={person?.bio || ""} />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>取消</Button>
            <Button type="submit" disabled={loading}>
              {loading ? "保存中..." : "保存"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
```

### Task 11: 人物页面

**Files:** Create: `src/app/person/new/page.tsx`, `src/app/person/[id]/page.tsx`, `src/app/person/[id]/edit/page.tsx`

- [ ] **Step 1: 新增人物页**

`src/app/person/new/page.tsx`:
```typescript
"use client";

import { useState } from "react";
import { PersonForm } from "@/components/person-form";

export default function NewPersonPage() {
  const [open, setOpen] = useState(true);
  return <PersonForm open={open} onClose={() => window.history.back()} />;
}
```

- [ ] **Step 2: 人物详情页**

`src/app/person/[id]/page.tsx`:
```typescript
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DeletePersonButton } from "./delete-button";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function PersonDetailPage({ params }: Props) {
  const session = await auth();
  if (!session?.user?.id) return null;

  const { id } = await params;
  const person = await prisma.person.findUnique({
    where: { id },
    include: {
      relationsA: { include: { personB: true } },
      relationsB: { include: { personA: true } },
    },
  });

  if (!person || person.createdBy !== session.user.id) notFound();

  const spouses = person.relationsA
    .filter((r) => r.type === "spouse")
    .map((r) => r.personB);
  const children = person.relationsA
    .filter((r) => r.type === "child")
    .map((r) => r.personB);
  const parents = person.relationsB
    .filter((r) => r.type === "child")
    .map((r) => r.personA);

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <Link href="/tree" className="text-blue-600 hover:underline">← 返回家谱树</Link>
        <div className="flex gap-2">
          <Link href={`/person/${id}/edit`}>
            <Button variant="outline" size="sm">编辑</Button>
          </Link>
          <DeletePersonButton personId={id} personName={person.name} />
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">{person.name}</CardTitle>
          <p className="text-gray-500">
            {person.gender === "male" ? "男" : "女"}
            {person.birthDate && ` · 生于 ${person.birthDate}`}
            {person.deathDate && ` · 卒于 ${person.deathDate}`}
          </p>
        </CardHeader>
        {person.bio && (
          <CardContent>
            <p className="text-gray-700">{person.bio}</p>
          </CardContent>
        )}
      </Card>

      {spouses.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-lg">配偶</CardTitle></CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {spouses.map((s) => (
                <li key={s.id}>
                  <Link href={`/person/${s.id}`} className="text-blue-600 hover:underline">{s.name}</Link>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {parents.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-lg">父母</CardTitle></CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {parents.map((p) => (
                <li key={p.id}>
                  <Link href={`/person/${p.id}`} className="text-blue-600 hover:underline">{p.name}</Link>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {children.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-lg">子女</CardTitle></CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {children.map((c) => (
                <li key={c.id}>
                  <Link href={`/person/${c.id}`} className="text-blue-600 hover:underline">{c.name}</Link>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
```

- [ ] **Step 2b: 删除按钮（客户端组件）**

`src/app/person/[id]/delete-button.tsx`:
```typescript
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function DeletePersonButton({ personId, personName }: { personId: string; personName: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);

  async function handleDelete() {
    await fetch(`/api/persons/${personId}`, { method: "DELETE" });
    router.push("/tree");
    router.refresh();
  }

  if (!confirming) {
    return <Button variant="destructive" size="sm" onClick={() => setConfirming(true)}>删除</Button>;
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-red-600">确定删除「{personName}」？</span>
      <Button variant="destructive" size="sm" onClick={handleDelete}>确认</Button>
      <Button variant="outline" size="sm" onClick={() => setConfirming(false)}>取消</Button>
    </div>
  );
}
```

- [ ] **Step 3: 编辑人物页**

`src/app/person/[id]/edit/page.tsx`:
```typescript
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { EditPersonForm } from "./edit-form";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function EditPersonPage({ params }: Props) {
  const session = await auth();
  if (!session?.user?.id) return null;

  const { id } = await params;
  const person = await prisma.person.findUnique({ where: { id } });
  if (!person || person.createdBy !== session.user.id) notFound();

  return (
    <div className="max-w-md mx-auto p-6">
      <EditPersonForm person={person} />
    </div>
  );
}
```

`src/app/person/[id]/edit/edit-form.tsx`:
```typescript
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface PersonData {
  id: string;
  name: string;
  gender: string;
  birthDate: string | null;
  deathDate: string | null;
  bio: string | null;
}

export function EditPersonForm({ person }: { person: PersonData }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [gender, setGender] = useState(person.gender);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const formData = new FormData(e.currentTarget);

    await fetch(`/api/persons/${person.id}`, {
      method: "PUT",
      body: JSON.stringify({
        name: formData.get("name"),
        gender,
        birthDate: formData.get("birthDate") || null,
        deathDate: formData.get("deathDate") || null,
        bio: formData.get("bio") || null,
      }),
      headers: { "Content-Type": "application/json" },
    });

    router.push(`/person/${person.id}`);
    router.refresh();
  }

  return (
    <div>
      <Link href={`/person/${person.id}`} className="text-blue-600 hover:underline text-sm">← 返回</Link>
      <h1 className="text-2xl font-bold mt-4 mb-6">编辑人物</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <Label htmlFor="name">姓名 *</Label>
          <Input id="name" name="name" required defaultValue={person.name} />
        </div>
        <div>
          <Label>性别 *</Label>
          <Select value={gender} onValueChange={setGender}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="male">男</SelectItem>
              <SelectItem value="female">女</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="birthDate">出生日期</Label>
            <Input id="birthDate" name="birthDate" defaultValue={person.birthDate || ""} />
          </div>
          <div>
            <Label htmlFor="deathDate">逝世日期</Label>
            <Input id="deathDate" name="deathDate" defaultValue={person.deathDate || ""} />
          </div>
        </div>
        <div>
          <Label htmlFor="bio">简介</Label>
          <Input id="bio" name="bio" defaultValue={person.bio || ""} />
        </div>
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? "保存中..." : "保存"}
        </Button>
      </form>
    </div>
  );
}
```

---

## Phase 5: 关系管理

### Task 12: Relationship API + Service

**Files:** Create: `src/services/relationship.service.ts`, `src/app/api/relationships/route.ts`

- [ ] **Step 1: 关系服务**

`src/services/relationship.service.ts`:
```typescript
"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export async function createRelationship(data: {
  type: "spouse" | "child";
  personAId: string;
  personBId: string;
  sortOrder?: number;
}) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("未登录");

  // 验证两个人物都属于该用户
  const [a, b] = await Promise.all([
    prisma.person.findUnique({ where: { id: data.personAId } }),
    prisma.person.findUnique({ where: { id: data.personBId } }),
  ]);

  if (!a || !b || a.createdBy !== session.user.id || b.createdBy !== session.user.id) {
    throw new Error("无权操作");
  }

  // 配偶关系：双向添加
  if (data.type === "spouse") {
    const existing = await prisma.relationship.findFirst({
      where: {
        type: "spouse",
        OR: [
          { personAId: data.personAId, personBId: data.personBId },
          { personAId: data.personBId, personBId: data.personAId },
        ],
      },
    });
    if (existing) throw new Error("该配偶关系已存在");
  }

  const rel = await prisma.relationship.create({ data });
  revalidatePath("/tree");
  return rel;
}

export async function deleteRelationship(id: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("未登录");
  await prisma.relationship.delete({ where: { id } });
  revalidatePath("/tree");
}
```

- [ ] **Step 2: 关系 API**

`src/app/api/relationships/route.ts`:
```typescript
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const body = await request.json();
  const { type, personAId, personBId, sortOrder } = body;

  // 验证权限
  const [a, b] = await Promise.all([
    prisma.person.findUnique({ where: { id: personAId } }),
    prisma.person.findUnique({ where: { id: personBId } }),
  ]);

  if (!a || !b || a.createdBy !== session.user.id || b.createdBy !== session.user.id) {
    return NextResponse.json({ error: "无权操作" }, { status: 403 });
  }

  if (type === "spouse") {
    const existing = await prisma.relationship.findFirst({
      where: {
        type: "spouse",
        OR: [
          { personAId, personBId },
          { personAId: personBId, personBId: personAId },
        ],
      },
    });
    if (existing) return NextResponse.json({ error: "该配偶关系已存在" }, { status: 409 });
  }

  const rel = await prisma.relationship.create({
    data: { type, personAId, personBId, sortOrder: sortOrder || 0 },
  });

  return NextResponse.json(rel, { status: 201 });
}

export async function DELETE(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const { id } = await request.json();
  await prisma.relationship.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
```

### Task 13: 关系表单组件

**Files:** Create: `src/components/relationship-form.tsx`

- [ ] **Step 1: 关系表单（在人物详情页中使用）**

`src/components/relationship-form.tsx`:
```typescript
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { PersonData } from "@/types";

interface Props {
  open: boolean;
  onClose: () => void;
  currentPersonId: string;
}

export function RelationshipForm({ open, onClose, currentPersonId }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [persons, setPersons] = useState<PersonData[]>([]);
  const [relType, setRelType] = useState<"spouse" | "child">("spouse");
  const [targetId, setTargetId] = useState("");

  useEffect(() => {
    if (open) {
      fetch("/api/persons")
        .then((r) => r.json())
        .then((data) => setPersons(data.filter((p: PersonData) => p.id !== currentPersonId)));
    }
  }, [open, currentPersonId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!targetId) return;
    setLoading(true);

    let personAId: string, personBId: string;
    if (relType === "child") {
      personAId = currentPersonId; // 父/母
      personBId = targetId; // 子女
    } else {
      personAId = currentPersonId;
      personBId = targetId;
    }

    const res = await fetch("/api/relationships", {
      method: "POST",
      body: JSON.stringify({ type: relType, personAId, personBId }),
      headers: { "Content-Type": "application/json" },
    });

    if (res.ok) {
      onClose();
      router.refresh();
    }
    setLoading(false);
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>添加关系</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>关系类型</Label>
            <Select value={relType} onValueChange={(v) => setRelType(v as "spouse" | "child")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="spouse">配偶</SelectItem>
                <SelectItem value="child">子女</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>{relType === "spouse" ? "选择配偶" : "选择子女"}</Label>
            <Select value={targetId} onValueChange={setTargetId}>
              <SelectTrigger><SelectValue placeholder="选择人物..." /></SelectTrigger>
              <SelectContent>
                {persons.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name} ({p.gender === "male" ? "男" : "女"})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>取消</Button>
            <Button type="submit" disabled={loading || !targetId}>
              {loading ? "保存中..." : "保存"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
```

---

## Phase 6: 家谱树可视化 ⭐

### Task 14: 树布局算法

**Files:** Create: `src/lib/tree-layout.ts`

- [ ] **Step 1: 实现纵向和横向布局算法**

`src/lib/tree-layout.ts`:
```typescript
import type { PersonData, RelationshipData, TreeNode, TreeEdge } from "@/types";

const NODE_W = 180;
const NODE_H = 80;
const H_GAP = 60;  // 节点间水平间距
const V_GAP = 120; // 层级间垂直间距

interface LayoutResult {
  nodes: TreeNode[];
  edges: TreeEdge[];
}

// 从人物和关系数据构建邻接表
function buildGraph(persons: PersonData[], relationships: RelationshipData[]) {
  const spouseMap = new Map<string, string[]>(); // personId → [spouseIds]
  const childrenMap = new Map<string, string[]>(); // personId → [childIds]
  const parentMap = new Map<string, string[]>(); // personId → [parentIds]

  for (const p of persons) {
    spouseMap.set(p.id, []);
    childrenMap.set(p.id, []);
    parentMap.set(p.id, []);
  }

  for (const r of relationships) {
    if (r.type === "spouse") {
      spouseMap.get(r.personAId)?.push(r.personBId);
      spouseMap.get(r.personBId)?.push(r.personAId);
    } else if (r.type === "child") {
      childrenMap.get(r.personAId)?.push(r.personBId);
      parentMap.get(r.personBId)?.push(r.personAId);
    }
  }

  return { spouseMap, childrenMap, parentMap };
}

// 找到根节点（没有父母的人，优先选最早的）
function findRoots(persons: PersonData[], parentMap: Map<string, string[]>) {
  const roots = persons.filter((p) => !parentMap.get(p.id) || parentMap.get(p.id)!.length === 0);
  return roots.length > 0 ? roots : [persons[0]]; // 如果都有父母，取第一个人
}

// 纵向布局（自上而下）
export function layoutVertical(persons: PersonData[], relationships: RelationshipData[]): LayoutResult {
  const { spouseMap, childrenMap, parentMap } = buildGraph(persons, relationships);
  const personMap = new Map(persons.map((p) => [p.id, p]));

  const nodes: TreeNode[] = [];
  const edges: TreeEdge[] = [];
  const visited = new Set<string>();

  const roots = findRoots(persons, parentMap);

  // BFS 按层布局
  let currentLayer = [...roots];
  let y = 0;
  const layerMap = new Map<string, number>();

  while (currentLayer.length > 0) {
    const nextLayer: string[] = [];
    const spousesInLayer = new Set<string>();

    // 配偶放在同一层
    for (const root of currentLayer) {
      if (visited.has(root.id)) continue;
      visited.add(root.id);
      layerMap.set(root.id, y);

      const sps = spouseMap.get(root.id) || [];
      for (const sId of sps) {
        if (!visited.has(sId)) {
          visited.add(sId);
          layerMap.set(sId, y);
          spousesInLayer.add(sId);
        }
        edges.push({ id: `${root.id}-spouse-${sId}`, source: root.id, target: sId, type: "spouse" });
      }

      const children = childrenMap.get(root.id) || [];
      for (const cId of children) {
        if (!visited.has(cId)) nextLayer.push(persons.find((p) => p.id === cId)!);
        edges.push({ id: `${root.id}-child-${cId}`, source: root.id, target: cId, type: "parent-child" });
      }
    }

    // 布置当前层的 x 坐标
    const allInLayer = currentLayer.filter((r) => layerMap.get(r.id) === y);
    const totalWidth = allInLayer.length * (NODE_W + H_GAP) - H_GAP;
    let x = -totalWidth / 2;

    for (const root of allInLayer) {
      const person = personMap.get(root.id)!;
      nodes.push({
        id: root.id,
        type: "person",
        position: { x, y: y * (NODE_H + V_GAP) },
        data: {
          ...person,
          spouseIds: spouseMap.get(root.id) || [],
          childrenIds: childrenMap.get(root.id) || [],
          parentIds: parentMap.get(root.id) || [],
        },
      });
      x += NODE_W + H_GAP;
    }

    // 添加配偶节点
    for (const sId of spousesInLayer) {
      const person = personMap.get(sId)!;
      nodes.push({
        id: sId,
        type: "person",
        position: { x, y: y * (NODE_H + V_GAP) },
        data: {
          ...person,
          spouseIds: spouseMap.get(sId) || [],
          childrenIds: childrenMap.get(sId) || [],
          parentIds: parentMap.get(sId) || [],
        },
      });
      x += NODE_W + H_GAP;
    }

    y++;
    currentLayer = nextLayer.filter((p) => p !== undefined);
  }

  // 添加孤立节点（没有关系的）
  for (const p of persons) {
    if (!visited.has(p.id)) {
      nodes.push({
        id: p.id,
        type: "person",
        position: { x: nodes.length * (NODE_W + H_GAP), y: 0 },
        data: {
          ...p,
          spouseIds: spouseMap.get(p.id) || [],
          childrenIds: childrenMap.get(p.id) || [],
          parentIds: parentMap.get(p.id) || [],
        },
      });
      visited.add(p.id);
    }
  }

  return { nodes, edges };
}

// 横向布局（自左而右）—— 将纵向结果交换 x/y 轴
export function layoutHorizontal(persons: PersonData[], relationships: RelationshipData[]): LayoutResult {
  const result = layoutVertical(persons, relationships);
  return {
    nodes: result.nodes.map((n) => ({
      ...n,
      position: { x: n.position.y, y: n.position.x },
    })),
    edges: result.edges,
  };
}
```

### Task 15: 自定义人物节点

**Files:** Create: `src/components/person-node.tsx`

- [ ] **Step 1: React Flow 自定义节点**

`src/components/person-node.tsx`:
```typescript
"use client";

import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import type { PersonData } from "@/types";

type PersonNodeData = PersonData & {
  spouseIds: string[];
  childrenIds: string[];
  parentIds: string[];
};

function PersonNodeComponent({ data, selected }: NodeProps) {
  const d = data as unknown as PersonNodeData;
  const isMale = d.gender === "male";

  return (
    <div
      className={`
        relative px-4 py-3 rounded-lg border-2 shadow-sm cursor-pointer
        transition-all min-w-[150px]
        ${selected ? "ring-2 ring-blue-400 scale-105" : ""}
        ${isMale ? "border-blue-300 bg-blue-50" : "border-pink-300 bg-pink-50"}
      `}
    >
      <Handle type="target" position={Position.Top} className="!bg-gray-400" />
      <Handle type="source" position={Position.Bottom} className="!bg-gray-400" />
      <Handle type="source" position={Position.Left} id="left" className="!bg-gray-400" />
      <Handle type="target" position={Position.Right} id="right" className="!bg-gray-400" />

      <div className="text-center">
        <p className="font-bold text-sm">{d.name}</p>
        {d.birthDate && (
          <p className="text-xs text-gray-500">
            {d.birthDate}{d.deathDate ? ` - ${d.deathDate}` : ""}
          </p>
        )}
      </div>
    </div>
  );
}

export const PersonNode = memo(PersonNodeComponent);
```

### Task 16: 家谱树主组件

**Files:** Create: `src/components/family-tree.tsx`

- [ ] **Step 1: 家谱树核心组件**

`src/components/family-tree.tsx`:
```typescript
"use client";

import { useCallback, useMemo, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { PersonNode } from "./person-node";
import { PersonForm } from "./person-form";
import { Button } from "@/components/ui/button";
import { layoutVertical, layoutHorizontal } from "@/lib/tree-layout";
import type { PersonData, RelationshipData } from "@/types";

const nodeTypes = { person: PersonNode };

export function FamilyTree({
  persons: initialPersons,
  relationships: initialRelationships,
}: {
  persons: PersonData[];
  relationships: RelationshipData[];
}) {
  const router = useRouter();
  const [layout, setLayout] = useState<"vertical" | "horizontal">("vertical");
  const [showPersonForm, setShowPersonForm] = useState(false);
  const [persons] = useState(initialPersons);
  const [rels] = useState(initialRelationships);

  const layoutResult = useMemo(() => {
    if (persons.length === 0) return { nodes: [], edges: [] };
    return layout === "vertical"
      ? layoutVertical(persons, rels)
      : layoutHorizontal(persons, rels);
  }, [persons, rels, layout]);

  const [nodes, setNodes, onNodesChange] = useNodesState(
    layoutResult.nodes as unknown as Node[]
  );
  const [edges, setEdges, onEdgesChange] = useEdgesState(layoutResult.edges as unknown as Edge[]);

  useEffect(() => {
    setNodes(layoutResult.nodes as unknown as Node[]);
    setEdges(layoutResult.edges as unknown as Edge[]);
  }, [layoutResult, setNodes, setEdges]);

  const onNodeClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      router.push(`/person/${node.id}`);
    },
    [router]
  );

  return (
    <div className="w-full h-[calc(100vh-64px)] relative">
      {/* 工具栏 */}
      <div className="absolute top-4 left-4 z-10 flex gap-2">
        <Button size="sm" onClick={() => setShowPersonForm(true)}>
          + 新增人物
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setLayout(layout === "vertical" ? "horizontal" : "vertical")}
        >
          {layout === "vertical" ? "⇄ 横向" : "⇅ 纵向"}
        </Button>
      </div>

      {/* 家谱树 */}
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        nodeTypes={nodeTypes}
        fitView
        attributionPosition="bottom-left"
      >
        <Background />
        <Controls />
        <MiniMap
          nodeColor={(n) => {
            const d = n.data as any;
            return d?.gender === "male" ? "#bfdbfe" : "#fbcfe8";
          }}
        />
      </ReactFlow>

      {/* 弹窗 */}
      <PersonForm open={showPersonForm} onClose={() => setShowPersonForm(false)} />
    </div>
  );
}
```

### Task 17: 家谱树页面

**Files:** Create: `src/app/tree/page.tsx`, `src/app/layout.tsx`, `src/components/header.tsx`

- [ ] **Step 1: 页面头部**

`src/components/header.tsx`:
```typescript
import Link from "next/link";
import { auth, signOut } from "@/lib/auth";
import { Button } from "@/components/ui/button";

export async function Header() {
  const session = await auth();

  return (
    <header className="h-16 border-b bg-white flex items-center justify-between px-6">
      <Link href="/tree" className="text-xl font-bold text-gray-800">
        🌳 家谱
      </Link>
      {session?.user && (
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-600">{session.user.email}</span>
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/login" });
            }}
          >
            <Button variant="ghost" size="sm" type="submit">退出</Button>
          </form>
        </div>
      )}
    </header>
  );
}
```

- [ ] **Step 2: 根布局**

`src/app/layout.tsx`:
```typescript
import type { Metadata } from "next";
import { Header } from "@/components/header";
import "./globals.css";

export const metadata: Metadata = {
  title: "家谱系统",
  description: "家族信息管理平台",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body className="bg-gray-50 min-h-screen">
        <Header />
        {children}
      </body>
    </html>
  );
}
```

- [ ] **Step 3: 家谱树页面**

`src/app/tree/page.tsx`:
```typescript
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { FamilyTree } from "@/components/family-tree";

export default async function TreePage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const persons = await prisma.person.findMany({
    where: { createdBy: session.user.id },
    orderBy: { createdAt: "asc" },
  });

  const relationships = await prisma.relationship.findMany({
    where: {
      personA: { createdBy: session.user.id },
    },
  });

  const personData = persons.map((p) => ({
    id: p.id,
    name: p.name,
    gender: p.gender as "male" | "female",
    birthDate: p.birthDate,
    deathDate: p.deathDate,
    bio: p.bio,
    createdAt: p.createdAt.toISOString(),
  }));

  const relData = relationships.map((r) => ({
    id: r.id,
    type: r.type as "spouse" | "child",
    personAId: r.personAId,
    personBId: r.personBId,
    sortOrder: r.sortOrder,
  }));

  return (
    <FamilyTree persons={personData} relationships={relData} />
  );
}
```

- [ ] **Step 4: 首页重定向**

`src/app/page.tsx`:
```typescript
import { redirect } from "next/navigation";

export default function Home() {
  redirect("/tree");
}
```

---

## Phase 7: Docker 部署

### Task 18: Docker 配置

**Files:** Create: `Dockerfile`, `docker-compose.yml`, `.dockerignore`

- [ ] **Step 1: Dockerfile**

```dockerfile
# syntax=docker.io/docker/dockerfile:1
FROM node:20-alpine AS base

FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
RUN npm run build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
```

- [ ] **Step 2: docker-compose.yml**

```yaml
version: "3.9"

services:
  nextjs:
    build: .
    ports:
      - "3000:3000"
    environment:
      - DATABASE_URL=postgresql://family:family123@postgres:5432/familydb
      - AUTH_SECRET=${AUTH_SECRET:-supersecret-change-me}
    depends_on:
      postgres:
        condition: service_healthy

  postgres:
    image: postgres:16-alpine
    environment:
      - POSTGRES_USER=family
      - POSTGRES_PASSWORD=family123
      - POSTGRES_DB=familydb
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U family -d familydb"]
      interval: 5s
      timeout: 5s
      retries: 5

volumes:
  pgdata:
```

- [ ] **Step 3: .dockerignore**

```
node_modules
.next
.git
.env.local
```

- [ ] **Step 4: 修改 next.config.js 支持 Docker standalone**

`next.config.js`:
```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
};

module.exports = nextConfig;
```

---

## Phase 8: 数据库初始化 & 首次运行

### Task 19: 数据库迁移与启动

- [ ] **Step 1: 启动 PostgreSQL（Docker）**

```bash
docker compose up -d postgres
```

- [ ] **Step 2: 运行 Prisma 迁移**

```bash
npx prisma migrate dev --name init
```

- [ ] **Step 3: 完整启动**

```bash
docker compose up -d --build
# 打开 http://localhost:3000
# 注册 → 登录 → 新增人物 → 添加关系 → 查看家谱树
```
