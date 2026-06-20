import { restoreMaterialDeletion } from "@/services/material.service";

export async function POST(_request: Request, { params }: { params: Promise<{ batchId: string }> }) {
  try {
    await restoreMaterialDeletion((await params).batchId);
    return Response.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "恢复失败";
    return Response.json({ error: message }, { status: message === "未登录" ? 401 : 400 });
  }
}
