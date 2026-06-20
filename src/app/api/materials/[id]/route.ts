import { deleteMaterial, getMaterial, previewMaterialDeletion, updateMaterial } from "@/services/material.service";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    return Response.json(await getMaterial((await params).id));
  } catch (error) {
    const message = error instanceof Error ? error.message : "资料不存在";
    return Response.json({ error: message }, { status: message === "未登录" ? 401 : 404 });
  }
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    return Response.json(await updateMaterial((await params).id, await request.json()));
  } catch (error) {
    const message = error instanceof Error ? error.message : "更新资料失败";
    return Response.json({ error: message }, { status: message === "未登录" ? 401 : 400 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const id = (await params).id;
    const input = await request.json().catch(() => ({})) as { confirmationId?: string };
    if (!input.confirmationId) return Response.json(await previewMaterialDeletion(id));
    await deleteMaterial(input.confirmationId, id);
    return Response.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "删除资料失败";
    return Response.json({ error: message }, { status: message === "未登录" ? 401 : 400 });
  }
}
