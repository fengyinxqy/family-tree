import { RevisionWorkspace } from "@/components/revision-workspace";
import { WorkspaceRouteShell } from "@/components/workspace-route-shell";
import { auth } from "@/lib/auth";
import { canPerformFamilyAction } from "@/lib/family-access/actions";
import { authorizeFamilyAction } from "@/services/family-authorization.service";
import { getCurrentFamilyTreeSpace } from "@/services/family-tree-space.service";
import { redirect } from "next/navigation";

export default async function ReviewsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const tree = await getCurrentFamilyTreeSpace();
  const membership = await authorizeFamilyAction(session.user.id, tree.id, "family.read.workspace");

  return (
    <WorkspaceRouteShell
      eyebrow="Collaboration"
      title="审校与发布"
      description="查看自己的草稿、处理待审修订，并保留每一次审校决定。正式数据只有在发布后才会改变。"
    >
      <RevisionWorkspace canReadReviewQueue={canPerformFamilyAction(membership.role, "review.read")} />
    </WorkspaceRouteShell>
  );
}
