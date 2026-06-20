import { toFamilyHttpError } from "@/lib/family-access/http-error";
import { previewWithdrawal, executeWithdrawal } from "@/services/publication-withdrawal.service";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (body.action === "preview") {
      return Response.json(await previewWithdrawal(body));
    } else if (body.action === "confirm") {
      return Response.json(await executeWithdrawal(body));
    } else {
      return Response.json({ error: "无效的操作类型，请使用 preview 或 confirm" }, { status: 400 });
    }
  } catch (error) {
    const result = toFamilyHttpError(error);
    return Response.json({ error: result.message }, { status: result.status });
  }
}
