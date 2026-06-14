export interface PersonData {
  id: string;
  name: string;
  gender: "male" | "female";
  birthDate: string | null;
  deathDate: string | null;
  bio: string | null;
  aliases: string[];
  generationNumber: number;
  generationLabel: string | null;
  nativePlace: string | null;
  notes: string | null;
  posX: number | null;
  posY: number | null;
  createdAt: string;
  treeId: string;
}

export interface PersonEventData {
  id: string;
  personId: string;
  type: "birth" | "death" | "marriage" | "migration" | "other";
  title: string | null;
  dateLabel: string | null;
  location: string | null;
  description: string | null;
  sortOrder: number;
}

export interface WorkspacePersonData extends PersonData {
  events: PersonEventData[];
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

/** 关系摘要视图模型，在详情页派生 */
export interface RelationshipSummary {
  parentCount: number;
  spouseCount: number;
  childCount: number;
  hasParent: boolean;
  hasSpouse: boolean;
  hasChild: boolean;
}
