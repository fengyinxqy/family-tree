import { EmptyFeaturePanel, WorkspaceRouteShell } from "@/components/workspace-route-shell";

export default function AlbumsPage() {
  return (
    <WorkspaceRouteShell
      eyebrow="Albums"
      title="相册空间"
      description="后续这里会承接照片、影像与人物关联。这轮先把真实路由和页面空态建立起来。"
    >
      <EmptyFeaturePanel
        title="相册空间暂未启用"
        description="当前版本先专注于家谱结构、事件和助手工作流，相册能力会在后续版本接入。"
      />
    </WorkspaceRouteShell>
  );
}
