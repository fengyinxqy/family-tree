import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { inferRelationship } from "@/lib/kinship/relationship-engine";
import { runIntakeAgent, runIntakeContinuation } from "@/lib/agent/intake-agent";
import { intakeDraftSchema } from "@/lib/agent/schemas";
import { buildIntakeRevisionGroup, getStandaloneRelationshipRevision } from "@/lib/agent/intake-revision-group";
import { findPersonsByName, getUserGenealogyContext, toExistingPersonContext } from "@/lib/agent/tools";
import { createAiRelationshipRevision, createRevisionGroup } from "@/services/revision-group.service";
import { AgentToolRegistry } from "./tool-registry";
import { AGENT_TOOL_SCHEMA_VERSION } from "./versions";

const personSummarySchema = z.object({
  id: z.string(),
  name: z.string(),
  gender: z.string(),
  birthDate: z.string().nullable(),
  deathDate: z.string().nullable(),
});

const lookupPersonOutputSchema = z.object({
  matches: z.array(personSummarySchema),
  requiresClarification: z.boolean(),
});

const personGapOutputSchema = z.object({
  person: personSummarySchema,
  gaps: z.array(z.enum(["birthDate", "deathDate", "bio", "parents", "spouse", "children", "materials"])),
  evidence: z.array(z.object({
    materialId: z.string(),
    title: z.string(),
    category: z.string(),
    locator: z.string().nullable(),
  })),
});

export const ocrEvidenceFragmentSchema = z.object({
  materialId: z.string(),
  mediaObjectId: z.string(),
  page: z.number().int().positive().nullable(),
  region: z.object({ x: z.number(), y: z.number(), width: z.number(), height: z.number() }).nullable(),
  text: z.string(),
  confidence: z.number().min(0).max(1).nullable(),
  extractor: z.string(),
  modelVersion: z.string(),
});

export function createGenealogyToolRegistry() {
  return new AgentToolRegistry()
    .register({
      name: "lookup_person",
      description: "按姓名查询当前家谱中的人物候选；如果返回多个候选，必须先请用户澄清。",
      version: AGENT_TOOL_SCHEMA_VERSION,
      inputSchema: z.object({ name: z.string().trim().min(1).max(100) }),
      outputSchema: lookupPersonOutputSchema,
      permissionAction: "family.read.workspace",
      sideEffect: "READ",
      timeoutMs: 10_000,
      async execute(context, input) {
        const { persons } = await getUserGenealogyContext(context.userId, context.treeId);
        const matches = findPersonsByName(toExistingPersonContext(persons), input.name);
        return { matches, requiresClarification: matches.length !== 1 };
      },
    })
    .register({
      name: "inspect_person_gaps",
      description: "检查一个已确定人物的字段、直系关系和资料缺口。",
      version: AGENT_TOOL_SCHEMA_VERSION,
      inputSchema: z.object({ personId: z.string().min(1) }),
      outputSchema: personGapOutputSchema,
      permissionAction: "family.read.workspace",
      sideEffect: "READ",
      timeoutMs: 10_000,
      async execute(context, input) {
        const person = await prisma.person.findFirstOrThrow({
          where: { id: input.personId, treeId: context.treeId, deletedAt: null, withdrawnAt: null },
        });
        const [relationships, links] = await Promise.all([
          prisma.relationship.findMany({
            where: {
              deletedAt: null,
              withdrawnAt: null,
              OR: [{ personAId: person.id }, { personBId: person.id }],
            },
          }),
          prisma.materialLink.findMany({
            where: { personId: person.id, deletedAt: null, withdrawnAt: null, material: { treeId: context.treeId, deletedAt: null, withdrawnAt: null } },
            include: { material: true },
          }),
        ]);
        const gaps: z.infer<typeof personGapOutputSchema>["gaps"] = [];
        if (!person.birthDate) gaps.push("birthDate");
        if (!person.deathDate) gaps.push("deathDate");
        if (!person.bio) gaps.push("bio");
        if (!relationships.some((item) => item.type === "child" && item.personBId === person.id)) gaps.push("parents");
        if (!relationships.some((item) => item.type === "spouse")) gaps.push("spouse");
        if (!relationships.some((item) => item.type === "child" && item.personAId === person.id)) gaps.push("children");
        if (links.length === 0) gaps.push("materials");
        return {
          person: {
            id: person.id,
            name: person.name,
            gender: person.gender,
            birthDate: person.birthDate,
            deathDate: person.deathDate,
          },
          gaps,
          evidence: links.map((link) => ({
            materialId: link.material.id,
            title: link.material.title,
            category: link.material.category,
            locator: null,
          })),
        };
      },
    })
    .register({
      name: "infer_relationship",
      description: "使用确定性亲属关系引擎推理两个已确定人物之间的关系。",
      version: AGENT_TOOL_SCHEMA_VERSION,
      inputSchema: z.object({ sourcePersonId: z.string(), targetPersonId: z.string() }),
      outputSchema: z.object({
        found: z.boolean(),
        relationship: z.string().nullable(),
        inverseRelationship: z.string().nullable(),
        explanation: z.string(),
        path: z.array(z.object({ fromPersonId: z.string(), toPersonId: z.string(), kind: z.enum(["spouse", "parent", "child"]) })),
      }),
      permissionAction: "family.read.workspace",
      sideEffect: "READ",
      timeoutMs: 10_000,
      async execute(context, input) {
        const { persons, relationships } = await getUserGenealogyContext(context.userId, context.treeId);
        if (!persons.some((person) => person.id === input.sourcePersonId) || !persons.some((person) => person.id === input.targetPersonId)) {
          throw new Error("人物不属于当前家谱或已不可用");
        }
        return inferRelationship(input.sourcePersonId, input.targetPersonId, persons, relationships);
      },
    })
    .register({
      name: "draft_family_data",
      description: "把用户明确提供的家谱事实整理为可审阅草稿，不写入正式数据。",
      version: AGENT_TOOL_SCHEMA_VERSION,
      inputSchema: z.object({
        sourceText: z.string().trim().min(1).max(50_000),
        previousDraft: intakeDraftSchema.optional(),
        clarificationText: z.string().trim().min(1).max(10_000).optional(),
      }),
      outputSchema: intakeDraftSchema,
      permissionAction: "revision.create",
      sideEffect: "READ",
      timeoutMs: 30_000,
      execute: (context, input) => input.previousDraft && input.clarificationText
        ? runIntakeContinuation(context.userId, context.treeId, input.sourceText, input.previousDraft, input.clarificationText)
        : runIntakeAgent(context.userId, context.treeId, input.sourceText),
    })
    .register({
      name: "create_revision_group",
      description: "把用户已确认且无歧义的草稿转换为不可变修订或修订组；不会发布正式数据。",
      version: AGENT_TOOL_SCHEMA_VERSION,
      inputSchema: z.object({
        draft: intakeDraftSchema,
        sourceText: z.string().trim().min(1).max(50_000),
        conversationRounds: z.number().int().min(1).max(20).default(1),
      }),
      outputSchema: z.object({
        kind: z.enum(["revision", "group"]),
        id: z.string(),
        status: z.string(),
        memberCount: z.number().int().nonnegative().optional(),
      }),
      permissionAction: "revision.create",
      sideEffect: "PROPOSE",
      timeoutMs: 20_000,
      async execute(context, input) {
        const groupInput = buildIntakeRevisionGroup(input.draft, input);
        const standalone = getStandaloneRelationshipRevision(groupInput);
        if (standalone) {
          const revision = await createAiRelationshipRevision(context.userId, context.treeId, standalone, groupInput.source);
          return { kind: "revision" as const, id: revision.id, status: revision.status };
        }
        const group = await createRevisionGroup(context.userId, context.treeId, groupInput);
        return { kind: "group" as const, id: group.id, status: group.status, memberCount: group.memberCount };
      },
    });
}
