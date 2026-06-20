import { transferFamilyOwnership } from "@/services/family-membership.service";
import { toFamilyHttpError } from "@/lib/family-access/http-error";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    await transferFamilyOwnership(body.membershipId);
    return Response.json({ success: true });
  } catch (error) {
    const result = toFamilyHttpError(error);
    return Response.json({ error: result.message }, { status: result.status });
  }
}
