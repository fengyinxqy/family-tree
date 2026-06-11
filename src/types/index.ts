export interface PersonData {
  id: string;
  name: string;
  gender: "male" | "female";
  birthDate: string | null;
  deathDate: string | null;
  bio: string | null;
  createdAt: string;
}

export interface RelationshipData {
  id: string;
  type: "spouse" | "child";
  personAId: string;
  personBId: string;
  label: string | null;
  sortOrder: number;
}

export interface TreeNode {
  id: string;
  type: "person";
  position: { x: number; y: number };
  data: PersonData & { spouseIds: string[]; childrenIds: string[]; parentIds: string[] };
}

export interface TreeEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
  type: "spouse" | "parent-child";
  label: string | null;
}
