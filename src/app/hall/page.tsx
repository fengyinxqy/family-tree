import { EmptyFeaturePanel, WorkspaceRouteShell } from "@/components/workspace-route-shell";

export default function HallPage() {
  return (
    <WorkspaceRouteShell
      eyebrow="Hall"
      title="祠堂"
      description="这是面向家族文化展示的入口。当前先以产品骨架承接，后续再补纪念内容与家族叙事。"
    >
      <EmptyFeaturePanel
        title="祠堂页面正在筹备"
        description="这里会逐步承接家族介绍、纪念内容和展示型信息，但这一轮暂不引入新的数据模型。"
      />
    </WorkspaceRouteShell>
  );
}
