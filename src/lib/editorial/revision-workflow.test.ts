import assert from "node:assert/strict";
import test from "node:test";
import {
  RevisionWorkflowError,
  assertRevisionPayloadMutable,
  assertRevisionTransition,
  validateReviewDecision,
} from "./revision-workflow";

test("仅允许规格定义的修订状态迁移", () => {
  assert.doesNotThrow(() => assertRevisionTransition("DRAFT", "IN_REVIEW"));
  assert.doesNotThrow(() => assertRevisionTransition("IN_REVIEW", "APPROVED"));
  assert.doesNotThrow(() => assertRevisionTransition("IN_REVIEW", "CHANGES_REQUESTED"));
  assert.doesNotThrow(() => assertRevisionTransition("APPROVED", "PUBLISHED"));
  assert.throws(() => assertRevisionTransition("DRAFT", "PUBLISHED"), RevisionWorkflowError);
  assert.throws(() => assertRevisionTransition("PUBLISHED", "IN_REVIEW"), RevisionWorkflowError);
});

test("提交后的修订 payload 不可原地编辑", () => {
  assert.doesNotThrow(() => assertRevisionPayloadMutable("DRAFT"));
  for (const status of ["IN_REVIEW", "CHANGES_REQUESTED", "APPROVED", "PUBLISHED"] as const) {
    assert.throws(() => assertRevisionPayloadMutable(status), (error) => error instanceof RevisionWorkflowError && error.code === "IMMUTABLE_REVISION");
  }
});

test("退回必须有意见且普通审校者不能自审", () => {
  assert.throws(
    () => validateReviewDecision({ decision: "CHANGES_REQUESTED", reviewerId: "r1", authorId: "a1", reviewerRole: "REVIEWER" }),
    (error) => error instanceof RevisionWorkflowError && error.code === "REVIEW_COMMENT_REQUIRED",
  );
  assert.throws(
    () => validateReviewDecision({ decision: "APPROVED", reviewerId: "same", authorId: "same", reviewerRole: "REVIEWER" }),
    (error) => error instanceof RevisionWorkflowError && error.code === "SELF_REVIEW",
  );
});

test("OWNER 或 ADMIN 自审必须记录覆盖原因", () => {
  assert.throws(
    () => validateReviewDecision({ decision: "APPROVED", reviewerId: "same", authorId: "same", reviewerRole: "OWNER" }),
    (error) => error instanceof RevisionWorkflowError && error.code === "OVERRIDE_REASON_REQUIRED",
  );
  assert.deepEqual(
    validateReviewDecision({ decision: "APPROVED", reviewerId: "same", authorId: "same", reviewerRole: "ADMIN", overrideReason: "紧急修复" }),
    { comment: null, overrideReason: "紧急修复" },
  );
});

