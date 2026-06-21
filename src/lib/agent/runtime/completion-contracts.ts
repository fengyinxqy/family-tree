import { z } from "zod";
import { intakeDraftSchema } from "@/lib/agent/schemas";
import { ocrEvidenceFragmentSchema } from "./genealogy-tools";

export const completionFindingSchema = z.object({
  field: z.string(),
  status: z.enum(["MISSING", "NOT_FOUND", "CONFLICT", "COMPLETE"]),
  summary: z.string(),
  evidence: z.array(z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("DATABASE"), entityType: z.string(), entityId: z.string() }),
    z.object({ kind: z.literal("MATERIAL"), materialId: z.string(), locator: z.string().nullable(), excerpt: z.string().max(500) }),
    z.object({ kind: z.literal("USER_STATEMENT"), safeExcerpt: z.string().max(500) }),
    z.object({ kind: z.literal("OCR"), fragment: ocrEvidenceFragmentSchema }),
  ])).default([]),
});

export const completionReportSchema = z.object({
  kind: z.literal("report"),
  target: z.object({ personIds: z.array(z.string()).min(1).max(100), label: z.string() }),
  findings: z.array(completionFindingSchema),
  blockingQuestions: z.array(z.string()).max(5),
  summary: z.string(),
});

export const completionArtifactSchema = z.discriminatedUnion("kind", [
  completionReportSchema,
  z.object({ kind: z.literal("draft"), draft: intakeDraftSchema }),
  z.object({ kind: z.literal("revision"), id: z.string(), status: z.string() }),
]);

export function describeMissingEvidence(fieldLabel: string, searchedAuthorizedSources: boolean) {
  return searchedAuthorizedSources
    ? `当前已授权资料中未发现${fieldLabel}证据`
    : `数据库中的${fieldLabel}字段缺失，尚未检索资料来源`;
}

