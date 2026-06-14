import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { runUnifiedAgent } from "@/lib/agent/unified-agent";
import { getActiveFamilyTreeForUser } from "@/services/family-tree-space.service";

const chatRequestSchema = z.object({
  message: z.string().min(1, "message is required"),
});

/**
 * POST /api/agent/chat
 *
 * 统一 AI 助手入口 —— 根据用户输入自动调用对应工具：
 * - extract_family_data：提取人物和关系结构化数据
 * - query_relationship：查询两人之间的亲属关系路径
 * - analyze_person_gaps：分析人物资料缺口
 *
 * 请求示例：
 * ```json
 * { "message": "补充萧伟的生平、配偶和子女信息" }
 * ```
 *
 * 响应示例：
 * ```json
 * {
 *   "role": "assistant",
 *   "content": "已分析萧伟的资料缺口...",
 *   "draft": { ...IntakeDraft },
 *   "relationshipResult": null
 * }
 * ```
 */
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  try {
    const body = chatRequestSchema.parse(await request.json());
    const activeTree = await getActiveFamilyTreeForUser(
      session.user.id,
      session.user.name,
    );

    const result = await runUnifiedAgent(
      session.user.id,
      activeTree.id,
      body.message,
    );

    return NextResponse.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unified agent failed.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
