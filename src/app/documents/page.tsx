import { EmptyFeaturePanel, WorkspaceRouteShell } from "@/components/workspace-route-shell";

export default function DocumentsPage() {
  return (
    <WorkspaceRouteShell
      eyebrow="Documents"
      title="文献空间"
      description="这页先作为真实产品入口存在，后续会承接族谱扫描件、文献摘录和资料引用。"
    >
      <EmptyFeaturePanel
        title="文献空间正在准备中"
        description="这轮先把产品骨架和家谱工作台搭起来，文献能力后续会接入真实资料条目与引用关系。"
      />
    </WorkspaceRouteShell>
  );
}
