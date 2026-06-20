import { submitContentRevision } from "@/services/editorial-revision.service";
import { toFamilyHttpError } from "@/lib/family-access/http-error";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    return Response.json(await submitContentRevision(id));
  } catch (error) {
    const result = toFamilyHttpError(error);
    return Response.json({ error: result.message }, { status: result.status });
  }
}

