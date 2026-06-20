export const REVISION_STATUSES = ["DRAFT", "IN_REVIEW", "CHANGES_REQUESTED", "APPROVED", "PUBLISHED"] as const;
export type RevisionStatus = (typeof REVISION_STATUSES)[number];
export type ReviewDecision = "APPROVED" | "CHANGES_REQUESTED";

const ALLOWED_TRANSITIONS: Readonly<Record<RevisionStatus, ReadonlySet<RevisionStatus>>> = {
  DRAFT: new Set(["IN_REVIEW"]),
  IN_REVIEW: new Set(["APPROVED", "CHANGES_REQUESTED"]),
  CHANGES_REQUESTED: new Set(),
  APPROVED: new Set(["PUBLISHED", "CHANGES_REQUESTED"]),
  PUBLISHED: new Set(),
};

export class RevisionWorkflowError extends Error {
  constructor(public readonly code: "INVALID_TRANSITION" | "IMMUTABLE_REVISION" | "SELF_REVIEW" | "REVIEW_COMMENT_REQUIRED" | "OVERRIDE_REASON_REQUIRED", message: string) {
    super(message);
    this.name = "RevisionWorkflowError";
  }
}

export function assertRevisionTransition(from: RevisionStatus, to: RevisionStatus) {
  if (!ALLOWED_TRANSITIONS[from].has(to)) {
    throw new RevisionWorkflowError("INVALID_TRANSITION", `不允许将修订从 ${from} 变更为 ${to}`);
  }
}

export function assertRevisionPayloadMutable(status: RevisionStatus) {
  if (status !== "DRAFT") {
    throw new RevisionWorkflowError("IMMUTABLE_REVISION", "已提交、已审校或已发布的修订不可原地修改");
  }
}

export function validateReviewDecision(input: {
  decision: ReviewDecision;
  comment?: string | null;
  reviewerId: string;
  authorId: string;
  reviewerRole: "OWNER" | "ADMIN" | "EDITOR" | "REVIEWER" | "VIEWER";
  overrideReason?: string | null;
}) {
  const comment = input.comment?.trim() || null;
  const overrideReason = input.overrideReason?.trim() || null;
  if (input.decision === "CHANGES_REQUESTED" && !comment) {
    throw new RevisionWorkflowError("REVIEW_COMMENT_REQUIRED", "退回修订时必须填写可执行的审校意见");
  }
  if (input.reviewerId === input.authorId) {
    if (input.reviewerRole !== "OWNER" && input.reviewerRole !== "ADMIN") {
      throw new RevisionWorkflowError("SELF_REVIEW", "不能审校自己提交的修订");
    }
    if (!overrideReason) {
      throw new RevisionWorkflowError("OVERRIDE_REASON_REQUIRED", "紧急自审必须填写覆盖原因");
    }
  }
  return { comment, overrideReason };
}

