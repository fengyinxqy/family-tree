import { prisma } from "@/lib/prisma";
import { createChatCompletion, createChatCompletionStream } from "./openai";
import type { ChatCompletionStreamDelta, ChatMessage, ChatTool } from "./openai";
import { runIntakeAgent } from "./intake-agent";
import { runRelationshipAgent } from "./relationship-agent";
import { getUserGenealogyContext, toExistingPersonContext, findPersonsByName } from "./tools";
import type { IntakeDraft } from "./types";

// ─── Tool Definitions ───────────────────────────────────────────────

const TOOLS: ChatTool[] = [
  {
    type: "function",
    function: {
      name: "extract_family_data",
      description:
        "从用户的自然语言描述中提取人物和关系信息，生成结构化草稿。\n" +
        "使用场景：用户口述家谱信息，例如'张三，生于1960年，妻子李四，儿子张五'。\n" +
        "注意：此工具负责将文本转为结构化数据，不会直接写入数据库，需要用户确认。",
      parameters: {
        type: "object",
        properties: {
          text: {
            type: "string",
            description: "用户输入的家谱信息描述原文",
          },
        },
        required: ["text"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "query_relationship",
      description:
        "查询家谱中两个人之间的亲属关系路径。\n" +
        "使用场景：用户询问'XX和YY是什么关系？'、'YY是XX的什么人？'等问题。",
      parameters: {
        type: "object",
        properties: {
          question: {
            type: "string",
            description: "用户的关系查询问题原文",
          },
        },
        required: ["question"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "analyze_person_gaps",
      description:
        "分析指定人物在当前家谱中的信息缺口，列出缺失的关键字段。\n" +
        "使用场景：用户要求'帮我看看萧伟还缺什么信息'、'分析张三家谱的完整度'。",
      parameters: {
        type: "object",
        properties: {
          personName: {
            type: "string",
            description: "要分析的人物姓名",
          },
        },
        required: ["personName"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "lookup_person",
      description:
        "查询家谱中某个人的基本信息及其直系亲属（父母、配偶、子女）。\n" +
        "使用场景：用户询问'XX的父母是谁'、'XX的孩子有哪些'、'XX的配偶是谁'等单人直系亲属问题。\n" +
        "注意：此工具只能查直系亲属（父母/配偶/子女），无法查叔伯姑姨等旁系。",
      parameters: {
        type: "object",
        properties: {
          personName: {
            type: "string",
            description: "要查询的人物姓名",
          },
        },
        required: ["personName"],
      },
    },
  },
];

// ─── Agent Context ──────────────────────────────────────────────────

interface AgentContext {
  userId: string;
  treeId: string;
}

// ─── Tool Implementations ───────────────────────────────────────────

async function executeExtractFamilyData(
  ctx: AgentContext,
  text: string,
): Promise<string> {
  const draft = await runIntakeAgent(ctx.userId, ctx.treeId, text);
  return JSON.stringify({ success: true, draft });
}

async function executeQueryRelationship(
  ctx: AgentContext,
  question: string,
): Promise<string> {
  const result = await runRelationshipAgent(ctx.userId, ctx.treeId, question);
  return JSON.stringify(result);
}

async function executeAnalyzePersonGaps(
  ctx: AgentContext,
  personName: string,
): Promise<string> {
  const { persons, relationships } = await getUserGenealogyContext(
    ctx.userId,
    ctx.treeId,
  );
  const existingPeople = toExistingPersonContext(persons);
  const matches = findPersonsByName(existingPeople, personName);

  if (matches.length === 0) {
    return JSON.stringify({
      found: false,
      message: `家谱中没有找到名为"${personName}"的人物。`,
    });
  }

  const person = matches[0];
  const gaps: string[] = [];

  if (!person.birthDate) gaps.push("出生日期");
  if (!person.deathDate) gaps.push("去世日期");
  // 查询完整 Person 记录以检查 bio 等字段
  const fullPerson = await prisma.person.findUnique({
    where: { id: person.id },
    select: { bio: true },
  });
  if (!fullPerson?.bio) gaps.push("生平简介");

  // 检查父母
  const parentRelations = relationships.filter(
    (r) => r.type === "child" && r.personBId === person.id,
  );
  if (parentRelations.length === 0) gaps.push("父母信息");

  // 检查配偶
  const spouseRelations = relationships.filter(
    (r) =>
      r.type === "spouse" &&
      (r.personAId === person.id || r.personBId === person.id),
  );
  if (spouseRelations.length === 0) gaps.push("配偶信息");

  // 检查子女
  const childRelations = relationships.filter(
    (r) => r.type === "child" && r.personAId === person.id,
  );
  if (childRelations.length === 0) gaps.push("子女信息");

  return JSON.stringify({
    found: true,
    person: {
      id: person.id,
      name: person.name,
      gender: person.gender,
      birthDate: person.birthDate,
      deathDate: person.deathDate,
    },
    gaps,
    gapCount: gaps.length,
    message:
      gaps.length > 0
        ? `${person.name} 的资料缺口：${gaps.join("、")}。`
        : `${person.name} 的资料比较完整，暂无明显缺口。`,
  });
}

async function executeLookupPerson(
  ctx: AgentContext,
  personName: string,
): Promise<string> {
  const { persons, relationships } = await getUserGenealogyContext(
    ctx.userId,
    ctx.treeId,
  );
  const existingPeople = toExistingPersonContext(persons);
  const matches = findPersonsByName(existingPeople, personName);

  if (matches.length === 0) {
    return JSON.stringify({
      found: false,
      message: `家谱中没有找到名为"${personName}"的人物。`,
    });
  }

  const person = matches[0];
  const personId = person.id;

  // 查父母：relationship.type=child, personB=本人 → personA 是父母
  const parentRels = relationships.filter(
    (r) => r.type === "child" && r.personBId === personId,
  );
  const parents = parentRels.map((r) => {
    const p = persons.find((pp) => pp.id === r.personAId);
    return p ? { id: p.id, name: p.name, gender: p.gender } : null;
  }).filter(Boolean);

  // 查配偶：relationship.type=spouse, 任一端是本人
  const spouseRels = relationships.filter(
    (r) =>
      r.type === "spouse" &&
      (r.personAId === personId || r.personBId === personId),
  );
  const spouses = spouseRels.map((r) => {
    const spouseId = r.personAId === personId ? r.personBId : r.personAId;
    const p = persons.find((pp) => pp.id === spouseId);
    return p ? { id: p.id, name: p.name, gender: p.gender } : null;
  }).filter(Boolean);

  // 查子女：relationship.type=child, personA=本人 → personB 是子女
  const childRels = relationships.filter(
    (r) => r.type === "child" && r.personAId === personId,
  );
  const children = childRels.map((r) => {
    const p = persons.find((pp) => pp.id === r.personBId);
    return p ? { id: p.id, name: p.name, gender: p.gender } : null;
  }).filter(Boolean);

  return JSON.stringify({
    found: true,
    person: {
      id: person.id,
      name: person.name,
      gender: person.gender,
      birthDate: person.birthDate,
      deathDate: person.deathDate,
    },
    parents,
    parentCount: parents.length,
    spouses,
    spouseCount: spouses.length,
    children,
    childCount: children.length,
  });
}

// ─── Tool Dispatcher ────────────────────────────────────────────────

async function executeTool(
  ctx: AgentContext,
  name: string,
  args: Record<string, unknown>,
): Promise<string> {
  switch (name) {
    case "extract_family_data":
      return executeExtractFamilyData(ctx, args.text as string);
    case "query_relationship":
      return executeQueryRelationship(ctx, args.question as string);
    case "analyze_person_gaps":
      return executeAnalyzePersonGaps(ctx, args.personName as string);
    case "lookup_person":
      return executeLookupPerson(ctx, args.personName as string);
    default:
      return JSON.stringify({ error: `未知工具: ${name}` });
  }
}

// ─── System Prompt ──────────────────────────────────────────────────

function buildSystemPrompt(): string {
  return [
    "你是一个家谱修谱助手，名叫'谱小助'。",
    "你帮助用户录入家谱信息、查询人物关系、分析资料完整度。",
    "",
    "核心规则：",
    "1. 当用户提供包含人物姓名、关系、生卒等信息的文本时，调用 extract_family_data 工具提取结构化数据。",
    "2. 当用户询问两个人之间的关系时，调用 query_relationship 工具。",
    "3. 当用户要求分析某人资料缺口时，调用 analyze_person_gaps 工具。",
    "4. 当用户查询某个人的直系亲属（父母、配偶、子女）时，调用 lookup_person 工具。",
    "5. 如果用户只是闲聊或问候，直接友好回复即可，不需要调用工具。",
    "6. 收到工具返回的结构化数据后，用自然语言简要概括结果，引导用户下一步操作。",
    "7. 回复使用简体中文，语气亲切但专业。",
  ].join("\n");
}

// ─── Unified Agent ──────────────────────────────────────────────────

export interface UnifiedAgentMessage {
  role: "assistant";
  content: string;
  /** 如果调用了 intake 工具，附带草稿供前端展示确认 */
  draft?: IntakeDraft;
  /** 如果调用了 relationship 工具，附带关系结果 */
  relationshipResult?: Record<string, unknown>;
}

export type UnifiedAgentStreamEvent =
  | { type: "delta"; content: string }
  | {
      type: "metadata";
      draft?: IntakeDraft;
      relationshipResult?: Record<string, unknown>;
    };

function mergeToolCallDelta(
  toolCalls: NonNullable<ChatMessage["tool_calls"]>,
  delta: NonNullable<ChatCompletionStreamDelta["tool_calls"]>[number],
) {
  const index = delta.index;
  const current = toolCalls[index] || {
    id: "",
    type: "function" as const,
    function: { name: "", arguments: "" },
  };

  toolCalls[index] = {
    id: delta.id || current.id,
    type: delta.type || current.type,
    function: {
      name: delta.function?.name || current.function.name,
      arguments:
        current.function.arguments + (delta.function?.arguments || ""),
    },
  };
}

export async function runUnifiedAgent(
  userId: string,
  treeId: string,
  userMessage: string,
): Promise<UnifiedAgentMessage> {
  const ctx: AgentContext = { userId, treeId };

  const messages: ChatMessage[] = [
    { role: "system", content: buildSystemPrompt() },
    { role: "user", content: userMessage },
  ];

  // 第一次调用：AI 决定是否需要调用工具
  const completion = await createChatCompletion({
    messages,
    tools: TOOLS,
  });

  const choiceMessage = completion.message;

  // 如果 AI 直接回复（不需要工具）
  if (!choiceMessage.tool_calls || choiceMessage.tool_calls.length === 0) {
    return {
      role: "assistant",
      content: choiceMessage.content || "抱歉，我现在没法回答这个问题。",
    };
  }

  // 执行工具调用
  const toolCall = choiceMessage.tool_calls[0];

  // 将 AI 的工具调用请求加入消息历史
  messages.push({
    role: "assistant",
    content: "",
    tool_calls: [toolCall],
  });

  // 执行工具
  const toolResult = await executeTool(
    ctx,
    toolCall.function.name,
    JSON.parse(toolCall.function.arguments),
  );

  // 将工具结果加入消息历史
  messages.push({
    role: "tool",
    tool_call_id: toolCall.id,
    content: toolResult,
  });

  // 第二次调用：AI 基于工具结果生成最终回复
  const finalCompletion = await createChatCompletion({
    messages,
    tools: TOOLS,
    toolChoice: "none",
  });

  const result: UnifiedAgentMessage = {
    role: "assistant",
    content:
      finalCompletion.message.content || "已完成处理，请查看结果。",
  };

  // 解析工具结果，附加到响应中
  try {
    const parsed = JSON.parse(toolResult);
    if (toolCall.function.name === "extract_family_data" && parsed.draft) {
      result.draft = parsed.draft;
    }
    if (toolCall.function.name === "query_relationship") {
      result.relationshipResult = parsed;
    }
  } catch {
    // ignore parse errors
  }

  return result;
}

export async function* runUnifiedAgentStream(
  userId: string,
  treeId: string,
  userMessage: string,
): AsyncGenerator<UnifiedAgentStreamEvent> {
  const ctx: AgentContext = { userId, treeId };

  const messages: ChatMessage[] = [
    { role: "system", content: buildSystemPrompt() },
    { role: "user", content: userMessage },
  ];

  const assistantToolCalls: NonNullable<ChatMessage["tool_calls"]> = [];
  let directContent = "";

  for await (const delta of createChatCompletionStream({
    messages,
    tools: TOOLS,
  })) {
    if (delta.content) {
      directContent += delta.content;
      yield { type: "delta", content: delta.content };
    }

    for (const toolCallDelta of delta.tool_calls || []) {
      mergeToolCallDelta(assistantToolCalls, toolCallDelta);
    }
  }

  if (assistantToolCalls.length === 0) {
    if (!directContent) {
      yield { type: "delta", content: "抱歉，我现在没法回答这个问题。" };
    }
    return;
  }

  const toolCall = assistantToolCalls[0];

  messages.push({
    role: "assistant",
    content: "",
    tool_calls: [toolCall],
  });

  const toolResult = await executeTool(
    ctx,
    toolCall.function.name,
    JSON.parse(toolCall.function.arguments || "{}"),
  );

  messages.push({
    role: "tool",
    tool_call_id: toolCall.id,
    content: toolResult,
  });

  let finalContent = "";
  for await (const delta of createChatCompletionStream({
    messages,
    tools: TOOLS,
    toolChoice: "none",
  })) {
    if (!delta.content) {
      continue;
    }

    finalContent += delta.content;
    yield { type: "delta", content: delta.content };
  }

  if (!finalContent) {
    yield { type: "delta", content: "已完成处理，请查看结果。" };
  }

  try {
    const parsed = JSON.parse(toolResult);
    if (toolCall.function.name === "extract_family_data" && parsed.draft) {
      yield { type: "metadata", draft: parsed.draft };
    } else if (toolCall.function.name === "query_relationship") {
      yield { type: "metadata", relationshipResult: parsed };
    }
  } catch {
    // ignore parse errors
  }
}
