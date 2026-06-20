import { toFamilyHttpError } from "@/lib/family-access/http-error";
import { getRevisionGroupReviewQueue } from "@/services/revision-group.service";

export async function GET() {
  try {
    return Response.json(await getRevisionGroupReviewQueue());
  } catch (error) {
    const result = toFamilyHttpError(error);
    return Response.json({ error: result.message }, { status: result.status });
  }
}
