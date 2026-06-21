import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  assertMembershipRoleChangeAllowed,
  assertInvitationAcceptanceAllowed,
  assertOwnershipTransferTarget,
  createFamilyInvitationSchema,
  createInvitationToken,
  hashInvitationToken,
  invitationTokenMatches,
  isInvitationUsable,
  normalizeEmail,
} from "./membership";

test("邀请输入规范化邮箱并拒绝 OWNER", () => {
  assert.equal(normalizeEmail("  Member@Example.COM "), "member@example.com");
  assert.equal(createFamilyInvitationSchema.parse({ email: "A@Example.com", role: "EDITOR" }).email, "a@example.com");
  assert.equal(createFamilyInvitationSchema.safeParse({ email: "a@example.com", role: "OWNER" }).success, false);
});

test("邀请令牌仅持久化不可逆哈希并可恒定时间校验", () => {
  const { token, tokenHash } = createInvitationToken();
  assert.notEqual(token, tokenHash);
  assert.equal(tokenHash, hashInvitationToken(token));
  assert.equal(invitationTokenMatches(token, tokenHash), true);
  assert.equal(invitationTokenMatches(`${token}x`, tokenHash), false);
});

test("过期、接受或撤销的邀请不可使用", () => {
  const now = new Date("2026-06-20T12:00:00.000Z");
  assert.equal(isInvitationUsable({ status: "PENDING", expiresAt: new Date("2026-06-20T13:00:00.000Z"), now }), true);
  assert.equal(isInvitationUsable({ status: "PENDING", expiresAt: now, now }), false);
  assert.equal(isInvitationUsable({ status: "ACCEPTED", expiresAt: new Date("2026-06-20T13:00:00.000Z"), now }), false);
  assert.equal(isInvitationUsable({ status: "REVOKED", expiresAt: new Date("2026-06-20T13:00:00.000Z"), now }), false);
});

test("邀请重放与错误邮箱均被拒绝", () => {
  const active = { status: "PENDING" as const, email: "member@example.com", expiresAt: new Date("2026-06-21T13:00:00.000Z") };
  assert.doesNotThrow(() => assertInvitationAcceptanceAllowed(active, "MEMBER@example.com", new Date("2026-06-21T12:00:00.000Z")));
  assert.throws(() => assertInvitationAcceptanceAllowed(active, "other@example.com", new Date("2026-06-21T12:00:00.000Z")));
  assert.throws(() => assertInvitationAcceptanceAllowed({ ...active, status: "ACCEPTED" }, active.email, new Date("2026-06-21T12:00:00.000Z")));
});

test("所有者不能通过普通角色变更被降级", () => {
  assert.throws(() => assertMembershipRoleChangeAllowed({ actorRole: "OWNER", targetRole: "OWNER", nextRole: "ADMIN" }));
  assert.throws(() => assertMembershipRoleChangeAllowed({ actorRole: "ADMIN", targetRole: "EDITOR", nextRole: "OWNER" }));
  assert.doesNotThrow(() => assertMembershipRoleChangeAllowed({ actorRole: "ADMIN", targetRole: "EDITOR", nextRole: "REVIEWER" }));
});

test("所有权转移只接受活跃非所有者，普通成员管理不能分配 OWNER", () => {
  assert.doesNotThrow(() => assertOwnershipTransferTarget({ role: "ADMIN", status: "ACTIVE" }));
  assert.throws(() => assertOwnershipTransferTarget({ role: "OWNER", status: "ACTIVE" }));
  assert.throws(() => assertOwnershipTransferTarget({ role: "EDITOR", status: "SUSPENDED" }));
  assert.equal(createFamilyInvitationSchema.safeParse({ email: "a@example.com", role: "OWNER" }).success, false);
});

test("迁移回填所有家族 OWNER 并建立唯一约束", async () => {
  const migration = await readFile(
    new URL("../../../prisma/migrations/20260620190000_add_family_membership_access_control/migration.sql", import.meta.url),
    "utf8",
  );
  assert.match(migration, /FROM "family_trees"/);
  assert.match(migration, /'OWNER'::"FamilyRole"/);
  assert.match(migration, /uq_family_memberships_tree_user/);
  assert.match(migration, /uq_family_memberships_active_owner/);
});
