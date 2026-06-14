import { createStructuredCompletion } from "./openai";
import {
  relationshipQuestionExtractionSchema,
  relationshipQuestionJsonSchema,
} from "./schemas";
import { findPersonsByName, getUserGenealogyContext, toExistingPersonContext } from "./tools";
import { inferRelationship } from "@/lib/kinship/relationship-engine";

function buildPeopleRoster(
  people: ReturnType<typeof toExistingPersonContext>,
) {
  if (people.length === 0) {
    return "当前家谱为空。";
  }

  return people
    .map((person) => `- ${person.name} | id=${person.id} | gender=${person.gender}`)
    .join("\n");
}

export async function runRelationshipAgent(userId: string, treeId: string, question: string) {
  const { persons, relationships } = await getUserGenealogyContext(userId, treeId);
  const existingPeople = toExistingPersonContext(persons);

  const extracted = await createStructuredCompletion({
    schemaName: "genealogy_relationship_question",
    schema: relationshipQuestionJsonSchema,
    validator: relationshipQuestionExtractionSchema,
    systemPrompt: [
      "你是一个家谱问答解析助手。",
      "你的任务是从用户问题中提取出两个人物姓名，并识别这是否是在询问两人的亲属关系。",
      "如果问题里没有明确两个人名，请返回 null，并在 reasoning 里说明原因。",
      "请严格按照要求输出。",
    ].join("\n"),
    userPrompt: [
      "当前家谱人物列表：",
      buildPeopleRoster(existingPeople),
      "",
      "请解析这个问题：",
      question,
    ].join("\n"),
  });

  if (!extracted.sourceName || !extracted.targetName) {
    return {
      ok: false,
      reason: "missing_names",
      message: "我暂时没法从问题里稳定识别出两个人名，请换一种更明确的问法。",
      extraction: extracted,
    };
  }

  const sourceMatches = findPersonsByName(existingPeople, extracted.sourceName);
  const targetMatches = findPersonsByName(existingPeople, extracted.targetName);

  if (sourceMatches.length !== 1 || targetMatches.length !== 1) {
    return {
      ok: false,
      reason: "ambiguous_match",
      message: "人物匹配不够明确，请确认名字是否唯一。",
      extraction: extracted,
      candidates: {
        source: sourceMatches,
        target: targetMatches,
      },
    };
  }

  const inference = inferRelationship(
    sourceMatches[0].id,
    targetMatches[0].id,
    persons,
    relationships,
  );

  return {
    ok: inference.found,
    reason: inference.found ? null : "path_not_found",
    message: inference.found
      ? `${sourceMatches[0].name} 和 ${targetMatches[0].name} 的关系已计算完成。`
      : "没有找到两人之间的亲属路径。",
    extraction: extracted,
    sourcePerson: sourceMatches[0],
    targetPerson: targetMatches[0],
    inference,
  };
}
