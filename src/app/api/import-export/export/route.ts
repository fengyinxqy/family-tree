import { auth } from "@/lib/auth";
import { exportFamilyExchangePackageForUser } from "@/services/exchange-package.service";
import { getActiveFamilyTreeForUser } from "@/services/family-tree-space.service";

function buildBackupFilename() {
  return `family-backup-${new Date().toISOString().slice(0, 10)}.zip`;
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "未登录" }, { status: 401 });
  }

  const activeTree = await getActiveFamilyTreeForUser(session.user.id, session.user.name);
  const backup = await exportFamilyExchangePackageForUser(session.user.id, activeTree.id);

  return new Response(backup, {
    status: 200,
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${buildBackupFilename()}"`,
      "Cache-Control": "no-store",
    },
  });
}
