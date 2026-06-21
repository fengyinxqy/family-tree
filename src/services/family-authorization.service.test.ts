import assert from "node:assert/strict";
import test from "node:test";
import { FAMILY_ACTIONS, FAMILY_ROLES, canPerformFamilyAction, type FamilyRole } from "@/lib/family-access/actions";
import {
  FamilyAccessError,
  assertFamilyEntityScope,
  authorizeFamilyActionWithRepository,
  type FamilyMembershipRepository,
} from "@/lib/family-access/authorization-core";

function repositoryFor(role: FamilyRole, status: "ACTIVE" | "SUSPENDED" = "ACTIVE"): FamilyMembershipRepository {
  return {
    async findMembership({ userId, treeId }) {
      return { id: "membership-1", userId, treeId, role, status };
    },
  };
}

test("数据库授权结果与完整角色矩阵一致", async () => {
  for (const role of FAMILY_ROLES) {
    for (const action of FAMILY_ACTIONS) {
      const promise = authorizeFamilyActionWithRepository(repositoryFor(role), "user-1", "tree-1", action);
      if (canPerformFamilyAction(role, action)) {
        assert.equal((await promise).role, role);
      } else {
        await assert.rejects(promise, (error) => error instanceof FamilyAccessError && error.status === 403);
      }
    }
  }
});

test("停用或不存在的成员统一表现为不可发现", async () => {
  await assert.rejects(
    authorizeFamilyActionWithRepository(repositoryFor("EDITOR", "SUSPENDED"), "user-1", "tree-1", "revision.create"),
    (error) => error instanceof FamilyAccessError && error.code === "FAMILY_NOT_FOUND" && error.status === 404,
  );

  const missingRepository: FamilyMembershipRepository = { async findMembership() { return null; } };
  await assert.rejects(
    authorizeFamilyActionWithRepository(missingRepository, "user-1", "tree-2", "family.read.published"),
    (error) => error instanceof FamilyAccessError && error.code === "FAMILY_NOT_FOUND" && error.status === 404,
  );
});

test("实体作用域检查不泄露跨家族记录", () => {
  assert.doesNotThrow(() => assertFamilyEntityScope({ treeId: "tree-1" }, "tree-1"));
  assert.throws(
    () => assertFamilyEntityScope({ treeId: "tree-2" }, "tree-1"),
    (error) => error instanceof FamilyAccessError && error.status === 404,
  );
});

test("绕过客户端控件不能获得发布权限，停用在下一请求立即生效", async () => {
  await assert.rejects(
    authorizeFamilyActionWithRepository(repositoryFor("VIEWER"), "viewer-1", "tree-1", "publish.manage"),
    (error) => error instanceof FamilyAccessError && error.status === 403,
  );

  let status: "ACTIVE" | "SUSPENDED" = "ACTIVE";
  const repository: FamilyMembershipRepository = {
    async findMembership({ userId, treeId }) {
      return { id: "membership-1", userId, treeId, role: "EDITOR", status };
    },
  };
  await authorizeFamilyActionWithRepository(repository, "editor-1", "tree-1", "revision.create");
  status = "SUSPENDED";
  await assert.rejects(
    authorizeFamilyActionWithRepository(repository, "editor-1", "tree-1", "revision.create"),
    (error) => error instanceof FamilyAccessError && error.status === 404,
  );
});

test("协作关键流程端到端角色矩阵保持一致", async () => {
  const scenarios = [
    { action: "membership.manage" as const, allowed: ["OWNER", "ADMIN"] },
    { action: "revision.create" as const, allowed: ["OWNER", "ADMIN", "EDITOR"] },
    { action: "review.decide" as const, allowed: ["OWNER", "ADMIN", "REVIEWER"] },
    { action: "publish.manage" as const, allowed: ["OWNER", "ADMIN"] },
    { action: "ownership.transfer" as const, allowed: ["OWNER"] },
    { action: "recovery.manage" as const, allowed: ["OWNER"] },
  ];
  for (const scenario of scenarios) {
    for (const role of FAMILY_ROLES) {
      const request = authorizeFamilyActionWithRepository(repositoryFor(role), `${role.toLowerCase()}-1`, "tree-1", scenario.action);
      if (scenario.allowed.includes(role)) assert.equal((await request).role, role);
      else await assert.rejects(request, (error) => error instanceof FamilyAccessError && error.status === 403);
    }
  }
});
