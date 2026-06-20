import assert from "node:assert/strict";
import test from "node:test";
import { validateMaterialLinkTargets } from "./validation";

const context = {
  treeId: "tree-a",
  people: [
    { id: "p1", treeId: "tree-a", deletedAt: null },
    { id: "p2", treeId: "tree-b", deletedAt: null },
    { id: "p3", treeId: "tree-a", deletedAt: new Date() },
  ],
  events: [
    { id: "e1", person: { treeId: "tree-a", deletedAt: null } },
    { id: "e2", person: { treeId: "tree-b", deletedAt: null } },
  ],
};

test("allows family-wide materials with no links", () => {
  assert.deepEqual(validateMaterialLinkTargets([], context), []);
});

test("accepts one active same-tree target per link", () => {
  assert.deepEqual(
    validateMaterialLinkTargets([{ personId: "p1" }, { personEventId: "e1" }], context),
    [
      { personId: "p1", personEventId: null },
      { personId: null, personEventId: "e1" },
    ],
  );
});

test("rejects duplicate, multi-target, deleted, missing, and cross-tree targets", () => {
  assert.throws(() => validateMaterialLinkTargets([{ personId: "p1" }, { personId: "p1" }], context));
  assert.throws(() => validateMaterialLinkTargets([{ personId: "p1", personEventId: "e1" }], context));
  assert.throws(() => validateMaterialLinkTargets([{ personId: "p3" }], context));
  assert.throws(() => validateMaterialLinkTargets([{ personId: "missing" }], context));
  assert.throws(() => validateMaterialLinkTargets([{ personEventId: "e2" }], context));
});
