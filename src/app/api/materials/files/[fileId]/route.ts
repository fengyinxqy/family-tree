import { Readable } from "node:stream";
import { getObjectStorage } from "@/lib/storage/local-object-storage";
import { deleteMaterialFile, getAuthorizedMediaObject } from "@/services/material.service";

export const runtime = "nodejs";

export async function GET(request: Request, { params }: { params: Promise<{ fileId: string }> }) {
  try {
    const file = await getAuthorizedMediaObject((await params).fileId);
    const stream = await getObjectStorage().open(file.storageKey);
    const disposition = new URL(request.url).searchParams.get("download") === "1" ? "attachment" : "inline";
    return new Response(Readable.toWeb(stream) as ReadableStream, {
      headers: {
        "Content-Type": file.mimeType,
        "Content-Length": String(file.byteSize),
        "Content-Disposition": `${disposition}; filename*=UTF-8''${encodeURIComponent(file.originalName)}`,
        "Cache-Control": "private, no-store, max-age=0",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return Response.json({ error: "文件不存在" }, { status: 404, headers: { "Cache-Control": "no-store" } });
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ fileId: string }> }) {
  try {
    await deleteMaterialFile((await params).fileId);
    return Response.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "删除文件失败";
    return Response.json(
      { error: message },
      { status: message === "未登录" ? 401 : 404, headers: { "Cache-Control": "no-store" } },
    );
  }
}
