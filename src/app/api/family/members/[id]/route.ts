import {
  changeFamilyMemberRole,
  removeFamilyMember,
  setFamilyMemberStatus,
} from "@/services/family-membership.service";
import { toFamilyHttpError } from "@/lib/family-access/http-error";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const [{ id }, body] = await Promise.all([params, request.json()]);
    if (body.role) await changeFamilyMemberRole(id, body.role);
    else if (body.status) await setFamilyMemberStatus(id, body.status);
    else throw new Error("必须提供角色或成员状态");
    return Response.json({ success: true });
  } catch (error) {
    const result = toFamilyHttpError(error);
    return Response.json({ error: result.message }, { status: result.status });
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await removeFamilyMember(id);
    return new Response(null, { status: 204 });
  } catch (error) {
    const result = toFamilyHttpError(error);
    return Response.json({ error: result.message }, { status: result.status });
  }
}

