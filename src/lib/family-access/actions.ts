export const FAMILY_ROLES = ["OWNER", "ADMIN", "EDITOR", "REVIEWER", "VIEWER"] as const;

export type FamilyRole = (typeof FAMILY_ROLES)[number];

export const FAMILY_ACTIONS = [
  "family.read.published",
  "family.read.workspace",
  "family.update",
  "family.delete",
  "content.edit.direct",
  "content.delete",
  "content.withdraw",
  "file.manage",
  "export.read",
  "import.prepare",
  "import.execute",
  "membership.manage",
  "ownership.transfer",
  "revision.create",
  "revision.submit",
  "review.read",
  "review.decide",
  "publish.manage",
  "audit.read",
  "recovery.read",
  "recovery.manage",
] as const;

export type FamilyAction = (typeof FAMILY_ACTIONS)[number];

const ALL_ACTIONS = new Set<FamilyAction>(FAMILY_ACTIONS);

const ADMIN_ACTIONS = new Set<FamilyAction>([
  "family.read.published",
  "family.read.workspace",
  "family.update",
  "content.edit.direct",
  "content.delete",
  "content.withdraw",
  "file.manage",
  "export.read",
  "import.prepare",
  "import.execute",
  "membership.manage",
  "revision.create",
  "revision.submit",
  "review.read",
  "review.decide",
  "publish.manage",
]);

const EDITOR_ACTIONS = new Set<FamilyAction>([
  "family.read.published",
  "family.read.workspace",
  "content.edit.direct",
  "file.manage",
  "export.read",
  "import.prepare",
  "revision.create",
  "revision.submit",
]);

const REVIEWER_ACTIONS = new Set<FamilyAction>([
  "family.read.published",
  "family.read.workspace",
  "export.read",
  "review.read",
  "review.decide",
]);

const VIEWER_ACTIONS = new Set<FamilyAction>(["family.read.published", "export.read"]);

const ROLE_ACTIONS: Readonly<Record<FamilyRole, ReadonlySet<FamilyAction>>> = {
  OWNER: ALL_ACTIONS,
  ADMIN: ADMIN_ACTIONS,
  EDITOR: EDITOR_ACTIONS,
  REVIEWER: REVIEWER_ACTIONS,
  VIEWER: VIEWER_ACTIONS,
};

export const OWNER_ONLY_ACTIONS = new Set<FamilyAction>([
  "family.delete",
  "ownership.transfer",
  "audit.read",
  "recovery.read",
  "recovery.manage",
]);

export function canPerformFamilyAction(role: FamilyRole, action: FamilyAction): boolean {
  return ROLE_ACTIONS[role].has(action);
}

export function getFamilyActionsForRole(role: FamilyRole): readonly FamilyAction[] {
  return FAMILY_ACTIONS.filter((action) => canPerformFamilyAction(role, action));
}

export function isOwnerOnlyAction(action: FamilyAction): boolean {
  return OWNER_ONLY_ACTIONS.has(action);
}
