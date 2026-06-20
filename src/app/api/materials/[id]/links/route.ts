import { replaceMaterialLinks } from "@/services/material.service";

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const input = await request.json() as { targets?: Array<{ personId?: string | null; personEventId?: string | null }> };
    if (!Array.isArray(input.targets)) throw new Error("资料关联无效");
    return Response.json(await replaceMaterialLinks((await params).id, input.targets));
  } catch (error) {
    const message = error instanceof Error ? error.message : "更新关联失败";
    return Response.json({ error: message }, { status: message === "未登录" ? 401 : 400 });
  }
}
