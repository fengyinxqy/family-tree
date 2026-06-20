import assert from "node:assert/strict";
import test from "node:test";
import {
  FAMILY_ACTIONS,
  FAMILY_ROLES,
  canPerformFamilyAction,
  getFamilyActionsForRole,
  isOwnerOnlyAction,
} from "./actions";

test("OWNER 拥有全部家族动作", () => {
  assert.deepEqual(getFamilyActionsForRole("OWNER"), FAMILY_ACTIONS);
});

test("预设角色遵循协作权限矩阵", () => {
  assert.equal(canPerformFamilyAction("ADMIN", "membership.manage"), true);
  assert.equal(canPerformFamilyAction("ADMIN", "ownership.transfer"), false);
  assert.equal(canPerformFamilyAction("EDITOR", "revision.create"), true);
  assert.equal(canPerformFamilyAction("EDITOR", "review.decide"), false);
  assert.equal(canPerformFamilyAction("REVIEWER", "review.decide"), true);
  assert.equal(canPerformFamilyAction("REVIEWER", "revision.create"), false);
  assert.equal(canPerformFamilyAction("VIEWER", "family.read.published"), true);
  assert.equal(canPerformFamilyAction("VIEWER", "family.read.workspace"), false);
});

test("所有 owner-only 动作仅 OWNER 可执行", () => {
  for (const action of FAMILY_ACTIONS.filter(isOwnerOnlyAction)) {
    assert.equal(canPerformFamilyAction("OWNER", action), true);
    for (const role of FAMILY_ROLES.filter((candidate) => candidate !== "OWNER")) {
      assert.equal(canPerformFamilyAction(role, action), false, `${role} 不应执行 ${action}`);
    }
  }
});
