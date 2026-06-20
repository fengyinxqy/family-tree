import { z } from "zod";

const entityId = z.string().trim().min(1).max(191);
const optionalText = (max: number) => z.string().trim().max(max).nullable().optional().transform((value) => value || null);

export const revisionProvenanceInputSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("MATERIAL"), sourceMaterialId: entityId, locator: optionalText(500) }),
  z.object({ kind: z.literal("MEDIA_OBJECT"), mediaObjectId: entityId, locator: optionalText(500) }),
  z.object({
    kind: z.literal("INTAKE_SNAPSHOT"),
    sourceTextHash: z.string().regex(/^[a-f0-9]{64}$/i),
    safeExcerpt: z.string().trim().min(1).max(500),
  }),
  z.object({ kind: z.literal("MANUAL_KNOWLEDGE"), manualRationale: optionalText(1000) }),
]);

export const revisionProvenanceListSchema = z.array(revisionProvenanceInputSchema).min(1).max(20).superRefine((entries, context) => {
  const keys = entries.map((entry) => {
    if (entry.kind === "MATERIAL") return `material:${entry.sourceMaterialId}`;
    if (entry.kind === "MEDIA_OBJECT") return `media:${entry.mediaObjectId}`;
    if (entry.kind === "INTAKE_SNAPSHOT") return `intake:${entry.sourceTextHash}`;
    return "manual";
  });
  if (new Set(keys).size !== keys.length) context.addIssue({ code: "custom", message: "修订来源不能重复" });
});

export interface ProvenanceScopeRepository {
  sourceBelongsToTree(kind: "MATERIAL" | "MEDIA_OBJECT", id: string, treeId: string): Promise<boolean>;
}

export async function validateRevisionProvenanceScope(repository: ProvenanceScopeRepository, treeId: string, input: unknown) {
  const entries = revisionProvenanceListSchema.parse(input);
  const scopedEntries = entries.filter((entry): entry is Extract<typeof entry, { kind: "MATERIAL" | "MEDIA_OBJECT" }> => entry.kind === "MATERIAL" || entry.kind === "MEDIA_OBJECT");
  const results = await Promise.all(scopedEntries.map((entry) => repository.sourceBelongsToTree(
    entry.kind,
    entry.kind === "MATERIAL" ? entry.sourceMaterialId : entry.mediaObjectId,
    treeId,
  )));
  if (results.some((belongs) => !belongs)) throw new Error("修订来源不存在或不属于当前家族");
  return entries;
}

export type RevisionProvenanceInput = z.infer<typeof revisionProvenanceInputSchema>;
