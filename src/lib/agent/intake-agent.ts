import { createStructuredCompletion } from "./openai";
import {
  intakeExtractionJsonSchema,
  intakeExtractionSchema,
} from "./schemas";
import {
  buildIntakeDraft,
  getUserGenealogyContext,
  mergeDraftWithClarification,
  toExistingPersonContext,
} from "./tools";
import type { IntakeDraft } from "./types";

function buildExistingPeoplePrompt(
  people: ReturnType<typeof toExistingPersonContext>,
) {
  if (people.length === 0) {
    return "当前家谱中还没有已存在人物。";
  }

  return people
    .map((person) => {
      const life = [person.birthDate, person.deathDate].filter(Boolean).join(" - ");
      return `- ${person.name} | gender=${person.gender} | id=${person.id}${life ? ` | ${life}` : ""}`;
    })
    .join("\n");
}

export async function runIntakeAgent(userId: string, treeId: string, text: string) {
  const { persons, relationships } = await getUserGenealogyContext(userId, treeId);
  const existingPeople = toExistingPersonContext(persons);

  const extraction = await createStructuredCompletion({
    schemaName: "genealogy_intake_extraction",
    schema: intakeExtractionJsonSchema,
    validator: intakeExtractionSchema,
    systemPrompt: [
      "你是一个家谱录入助手。",
      "你的任务是把用户口述的家谱信息转换为结构化人物和关系草稿。",
      "只提取用户明确说出的信息，不要脑补隐藏亲属。",
      "如果信息不完整，就把不确定内容放进 ambiguities 或 questions。",
      "人物性别不确定时使用 unknown。",
      "对于子女关系，personARef 必须是父母，personBRef 必须是子女。",
      "relationship.type 只能是 spouse 或 child。",
      "请严格按照要求输出。",
    ].join("\n"),
    userPrompt: [
      "已有家谱人物如下：",
      buildExistingPeoplePrompt(existingPeople),
      "",
      "请解析下面这段用户输入：",
      text,
    ].join("\n"),
  });

  return buildIntakeDraft(extraction, existingPeople, relationships);
}

/**
 * 构造续写 prompt：将前轮草稿的已确认人物/关系摘要、未解决歧义和用户补充文本
 * 拼接为 LLM 增量提取 prompt。
 */
export function buildContinuationPrompt(
  previousDraft: IntakeDraft,
  clarificationText: string,
): string {
  const personLines = previousDraft.persons.map((p) => {
    const reuseInfo = p.action === "reuse" ? ` existingPersonId=${p.existingPersonId}` : "";
    return `- ref=${p.ref} name="${p.name}" action=${p.action} gender=${p.gender}${reuseInfo}`;
  });

  const relationshipLines = previousDraft.relationships.map((r) => {
    const labelStr = r.label ? ` label="${r.label}"` : "";
    const reasonStr = r.reason ? ` reason="${r.reason}"` : "";
    return `- ref=${r.ref} type=${r.type} personARef=${r.personARef} personBRef=${r.personBRef} action=${r.action}${labelStr}${reasonStr}`;
  });

  const ambiguityLines = previousDraft.ambiguities.map(
    (a) =>
      `- [${a.kind}] ${a.message}${a.question ? ` → 追问: "${a.question}"` : ""} (relatedRefs: ${a.relatedRefs.join(", ")})`,
  );

  const sections: string[] = ["你是一个家谱录入助手，需要根据用户补充信息增量更新草稿。"];

  if (previousDraft.summary) {
    sections.push(`前轮摘要: ${previousDraft.summary}`);
  }

  sections.push(
    [
      "",
      "## 已确认人物",
      ...(personLines.length > 0 ? personLines : ["(无)"]),
      "",
      "## 已确认关系",
      ...(relationshipLines.length > 0 ? relationshipLines : ["(无)"]),
      "",
      "## 待解决的歧义",
      ...(ambiguityLines.length > 0 ? ambiguityLines : ["(无)"]),
      "",
      "## 用户补充信息（仅针对以上歧义或遗漏）",
      clarificationText,
      "",
      "请仅提取用户补充信息中**新增、补全或修正**的内容。",
      "要求：",
      "1. 如果已确认人物的 gender/birthDate/deathDate 在补充中被明确，请输出该人物（使用相同 ref），更新对应字段",
      "2. 如果用户确认了某个人物的复用关系（指出已存在家谱中的人物），请在 persons 中用 action=reuse 和正确的 existingPersonId 标记",
      "3. 如果补充信息补全了之前因 missing_reference 而跳过的关系，请重新输出该关系",
      "4. 如果用户解决了某个歧义，不要再重复报告该歧义",
      "5. 如果补充中出现了全新的人物或关系，也一并提取",
      "6. 不要修改已确认的复用（reuse）人物映射，除非用户明确更正",
    ].join("\n"),
  );

  return sections.join("\n");
}

/**
 * 执行续写：基于前轮草稿和用户补充文本，调用 LLM 获取增量提取结果，
 * 并通过 mergeDraftWithClarification 合并后返回完整草稿。
 */
export async function runIntakeContinuation(
  userId: string,
  treeId: string,
  text: string,
  previousDraft: IntakeDraft,
  clarificationText: string,
): Promise<IntakeDraft> {
  const { persons, relationships } = await getUserGenealogyContext(userId, treeId);
  const existingPeople = toExistingPersonContext(persons);

  const extraction = await createStructuredCompletion({
    schemaName: "genealogy_intake_continuation",
    schema: intakeExtractionJsonSchema,
    validator: intakeExtractionSchema,
    systemPrompt: [
      "你是一个家谱录入助手。",
      "你的任务是读入前一轮草稿和用户补充信息，仅提取需要修改/补全/新增的内容。",
      "只提取用户明确说出的信息，不要脑补。",
      "如果信息不完整，就把不确定内容放进 ambiguities 或 questions。",
      "人物性别不确定时使用 unknown。",
      "对于子女关系，personARef 必须是父母，personBRef 必须是子女。",
      "relationship.type 只能是 spouse 或 child。",
      "请严格按照要求输出。",
    ].join("\n"),
    userPrompt: buildContinuationPrompt(previousDraft, clarificationText),
  });

  return mergeDraftWithClarification(
    previousDraft,
    extraction,
    existingPeople,
    relationships,
  );
}
