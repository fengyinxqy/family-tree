import { createStructuredCompletion } from "./openai";
import {
  intakeExtractionJsonSchema,
  intakeExtractionSchema,
} from "./schemas";
import { buildIntakeDraft, getUserGenealogyContext, toExistingPersonContext } from "./tools";

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

export async function runIntakeAgent(userId: string, text: string) {
  const { persons, relationships } = await getUserGenealogyContext(userId);
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
