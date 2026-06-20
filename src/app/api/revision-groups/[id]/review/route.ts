import { toFamilyHttpError } from "@/lib/family-access/http-error";
import { reviewRevisionGroup } from "@/services/revision-group.service";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const [{ id }, body] = await Promise.all([params, request.json()]);
    return Response.json(await reviewRevisionGroup(id, body));
  } catch (error) {
    const result = toFamilyHttpError(error);
    return Response.json({ error: result.message }, { status: result.status });
  }
}
