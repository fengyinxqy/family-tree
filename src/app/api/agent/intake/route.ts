import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { runIntakeAgent, runIntakeContinuation } from "@/lib/agent/intake-agent";
import { intakeRouteRequestSchema } from "@/lib/agent/schemas";
import { getActiveFamilyTreeForUser } from "@/services/family-tree-space.service";

/**
 * POST /api/agent/intake
 *
 * 家谱录入 Agent —— 支持两种模式：
 *
 * ## 首次录入模式（向后兼容）
 * 请求体仅含 `text` 字段：
 * ```json
 * { "text": "我叫王明，父亲王建国..." }
 * ```
 * 返回完整的 IntakeDraft（含人物、关系、歧义项）。
 *
 * ## 续写模式（v1.1 新增）
 * 请求体包含 `text`、`previousDraft` 和 `clarificationText` 三个字段：
 * ```json
 * {
 *   "text": "原始口述文本",
 *   "previousDraft": { ...前轮 IntakeDraft ... },
 *   "clarificationText": "补充一句话来澄清歧义"
 * }
 * ```
 * 系统基于前轮草稿和用户补充文本，通过 LLM 增量提取 + 字段级合并
 * 返回更新后的完整 IntakeDraft。
 *
 * 续写模式下的合并规则：
 * - 已确认复用（action=reuse）的人物保持不变
 * - 待创建（action=create）的人物允许补全 gender/birthDate/deathDate 等字段
 * - 此前因 missing_reference 跳过的关系，若引用补全则恢复为 create
 * - 已解决的歧义移除，新歧义追加
 * - 最多支持 5 轮澄清（由前端限制）
 */
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  try {
    const body = intakeRouteRequestSchema.parse(await request.json());
    const activeTree = await getActiveFamilyTreeForUser(session.user.id, session.user.name);

    // 续写模式：同时存在 previousDraft 和 clarificationText 时，执行增量合并
    if (body.previousDraft && body.clarificationText) {
      const draft = await runIntakeContinuation(
        session.user.id,
        activeTree.id,
        body.text,
        body.previousDraft,
        body.clarificationText,
      );
      return NextResponse.json(draft);
    }

    // 首次录入模式（向后兼容）
    const draft = await runIntakeAgent(session.user.id, activeTree.id, body.text);
    return NextResponse.json(draft);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Intake agent failed.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
