import { createContentDraft } from "@/services/editorial-revision.service";

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const input = await request.json() as { targets?: Array<{ personId?: string | null; personEventId?: string | null }> };
    if (!Array.isArray(input.targets)) throw new Error("资料关联无效");
    const materialId = (await params).id;
    const revision = await createContentDraft({ contentType: "MATERIAL_LINK", payload: { materialId, targets: input.targets } });
    return Response.json(revision, { status: 202 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "更新关联失败";
    return Response.json({ error: message }, { status: message === "未登录" ? 401 : 400 });
  }
}
