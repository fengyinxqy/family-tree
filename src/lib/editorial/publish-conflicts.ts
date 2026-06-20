export class PublishConflictError extends Error {
  constructor(
    public readonly code: "STALE_TARGET" | "STALE_DEPENDENCIES" | "REVISION_NOT_APPROVED",
    message: string,
    public readonly details: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = "PublishConflictError";
  }
}

export function assertTargetUnchanged(base: Date | null, current: Date | null) {
  if ((base?.getTime() ?? null) !== (current?.getTime() ?? null)) {
    throw new PublishConflictError("STALE_TARGET", "正式内容已发生变化，请基于最新版本派生新草稿");
  }
}

export function assertDependenciesUnchanged(baseFamilyRevision: number, currentFamilyRevision: number) {
  if (baseFamilyRevision !== currentFamilyRevision) {
    throw new PublishConflictError(
      "STALE_DEPENDENCIES",
      "修订依赖的家族数据已发生变化，请重新审校",
      { baseFamilyRevision, currentFamilyRevision },
    );
  }
}

