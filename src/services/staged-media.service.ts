"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { validateFileBytes } from "@/lib/materials/file-validation";
import { getObjectStorage } from "@/lib/storage/local-object-storage";
import { authorizeFamilyAction } from "@/services/family-authorization.service";
import { getActiveFamilyTreeForUser } from "@/services/family-tree-space.service";

export async function stageMediaRevisionUpload(file: File) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("未登录");
  const tree = await getActiveFamilyTreeForUser(session.user.id, session.user.name);
  await authorizeFamilyAction(session.user.id, tree.id, "file.manage");
  const bytes = new Uint8Array(await file.arrayBuffer());
  const metadata = validateFileBytes({ bytes, declaredMimeType: file.type, filename: file.name });
  const staged = await getObjectStorage().stage(bytes);
  try {
    const upload = await prisma.stagedMediaUpload.create({
      data: {
        treeId: tree.id,
        uploadedBy: session.user.id,
        temporaryKey: staged.temporaryKey,
        ...metadata,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });
    return { id: upload.id, ...metadata, expiresAt: upload.expiresAt.toISOString() };
  } catch (error) {
    await getObjectStorage().remove(staged.temporaryKey).catch(() => undefined);
    throw error;
  }
}

