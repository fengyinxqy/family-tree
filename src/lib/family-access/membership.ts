import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import type { FamilyRole } from "./actions";

export const ASSIGNABLE_FAMILY_ROLES = ["ADMIN", "EDITOR", "REVIEWER", "VIEWER"] as const;

export const normalizedEmailSchema = z
  .string()
  .trim()
  .email("请输入有效邮箱地址")
  .max(320)
  .transform((email) => email.toLowerCase());

export const createFamilyInvitationSchema = z.object({
  email: normalizedEmailSchema,
  role: z.enum(ASSIGNABLE_FAMILY_ROLES),
  expiresInHours: z.coerce.number().int().min(1).max(24 * 30).default(72),
});

export const changeFamilyRoleSchema = z.object({
  role: z.enum(ASSIGNABLE_FAMILY_ROLES),
});

export function normalizeEmail(email: string): string {
  return normalizedEmailSchema.parse(email);
}

export function hashInvitationToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export function createInvitationToken(): { token: string; tokenHash: string } {
  const token = randomBytes(32).toString("base64url");
  return { token, tokenHash: hashInvitationToken(token) };
}

export function invitationTokenMatches(token: string, expectedHash: string): boolean {
  const actual = Buffer.from(hashInvitationToken(token), "hex");
  const expected = Buffer.from(expectedHash, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function isInvitationUsable(input: {
  status: "PENDING" | "ACCEPTED" | "REVOKED";
  expiresAt: Date;
  now?: Date;
}): boolean {
  return input.status === "PENDING" && input.expiresAt.getTime() > (input.now ?? new Date()).getTime();
}

export function assertMembershipRoleChangeAllowed(input: {
  actorRole: FamilyRole;
  targetRole: FamilyRole;
  nextRole: FamilyRole;
}): void {
  if (input.targetRole === "OWNER" || input.nextRole === "OWNER") {
    throw new Error("所有者角色只能通过所有权转移变更");
  }
  if (input.actorRole !== "OWNER" && input.actorRole !== "ADMIN") {
    throw new Error("无权管理家族成员角色");
  }
}

