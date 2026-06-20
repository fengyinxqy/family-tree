import { createContentDraft, getRevisionWorkspace } from "@/services/editorial-revision.service";
import { toFamilyHttpError } from "@/lib/family-access/http-error";

export async function GET() {
  try {
    return Response.json(await getRevisionWorkspace());
  } catch (error) {
    const result = toFamilyHttpError(error);
    return Response.json({ error: result.message }, { status: result.status });
  }
}

export async function POST(request: Request) {
  try {
    return Response.json(await createContentDraft(await request.json()), { status: 201 });
  } catch (error) {
    const result = toFamilyHttpError(error);
    return Response.json({ error: result.message }, { status: result.status });
  }
}

