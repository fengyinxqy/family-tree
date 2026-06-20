import { toFamilyHttpError } from "@/lib/family-access/http-error";
import { submitRevisionGroup } from "@/services/revision-group.service";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    return Response.json(await submitRevisionGroup((await params).id));
  } catch (error) {
    const result = toFamilyHttpError(error);
    return Response.json({ error: result.message }, { status: result.status });
  }
}
