import { ZodError } from "zod";
import { FamilyAccessError } from "./authorization-core";

export function toFamilyHttpError(error: unknown): { status: number; message: string } {
  if (error instanceof FamilyAccessError) return { status: error.status, message: error.message };
  if (error instanceof ZodError) return { status: 400, message: error.issues[0]?.message ?? "请求参数无效" };
  if (error instanceof SyntaxError) return { status: 400, message: "请求格式无效" };
  if (error instanceof Error) {
    if (error.message === "未登录") return { status: 401, message: error.message };
    return { status: 400, message: error.message };
  }
  return { status: 500, message: "服务器处理请求失败" };
}

