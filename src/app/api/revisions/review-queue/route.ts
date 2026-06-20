import { getReviewQueue } from "@/services/editorial-revision.service";
import { toFamilyHttpError } from "@/lib/family-access/http-error";

export async function GET() {
  try {
    return Response.json(await getReviewQueue());
  } catch (error) {
    const result = toFamilyHttpError(error);
    return Response.json({ error: result.message }, { status: result.status });
  }
}

