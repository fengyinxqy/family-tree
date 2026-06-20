import { stageMediaRevisionUpload } from "@/services/staged-media.service";
import { toFamilyHttpError } from "@/lib/family-access/http-error";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) throw new Error("请选择要上传的文件");
    return Response.json(await stageMediaRevisionUpload(file), { status: 201 });
  } catch (error) {
    const result = toFamilyHttpError(error);
    return Response.json({ error: result.message }, { status: result.status });
  }
}

