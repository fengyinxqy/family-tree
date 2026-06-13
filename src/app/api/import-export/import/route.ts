import { auth } from "@/lib/auth";
import { importFamilyBackupForUser } from "@/services/import-export.service";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "未登录" }, { status: 401 });
  }

  try {
    const payload = await request.json();
    const summary = await importFamilyBackupForUser(session.user.id, payload);

    return Response.json({
      ok: true,
      message: "家谱备份已成功恢复",
      summary,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "导入失败";
    return Response.json({ error: message }, { status: 400 });
  }
}
