import { WorkspaceRouteShell } from "@/components/workspace-route-shell";
import { SettingsClient } from "@/components/settings-client";
import { PublicationWithdrawalPanel } from "@/components/publication-withdrawal-panel";
import { FamilyMembersPanel } from "@/components/family-members-panel";
import { auth } from "@/lib/auth";
import { authorizeFamilyAction } from "@/services/family-authorization.service";
import { getCurrentFamilyTreeSpace } from "@/services/family-tree-space.service";

export default async function SettingsPage() {
  const session = await auth();
  const tree = await getCurrentFamilyTreeSpace();
  const membership = await authorizeFamilyAction(session!.user!.id!, tree.id, "family.read.published");
  const canWithdraw = membership.role === "OWNER" || membership.role === "ADMIN";

  return (
    <WorkspaceRouteShell
      eyebrow="Settings"
      title="工作台设置"
      description="这里集中放置家谱工作台的显示偏好，包括默认视图和助手展开状态。"
    >
      <SettingsClient canManageRecovery={membership.role === "OWNER"} />
      {canWithdraw && <PublicationWithdrawalPanel />}
      <FamilyMembersPanel />
    </WorkspaceRouteShell>
  );
}
