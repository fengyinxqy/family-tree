import assert from "node:assert/strict";
import test from "node:test";
import { PublishConflictError, assertDependenciesUnchanged, assertTargetUnchanged } from "./publish-conflicts";

test("目标版本未变化时允许无关家族修订继续发布", () => {
  const timestamp = new Date("2026-06-20T12:00:00.000Z");
  assert.doesNotThrow(() => assertTargetUnchanged(timestamp, new Date(timestamp)));
});

test("同一目标变化时返回结构化冲突", () => {
  assert.throws(
    () => assertTargetUnchanged(new Date("2026-06-20T12:00:00.000Z"), new Date("2026-06-20T12:01:00.000Z")),
    (error) => error instanceof PublishConflictError && error.code === "STALE_TARGET",
  );
});

test("关系等全图依赖内容拒绝过期家族版本", () => {
  assert.doesNotThrow(() => assertDependenciesUnchanged(3, 3));
  assert.throws(() => assertDependenciesUnchanged(3, 4), (error) => error instanceof PublishConflictError && error.code === "STALE_DEPENDENCIES");
});

