import { z } from "zod";

export const MATERIAL_CATEGORIES = [
  "genealogy",
  "document",
  "photo",
  "certificate",
  "oral_history",
  "other",
] as const;

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullable()
    .optional()
    .transform((value) => value || null);

export const materialInputSchema = z.object({
  title: z.string().trim().min(1, "请输入资料标题").max(120),
  category: z.enum(MATERIAL_CATEGORIES),
  source: optionalText(200),
  eraLabel: optionalText(80),
  contributor: optionalText(120),
  description: optionalText(2000),
});

export interface MaterialLinkTarget {
  personId?: string | null;
  personEventId?: string | null;
}

export interface MaterialLinkCandidateContext {
  treeId: string;
  people: Array<{ id: string; treeId: string; deletedAt: Date | null }>;
  events: Array<{
    id: string;
    person: { treeId: string; deletedAt: Date | null };
  }>;
}

export function validateMaterialLinkTargets(
  targets: MaterialLinkTarget[],
  context: MaterialLinkCandidateContext,
) {
  const seen = new Set<string>();

  for (const target of targets) {
    const targetCount = Number(Boolean(target.personId)) + Number(Boolean(target.personEventId));
    if (targetCount !== 1) {
      throw new Error("每条资料关联必须且只能指定一个目标");
    }

    const key = target.personId
      ? `person:${target.personId}`
      : `event:${target.personEventId}`;
    if (seen.has(key)) {
      throw new Error("资料关联不能重复");
    }
    seen.add(key);

    if (target.personId) {
      const person = context.people.find((item) => item.id === target.personId);
      if (!person || person.treeId !== context.treeId || person.deletedAt) {
        throw new Error("资料关联的人物不存在、已删除或不属于当前家谱");
      }
    }

    if (target.personEventId) {
      const event = context.events.find((item) => item.id === target.personEventId);
      if (!event || event.person.treeId !== context.treeId || event.person.deletedAt) {
        throw new Error("资料关联的事件不存在、已删除或不属于当前家谱");
      }
    }
  }

  return targets.map((target) => ({
    personId: target.personId ?? null,
    personEventId: target.personEventId ?? null,
  }));
}
