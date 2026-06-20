import { z } from "zod";

export const extractedPersonCandidateSchema = z.object({
  ref: z.string().min(1),
  name: z.string().min(1),
  gender: z.enum(["male", "female", "unknown"]),
  birthDate: z.string().nullable(),
  deathDate: z.string().nullable(),
  bio: z.string().nullable(),
  evidence: z.string().min(1),
});

export const extractedRelationshipCandidateSchema = z.object({
  ref: z.string().min(1),
  type: z.enum(["spouse", "child"]),
  personARef: z.string().min(1),
  personBRef: z.string().min(1),
  label: z.string().nullable(),
  evidence: z.string().min(1),
});

export const intakeExtractionSchema = z.object({
  summary: z.string(),
  persons: z.array(extractedPersonCandidateSchema),
  relationships: z.array(extractedRelationshipCandidateSchema),
  ambiguities: z.array(z.string()),
  questions: z.array(z.string()),
});

export const draftPersonSchema = z.object({
  ref: z.string().min(1),
  action: z.enum(["create", "reuse"]),
  existingPersonId: z.string().nullable(),
  name: z.string().min(1),
  gender: z.enum(["male", "female", "unknown"]),
  birthDate: z.string().nullable(),
  deathDate: z.string().nullable(),
  bio: z.string().nullable(),
  evidence: z.string(),
});

export const draftRelationshipSchema = z.object({
  ref: z.string().min(1),
  action: z.enum(["create", "skip"]),
  type: z.enum(["spouse", "child"]),
  personARef: z.string().min(1),
  personBRef: z.string().min(1),
  label: z.string().nullable(),
  evidence: z.string(),
  reason: z.string().nullable(),
});

export const draftAmbiguitySchema = z.object({
  kind: z.enum([
    "person_match",
    "missing_reference",
    "duplicate_relationship",
    "person_gender_unknown",
    "generation_unclear",
    "relationship_direction_unknown",
  ]),
  message: z.string().min(1),
  relatedRefs: z.array(z.string()),
  options: z.array(z.string()),
  question: z.string().optional(),
});

export const intakeDraftSchema = z.object({
  summary: z.string(),
  persons: z.array(draftPersonSchema),
  relationships: z.array(draftRelationshipSchema),
  ambiguities: z.array(draftAmbiguitySchema),
  questions: z.array(z.string()),
  readyToApply: z.boolean(),
});

export const relationshipQuestionExtractionSchema = z.object({
  sourceName: z.string().nullable(),
  targetName: z.string().nullable(),
  questionType: z.enum(["relationship_between_two_people", "person_lookup", "unknown"]),
  reasoning: z.string(),
});

export const intakeRouteRequestSchema = z.object({
  text: z.string().min(1, "text is required"),
  /** 前一轮草稿，传入则触发续写模式 */
  previousDraft: intakeDraftSchema.optional(),
  /** 用户补充澄清文本，与 previousDraft 一起使用时触发续写 */
  clarificationText: z.string().optional(),
});

export const intakeApplyRequestSchema = z.object({
  draft: intakeDraftSchema,
  sourceText: z.string().trim().min(1).max(50_000),
  conversationRounds: z.number().int().min(1).max(5).optional().default(1),
});

export const relationshipRouteRequestSchema = z.object({
  question: z.string().min(1, "question is required"),
});

export const intakeExtractionJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    summary: { type: "string" },
    persons: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          ref: { type: "string" },
          name: { type: "string" },
          gender: { type: "string", enum: ["male", "female", "unknown"] },
          birthDate: { type: ["string", "null"] },
          deathDate: { type: ["string", "null"] },
          bio: { type: ["string", "null"] },
          evidence: { type: "string" },
        },
        required: ["ref", "name", "gender", "birthDate", "deathDate", "bio", "evidence"],
      },
    },
    relationships: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          ref: { type: "string" },
          type: { type: "string", enum: ["spouse", "child"] },
          personARef: { type: "string" },
          personBRef: { type: "string" },
          label: { type: ["string", "null"] },
          evidence: { type: "string" },
        },
        required: ["ref", "type", "personARef", "personBRef", "label", "evidence"],
      },
    },
    ambiguities: {
      type: "array",
      items: { type: "string" },
    },
    questions: {
      type: "array",
      items: { type: "string" },
    },
  },
  required: ["summary", "persons", "relationships", "ambiguities", "questions"],
} as const;

export const relationshipQuestionJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    sourceName: { type: ["string", "null"] },
    targetName: { type: ["string", "null"] },
    questionType: {
      type: "string",
      enum: ["relationship_between_two_people", "person_lookup", "unknown"],
    },
    reasoning: { type: "string" },
  },
  required: ["sourceName", "targetName", "questionType", "reasoning"],
} as const;
