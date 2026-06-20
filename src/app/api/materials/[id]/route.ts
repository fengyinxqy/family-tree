import { deleteMaterial, getMaterial, previewMaterialDeletion } from "@/services/material.service";
import { createContentDraft } from "@/services/editorial-revision.service";

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
    const id = (await params).id;
    const [current, input] = await Promise.all([getMaterial(id), request.json()]);
    return Response.json(await createContentDraft({
      contentType: "SOURCE_MATERIAL",
      targetEntityId: id,
      payload: {
        title: input.title ?? current.title,
        category: input.category ?? current.category,
        source: input.source !== undefined ? input.source : current.source,
        eraLabel: input.eraLabel !== undefined ? input.eraLabel : current.eraLabel,
        contributor: input.contributor !== undefined ? input.contributor : current.contributor,
        description: input.description !== undefined ? input.description : current.description,
      },
    }), { status: 202 });
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
