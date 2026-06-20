import * as assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildFamilyBackupDocument } from "@/lib/import-export/backup-format";
import { createImportExportService } from "./import-export-core";

type State = {
  persons: Array<{
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
    createdAt: Date;
    createdBy: string;
    treeId: string;
  }>;
  relationships: Array<{
    id: string;
    type: "spouse" | "child";
    personAId: string;
    personBId: string;
    label: string | null;
    sortOrder: number;
    createdAt: Date;
  }>;
  events: Array<{
    id: string;
    personId: string;
    type: "birth" | "death" | "marriage" | "migration" | "other";
    title: string | null;
    dateLabel: string | null;
    location: string | null;
    description: string | null;
    sortOrder: number;
    createdAt: Date;
  }>;
};

function makeBackupInput() {
  return buildFamilyBackupDocument({
    exportedAt: "2026-06-13T12:00:00.000Z",
    persons: [
      {
        id: "old-parent",
        name: "王大",
        gender: "male",
        birthDate: "1970-01-01",
        deathDate: null,
        bio: null,
        aliases: [],
        generationNumber: 1,
        generationLabel: "父",
        nativePlace: null,
        notes: null,
        posX: 0,
        posY: 0,
        createdAt: "2026-06-01T08:00:00.000Z",
      },
      {
        id: "old-child",
        name: "王小",
        gender: "female",
        birthDate: "2000-01-01",
        deathDate: null,
        bio: "次女",
        aliases: ["小小"],
        generationNumber: 2,
        generationLabel: "子",
        nativePlace: "宁波",
        notes: "迁居后更新",
        posX: 20,
        posY: 30,
        createdAt: "2026-06-01T09:00:00.000Z",
      },
    ],
    relationships: [
      {
        id: "rel-1",
        type: "child",
        personAId: "old-parent",
        personBId: "old-child",
        label: "父女",
        sortOrder: 1,
        createdAt: "2026-06-02T08:00:00.000Z",
      },
    ],
    events: [
      {
        id: "event-1",
        personId: "old-child",
        type: "migration",
        title: "迁居",
        dateLabel: "2020",
        location: "上海",
        description: "工作调动",
        sortOrder: 2,
        createdAt: "2026-06-03T08:00:00.000Z",
      },
    ],
  });
}

function cloneState(state: State): State {
  return {
    persons: state.persons.map((person) => ({ ...person, aliases: [...person.aliases] })),
    relationships: state.relationships.map((relationship) => ({ ...relationship })),
    events: state.events.map((event) => ({ ...event })),
  };
}

function createFakePrisma(initialState: State, options?: { failOnCreateMany?: boolean }) {
  const state = cloneState(initialState);
  let personCounter = 0;

  const tx = {
    relationship: {
      async deleteMany(args: { where: { personA: { treeId: string } } }) {
        const { treeId } = args.where.personA;
        const ownedPersonIds = new Set(
          state.persons
            .filter((person) => person.treeId === treeId)
            .map((person) => person.id),
        );
        state.relationships = state.relationships.filter(
          (relationship) =>
            !ownedPersonIds.has(relationship.personAId) && !ownedPersonIds.has(relationship.personBId),
        );
      },
      async createMany(args: { data: State["relationships"] }) {
        if (options?.failOnCreateMany) {
          throw new Error("createMany failed");
        }
        state.relationships.push(
          ...args.data.map((relationship, index) => ({
            ...relationship,
            id: `restored-rel-${index + 1}`,
          })),
        );
      },
    },
    personEvent: {
      async deleteMany(args: { where: { person: { treeId: string } } }) {
        const { treeId } = args.where.person;
        const ownedPersonIds = new Set(
          state.persons
            .filter((person) => person.treeId === treeId)
            .map((person) => person.id),
        );
        state.events = state.events.filter((event) => !ownedPersonIds.has(event.personId));
      },
      async createMany(args: { data: State["events"] }) {
        state.events.push(
          ...args.data.map((event, index) => ({
            ...event,
            id: `restored-event-${index + 1}`,
          })),
        );
      },
    },
    person: {
      async deleteMany(args: { where: { treeId: string } }) {
        state.persons = state.persons.filter((person) => person.treeId !== args.where.treeId);
      },
      async create(args: {
        data: Omit<State["persons"][number], "id">;
      }) {
        personCounter += 1;
        const created = {
          id: `restored-person-${personCounter}`,
          ...args.data,
        };
        state.persons.push(created);
        return { id: created.id };
      },
    },
  };

  return {
    state,
    prisma: {
      person: {
        async findMany(args: { where: { treeId: string } }) {
          return state.persons.filter((person) => person.treeId === args.where.treeId);
        },
      },
      relationship: {
        async findMany(args: { where: { personA: { treeId: string } } }) {
          const ownedPersonIds = new Set(
            state.persons
              .filter((person) => person.treeId === args.where.personA.treeId)
              .map((person) => person.id),
          );
          return state.relationships.filter((relationship) => ownedPersonIds.has(relationship.personAId));
        },
      },
      personEvent: {
        async findMany(args: { where: { person: { treeId: string } } }) {
          const ownedPersonIds = new Set(
            state.persons
              .filter((person) => person.treeId === args.where.person.treeId)
              .map((person) => person.id),
          );
          return state.events.filter((event) => ownedPersonIds.has(event.personId));
        },
      },
      async $transaction<T>(callback: (client: typeof tx) => Promise<T>) {
        const snapshot = cloneState(state);
        try {
          return await callback(tx);
        } catch (error) {
          state.persons = snapshot.persons;
          state.relationships = snapshot.relationships;
          state.events = snapshot.events;
          throw error;
        }
      },
    },
  };
}

describe("import-export-core", () => {
  it("exports only the current user's family data", async () => {
    const { prisma } = createFakePrisma({
      persons: [
        {
          id: "person-1",
          name: "张三",
          gender: "male",
          birthDate: null,
          deathDate: null,
          bio: null,
          aliases: [],
          generationNumber: 1,
          generationLabel: null,
          nativePlace: null,
          notes: null,
          posX: null,
          posY: null,
          createdAt: new Date("2026-06-01T08:00:00.000Z"),
          createdBy: "user-1",
          treeId: "tree-1",
        },
        {
          id: "person-2",
          name: "游客",
          gender: "female",
          birthDate: null,
          deathDate: null,
          bio: null,
          aliases: [],
          generationNumber: 1,
          generationLabel: null,
          nativePlace: null,
          notes: null,
          posX: null,
          posY: null,
          createdAt: new Date("2026-06-01T09:00:00.000Z"),
          createdBy: "user-2",
          treeId: "tree-2",
        },
      ],
      relationships: [],
      events: [],
    });
    const service = createImportExportService({
      prisma,
      revalidatePath: () => undefined,
    });

    const backup = await service.exportFamilyBackupForUser("user-1", "tree-1");

    assert.equal(backup.persons.length, 1);
    assert.equal(backup.persons[0]?.name, "张三");
    assert.deepEqual(backup.summary, {
      personCount: 1,
      relationshipCount: 0,
      eventCount: 0,
    });
  });

  it("restores persons, relationships, and events with remapped ids", async () => {
    const revalidatedPaths: string[] = [];
    const { prisma, state } = createFakePrisma({
      persons: [
        {
          id: "legacy-person",
          name: "旧人物",
          gender: "male",
          birthDate: null,
          deathDate: null,
          bio: null,
          aliases: [],
          generationNumber: 1,
          generationLabel: null,
          nativePlace: null,
          notes: null,
          posX: null,
          posY: null,
          createdAt: new Date("2026-05-01T08:00:00.000Z"),
          createdBy: "user-1",
          treeId: "tree-1",
        },
      ],
      relationships: [],
      events: [],
    });
    const service = createImportExportService({
      prisma,
      revalidatePath: (path) => revalidatedPaths.push(path),
    });

    const summary = await service.importFamilyBackupForUser("user-1", "tree-1", makeBackupInput());

    assert.deepEqual(summary, {
      personCount: 2,
      relationshipCount: 1,
      eventCount: 1,
    });
    assert.equal(state.persons.length, 2);
    assert.equal(state.relationships.length, 1);
    assert.equal(state.events.length, 1);
    assert.equal(state.persons[0]?.id, "restored-person-1");
    assert.equal(state.persons[1]?.id, "restored-person-2");
    assert.deepEqual(state.relationships[0], {
      id: "restored-rel-1",
      type: "child",
      personAId: "restored-person-1",
      personBId: "restored-person-2",
      label: "父女",
      sortOrder: 1,
      createdAt: new Date("2026-06-02T08:00:00.000Z"),
    });
    assert.deepEqual(state.events[0], {
      id: "restored-event-1",
      personId: "restored-person-2",
      type: "migration",
      title: "迁居",
      dateLabel: "2020",
      location: "上海",
      description: "工作调动",
      sortOrder: 2,
      createdAt: new Date("2026-06-03T08:00:00.000Z"),
    });
    assert.deepEqual(revalidatedPaths, ["/tree"]);
  });

  it("rolls back all mutations when restore fails inside the transaction", async () => {
    const initialState: State = {
      persons: [
        {
          id: "existing-person",
          name: "保留人物",
          gender: "male",
          birthDate: null,
          deathDate: null,
          bio: null,
          aliases: [],
          generationNumber: 1,
          generationLabel: null,
          nativePlace: null,
          notes: null,
          posX: null,
          posY: null,
          createdAt: new Date("2026-05-01T08:00:00.000Z"),
          createdBy: "user-1",
          treeId: "tree-1",
        },
      ],
      relationships: [
        {
          id: "existing-rel",
          type: "child",
          personAId: "existing-person",
          personBId: "existing-person",
          label: null,
          sortOrder: 0,
          createdAt: new Date("2026-05-01T09:00:00.000Z"),
        },
      ],
      events: [
        {
          id: "existing-event",
          personId: "existing-person",
          type: "other",
          title: "旧事件",
          dateLabel: null,
          location: null,
          description: null,
          sortOrder: 0,
          createdAt: new Date("2026-05-01T10:00:00.000Z"),
        },
      ],
    };
    const { prisma, state } = createFakePrisma(initialState, { failOnCreateMany: true });
    const service = createImportExportService({
      prisma,
      revalidatePath: () => undefined,
    });

    await assert.rejects(
      () => service.importFamilyBackupForUser("user-1", "tree-1", makeBackupInput()),
      /createMany failed/,
    );

    assert.deepEqual(state, initialState);
  });
});
