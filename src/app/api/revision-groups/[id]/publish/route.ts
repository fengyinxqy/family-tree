import { toFamilyHttpError } from "@/lib/family-access/http-error";
import { publishRevisionGroup } from "@/services/revision-group.service";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    return Response.json(await publishRevisionGroup((await params).id));
  } catch (error) {
    const result = toFamilyHttpError(error);
    return Response.json({ error: result.message }, { status: result.status });
  }
}
