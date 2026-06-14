import { WorkspaceRouteShell } from "@/components/workspace-route-shell";
import { SettingsClient } from "@/components/settings-client";

export default function SettingsPage() {
  return (
    <WorkspaceRouteShell
      eyebrow="Settings"
      title="工作台设置"
      description="这里集中放置家谱工作台的显示偏好，包括默认视图和助手展开状态。"
    >
      <SettingsClient />
    </WorkspaceRouteShell>
  );
}
