import { Suspense } from "react";
import { DocumentsClient } from "@/components/documents-client";
import { WorkspaceRouteShell } from "@/components/workspace-route-shell";
import { Skeleton } from "@/components/ui/skeleton";

export default function DocumentsPage() {
  return (
    <WorkspaceRouteShell
      eyebrow="Documents"
      title="文献与媒体"
      description="集中保存族谱扫描件、照片、证件与整理材料，并把每条档案关联回人物和事件。"
    >
      <Suspense fallback={<Skeleton className="h-72 w-full" />}>
        <DocumentsClient />
      </Suspense>
    </WorkspaceRouteShell>
  );
}
