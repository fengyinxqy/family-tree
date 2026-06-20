import { updateContentDraft } from "@/services/editorial-revision.service";
import { toFamilyHttpError } from "@/lib/family-access/http-error";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const [{ id }, body] = await Promise.all([params, request.json()]);
    return Response.json(await updateContentDraft(id, body.payload));
  } catch (error) {
    const result = toFamilyHttpError(error);
    return Response.json({ error: result.message }, { status: result.status });
  }
}

