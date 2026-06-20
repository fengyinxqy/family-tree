import { listMaterials } from "@/services/material.service";
import { createContentDraft } from "@/services/editorial-revision.service";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    return Response.json(await listMaterials({
      page: Number(url.searchParams.get("page")) || 1,
      pageSize: Number(url.searchParams.get("pageSize")) || 12,
      q: url.searchParams.get("q") ?? undefined,
      category: url.searchParams.get("category") ?? undefined,
    }));
  } catch (error) {
    const message = error instanceof Error ? error.message : "读取资料失败";
    return Response.json({ error: message }, { status: message === "未登录" ? 401 : 400 });
  }
}

export async function POST(request: Request) {
  try {
    return Response.json(await createContentDraft({ contentType: "SOURCE_MATERIAL", payload: await request.json() }), { status: 202 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "创建资料失败";
    return Response.json({ error: message }, { status: message === "未登录" ? 401 : 400 });
  }
}
