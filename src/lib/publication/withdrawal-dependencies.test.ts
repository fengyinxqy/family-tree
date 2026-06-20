import assert from "node:assert/strict";
import test from "node:test";
import { computeWithdrawalDependencies } from "./withdrawal-dependencies";

function mockTx(overrides: any = {}): any {
  return {
    relationship: { findMany: async () => [] },
    materialLink: { findMany: async () => [] },
    mediaObject: { findMany: async () => [] },
    personEvent: { findMany: async () => [] },
    person: { findMany: async () => [], findFirst: async () => null },
    ...overrides,
  };
}

const TREE_ID = "tree-1";

void test("关系撤回：无依赖时不阻止", async () => {
  const plan = await computeWithdrawalDependencies(mockTx(), TREE_ID, "RELATIONSHIP", "rel-1");
  assert.equal(plan.canWithdraw, true);
  assert.equal(plan.blockers.length, 0);
  assert.equal(plan.affectedEntityCount, 1);
});

void test("人员撤回：有活跃关系时阻止", async () => {
  const plan = await computeWithdrawalDependencies(
    mockTx({ relationship: { findMany: async () => [{ id: "rel-1", type: "spouse" }] } }),
    TREE_ID, "PERSON", "person-1"
  );
  assert.equal(plan.canWithdraw, false);
  assert.equal(plan.blockers.length, 1);
  assert.ok(plan.blockers[0].includes("活跃关系"));
});

void test("人员撤回：无活跃关系时允许", async () => {
  const plan = await computeWithdrawalDependencies(mockTx(), TREE_ID, "PERSON", "person-1");
  assert.equal(plan.canWithdraw, true);
});

void test("资料撤回：有活跃媒体文件时阻止", async () => {
  const plan = await computeWithdrawalDependencies(
    mockTx({ mediaObject: { findMany: async () => [{ id: "media-1", originalName: "photo.jpg" }] } }),
    TREE_ID, "SOURCE_MATERIAL", "mat-1"
  );
  assert.equal(plan.canWithdraw, false);
  assert.ok(plan.blockers[0].includes("活跃媒体"));
});

void test("媒体对象撤回：无依赖时允许", async () => {
  const plan = await computeWithdrawalDependencies(mockTx(), TREE_ID, "MEDIA_OBJECT", "media-1");
  assert.equal(plan.canWithdraw, true);
});

void test("人物事件撤回：无依赖时允许", async () => {
  const plan = await computeWithdrawalDependencies(mockTx(), TREE_ID, "PERSON_EVENT", "event-1");
  assert.equal(plan.canWithdraw, true);
});