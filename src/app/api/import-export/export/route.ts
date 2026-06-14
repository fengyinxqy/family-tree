import { auth } from "@/lib/auth";
import { exportFamilyBackupForUser } from "@/services/import-export.service";
import { getActiveFamilyTreeForUser } from "@/services/family-tree-space.service";

function buildBackupFilename() {
  return `family-backup-${new Date().toISOString().slice(0, 10)}.json`;
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "未登录" }, { status: 401 });
  }

  const activeTree = await getActiveFamilyTreeForUser(session.user.id, session.user.name);
  const backup = await exportFamilyBackupForUser(session.user.id, activeTree.id);

  return new Response(JSON.stringify(backup, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${buildBackupFilename()}"`,
      "Cache-Control": "no-store",
    },
  });
}
