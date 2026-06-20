import { getFamilyMembershipOverview } from "@/services/family-membership.service";
import { toFamilyHttpError } from "@/lib/family-access/http-error";

export async function GET() {
  try {
    return Response.json(await getFamilyMembershipOverview());
  } catch (error) {
    const result = toFamilyHttpError(error);
    return Response.json({ error: result.message }, { status: result.status });
  }
}

