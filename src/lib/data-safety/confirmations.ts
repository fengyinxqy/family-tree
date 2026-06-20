import { createHash } from "crypto";
import type { PrismaClient } from "@prisma/client";
import { Prisma } from "@prisma/client";

type TxClient = Omit<
  PrismaClient,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends" | "user"
>;

const CONFIRMATION_TTL_MS = 5 * 60 * 1000; // 5分钟

export type ConfirmationKind =
  | "person_delete"
  | "relationship_delete"
  | "import"
  | "snapshot_restore"
  | "person_restore"
  | "relationship_restore"
  | "material_delete" | "content_withdrawal";

export interface CreateConfirmationParams {
  treeId: string;
  userId: string;
  kind: ConfirmationKind;
  input: unknown;
  revision: number;
  previewResult: Record<string, unknown>;
}

/**
 * 为破坏性操作创建短期一次性确认记录
 */
export async function createConfirmation(
  tx: TxClient,
  params: CreateConfirmationParams,
): Promise<string> {
  const inputHash = createHash("sha256")
    .update(JSON.stringify(params.input))
    .digest("hex");

  const confirmation = await tx.operationConfirmation.create({
    data: {
      treeId: params.treeId,
      userId: params.userId,
      kind: params.kind,
      inputHash,
      revision: params.revision,
      previewResult: params.previewResult as Prisma.InputJsonValue,
      consumed: false,
      expiresAt: new Date(Date.now() + CONFIRMATION_TTL_MS),
    },
  });

  return confirmation.id;
}

export interface ConsumeConfirmationParams {
  confirmationId: string;
  treeId: string;
  userId: string;
  kind: ConfirmationKind;
  input: unknown;
  currentRevision: number;
}

/**
 * 消耗一次性确认记录
 */
export async function consumeConfirmation(
  tx: TxClient,
  params: ConsumeConfirmationParams,
): Promise<Record<string, unknown>> {
  const confirmation = await tx.operationConfirmation.findUnique({
    where: { id: params.confirmationId },
  });

  if (!confirmation) {
    throw new Error("确认记录不存在");
  }

  if (confirmation.treeId !== params.treeId) {
    throw new Error("确认记录不属于当前家谱");
  }

  if (confirmation.userId !== params.userId) {
    throw new Error("确认记录不属于当前用户");
  }

  if (confirmation.kind !== params.kind) {
    throw new Error("确认类型不匹配");
  }

  if (confirmation.expiresAt < new Date()) {
    throw new Error("确认已过期，请重新预览");
  }

  if (confirmation.consumed) {
    throw new Error("确认已使用，请重新预览");
  }

  if (confirmation.revision !== params.currentRevision) {
    throw new Error(
      "数据已被修改，请重新预览 (确认修订: ${confirmation.revision}, 当前修订: ${params.currentRevision})",
    );
  }

  const inputHash = createHash("sha256")
    .update(JSON.stringify(params.input))
    .digest("hex");
  if (confirmation.inputHash !== inputHash) {
    throw new Error("输入与预览时不匹配，请重新预览");
  }

  await tx.operationConfirmation.update({
    where: { id: params.confirmationId },
    data: { consumed: true },
  });

  return confirmation.previewResult as Record<string, unknown>;
}

/**
 * 计算输入的SHA-256哈希
 */
export function hashInput(input: unknown): string {
  return createHash("sha256").update(JSON.stringify(input)).digest("hex");
}
