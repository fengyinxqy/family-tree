import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { runUnifiedAgentStream } from "@/lib/agent/unified-agent";
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
 * 响应为 NDJSON 流：
 * - delta：助手文本增量
 * - metadata：草稿或关系结果，一次性返回
 * - done：流结束
 */
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  try {
    const userId = session.user.id;
    const userName = session.user.name;
    const body = chatRequestSchema.parse(await request.json());
    const activeTree = await getActiveFamilyTreeForUser(
      userId,
      userName,
    );

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const send = (event: Record<string, unknown>) => {
          controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
        };

        try {
          for await (const event of runUnifiedAgentStream(
            userId,
            activeTree.id,
            body.message,
          )) {
            send(event);
          }

          send({ type: "done" });
        } catch (error) {
          const message =
            error instanceof Error ? error.message : "Unified agent failed.";
          send({ type: "error", error: message });
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "application/x-ndjson; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unified agent failed.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
