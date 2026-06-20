import { acceptFamilyInvitation } from "@/services/family-membership.service";
import { toFamilyHttpError } from "@/lib/family-access/http-error";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    return Response.json(await acceptFamilyInvitation(body.token));
  } catch (error) {
    const result = toFamilyHttpError(error);
    return Response.json({ error: result.message }, { status: result.status });
  }
}

