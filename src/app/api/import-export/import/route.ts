import { auth } from "@/lib/auth";
import { executeFamilyExchangeImport, previewFamilyExchangeImport } from "@/services/exchange-package.service";
import { getActiveFamilyTreeForUser } from "@/services/family-tree-space.service";
import { executeImport, previewImport } from "@/services/snapshot.service";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: "未登录" }, { status: 401 });
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const confirmationId = String(formData.get("confirmationId") || "") || null;
    if (!(file instanceof File)) throw new Error("请选择备份文件");
    const bytes = new Uint8Array(await file.arrayBuffer());
    const activeTree = await getActiveFamilyTreeForUser(session.user.id, session.user.name);

    if (file.name.toLowerCase().endsWith(".json") || file.type === "application/json") {
      const payload = JSON.parse(new TextDecoder().decode(bytes));
      return Response.json(confirmationId ? await executeImport(confirmationId, payload) : await previewImport(payload));
    }

    return Response.json(
      confirmationId
        ? await executeFamilyExchangeImport(session.user.id, activeTree.id, confirmationId, bytes)
        : await previewFamilyExchangeImport(session.user.id, activeTree.id, bytes),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "导入失败";
    return Response.json({ error: message }, { status: 400 });
  }
}
