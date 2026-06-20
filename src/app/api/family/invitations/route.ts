import { createFamilyInvitation } from "@/services/family-membership.service";
import { toFamilyHttpError } from "@/lib/family-access/http-error";

export async function POST(request: Request) {
  try {
    return Response.json(await createFamilyInvitation(await request.json()), { status: 201 });
  } catch (error) {
    const result = toFamilyHttpError(error);
    return Response.json({ error: result.message }, { status: result.status });
  }
}

