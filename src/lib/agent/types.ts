export type DraftGender = "male" | "female" | "unknown";

export interface ExtractedPersonCandidate {
  ref: string;
  name: string;
  gender: DraftGender;
  birthDate: string | null;
  deathDate: string | null;
  bio: string | null;
  evidence: string;
}

export interface ExtractedRelationshipCandidate {
  ref: string;
  type: "spouse" | "child";
  personARef: string;
  personBRef: string;
  label: string | null;
  evidence: string;
}

export interface IntakeExtraction {
  summary: string;
  persons: ExtractedPersonCandidate[];
  relationships: ExtractedRelationshipCandidate[];
  ambiguities: string[];
  questions: string[];
}

export interface DraftPerson {
  ref: string;
  action: "create" | "reuse";
  existingPersonId: string | null;
  name: string;
  gender: DraftGender;
  birthDate: string | null;
  deathDate: string | null;
  bio: string | null;
  evidence: string;
}

export interface DraftRelationship {
  ref: string;
  action: "create" | "skip";
  type: "spouse" | "child";
  personARef: string;
  personBRef: string;
  label: string | null;
  evidence: string;
  reason: string | null;
}

export interface DraftAmbiguity {
  kind: "person_match" | "missing_reference" | "duplicate_relationship";
  message: string;
  relatedRefs: string[];
  options: string[];
}

export interface IntakeDraft {
  summary: string;
  persons: DraftPerson[];
  relationships: DraftRelationship[];
  ambiguities: DraftAmbiguity[];
  questions: string[];
  readyToApply: boolean;
}

export interface ExistingPersonContext {
  id: string;
  name: string;
  gender: "male" | "female";
  birthDate: string | null;
  deathDate: string | null;
}

export interface RelationshipQuestionExtraction {
  sourceName: string | null;
  targetName: string | null;
  questionType: "relationship_between_two_people" | "person_lookup" | "unknown";
  reasoning: string;
}

export interface RelationshipPathHop {
  fromPersonId: string;
  toPersonId: string;
  kind: "spouse" | "parent" | "child";
}

export interface RelationshipInference {
  found: boolean;
  relationship: string | null;
  inverseRelationship: string | null;
  path: RelationshipPathHop[];
  explanation: string;
}
