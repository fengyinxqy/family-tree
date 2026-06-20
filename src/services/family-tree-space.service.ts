"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { authorizeFamilyAction } from "@/services/family-authorization.service";

const ACTIVE_TREE_COOKIE = "family.active_tree_id";

export interface FamilyTreeSpaceSummary {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
  personCount: number;
}

export interface ActiveFamilyTreeSpace {
  id: string;
  name: string;
  description: string | null;
}

function defaultTreeName(userName?: string | null) {
  return `${userName?.trim() || "我的"}家谱`;
}

async function requireUser() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  return {
    id: session.user.id,
    name: session.user.name,
  };
}

async function readActiveTreeCookie() {
  const cookieStore = await cookies();
  return cookieStore.get(ACTIVE_TREE_COOKIE)?.value ?? null;
}

async function writeActiveTreeCookie(treeId: string) {
  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_TREE_COOKIE, treeId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
}

export async function ensureDefaultFamilyTreeForUser(userId: string, userName?: string | null) {
  const existing = await prisma.familyTree.findFirst({
    where: { memberships: { some: { userId, status: "ACTIVE" } } },
    orderBy: { createdAt: "asc" },
  });

  if (existing) {
    return existing;
  }

  return prisma.familyTree.create({
    data: {
      name: defaultTreeName(userName),
      description: "默认家谱空间",
      ownerId: userId,
      memberships: { create: { userId, role: "OWNER" } },
    },
  });
}

export async function getActiveFamilyTreeForUser(userId: string, userName?: string | null): Promise<ActiveFamilyTreeSpace> {
  const activeTreeId = await readActiveTreeCookie();

  if (activeTreeId) {
    const active = await prisma.familyTree.findFirst({
      where: {
        id: activeTreeId,
        memberships: { some: { userId, status: "ACTIVE" } },
      },
    });

    if (active) {
      return {
        id: active.id,
        name: active.name,
        description: active.description,
      };
    }
  }

  const fallback = await ensureDefaultFamilyTreeForUser(userId, userName);
  return {
    id: fallback.id,
    name: fallback.name,
    description: fallback.description,
  };
}

export async function getCurrentFamilyTreeSpace(): Promise<ActiveFamilyTreeSpace> {
  const user = await requireUser();
  return getActiveFamilyTreeForUser(user.id, user.name);
}

export async function getFamilyTreeSpacesForCurrentUser(): Promise<FamilyTreeSpaceSummary[]> {
  const user = await requireUser();
  await ensureDefaultFamilyTreeForUser(user.id, user.name);

  const spaces = await prisma.familyTree.findMany({
    where: { memberships: { some: { userId: user.id, status: "ACTIVE" } } },
    include: {
      _count: {
        select: { persons: true },
      },
    },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  });

  return spaces.map((space) => ({
    id: space.id,
    name: space.name,
    description: space.description,
    createdAt: space.createdAt.toISOString(),
    personCount: space._count.persons,
  }));
}

export async function createFamilyTreeSpace(formData: FormData) {
  const user = await requireUser();
  const rawName = String(formData.get("name") ?? "").trim();
  const rawDescription = String(formData.get("description") ?? "").trim();

  if (rawName.length < 1) {
    throw new Error("请输入家谱名称");
  }

  const tree = await prisma.familyTree.create({
    data: {
      name: rawName.slice(0, 40),
      description: rawDescription ? rawDescription.slice(0, 120) : null,
      ownerId: user.id,
      memberships: { create: { userId: user.id, role: "OWNER" } },
    },
  });

  await writeActiveTreeCookie(tree.id);
  revalidatePath("/tree");
}

export async function switchFamilyTreeSpace(treeId: string) {
  const user = await requireUser();
  await authorizeFamilyAction(user.id, treeId, "family.read.published");
  const tree = await prisma.familyTree.findFirst({
    where: {
      id: treeId,
    },
    select: { id: true },
  });

  if (!tree) {
    throw new Error("家谱不存在");
  }

  await writeActiveTreeCookie(tree.id);
  revalidatePath("/tree");
}

export async function deleteFamilyTreeSpace(treeId: string) {
  const user = await requireUser();
  await authorizeFamilyAction(user.id, treeId, "family.delete");

  const tree = await prisma.familyTree.findFirst({
    where: {
      id: treeId,
    },
    select: { id: true },
  });

  if (!tree) {
    throw new Error("家谱不存在");
  }

  // 至少保留一个空间
  const count = await prisma.familyTree.count({
    where: { ownerId: user.id },
  });

  if (count <= 1) {
    throw new Error("至少需要保留一个家谱空间");
  }

  await prisma.familyTree.delete({
    where: { id: treeId },
  });

  // 如果删除的是当前活跃空间，清除 cookie 以便下次加载时自动选择
  const activeTreeId = await readActiveTreeCookie();
  if (activeTreeId === treeId) {
    const cookieStore = await cookies();
    cookieStore.delete(ACTIVE_TREE_COOKIE);
  }

  revalidatePath("/tree");
}
