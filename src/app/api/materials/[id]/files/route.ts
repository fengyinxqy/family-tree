import { reorderMaterialFiles } from "@/services/material.service";
import { stageMediaRevisionUpload } from "@/services/staged-media.service";
import { createContentDraft } from "@/services/editorial-revision.service";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) throw new Error("请选择文件");
    const materialId = (await params).id;
    const staged = await stageMediaRevisionUpload(file);
    return Response.json(await createContentDraft({
      contentType: "MEDIA_OBJECT",
      payload: { materialId, stagedObjectId: staged.id, originalName: staged.originalName, mimeType: staged.mimeType, byteSize: staged.byteSize, contentHash: staged.contentHash, displayOrder: 0 },
    }), { status: 202 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "上传失败";
    return Response.json({ error: message }, { status: message === "未登录" ? 401 : 400 });
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const input = await request.json() as { fileIds?: string[] };
    if (!Array.isArray(input.fileIds)) throw new Error("文件排序无效");
    return Response.json(await reorderMaterialFiles((await params).id, input.fileIds));
  } catch (error) {
    const message = error instanceof Error ? error.message : "排序失败";
    return Response.json({ error: message }, { status: message === "未登录" ? 401 : 400 });
  }
}
