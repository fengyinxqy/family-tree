import * as assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  FAMILY_BACKUP_KIND,
  FAMILY_BACKUP_VERSION,
  buildFamilyBackupDocument,
  buildRestorePayloads,
  validateFamilyBackupDocument,
} from "./backup-format";

function makeBackupDocument() {
  return buildFamilyBackupDocument({
    exportedAt: "2026-06-13T12:00:00.000Z",
    persons: [
      {
        id: "person-1",
        name: "张三",
        gender: "male",
        birthDate: "1980-01-01",
        deathDate: null,
        bio: null,
        aliases: ["阿三"],
        generationLabel: "长",
        nativePlace: "杭州",
        notes: null,
        posX: 10,
        posY: 20,
        createdAt: "2026-06-01T08:00:00.000Z",
      },
      {
        id: "person-2",
        name: "李四",
        gender: "female",
        birthDate: null,
        deathDate: null,
        bio: "次女",
        aliases: [],
        generationLabel: null,
        nativePlace: null,
        notes: "备注",
        posX: null,
        posY: null,
        createdAt: "2026-06-01T09:00:00.000Z",
      },
    ],
    relationships: [
      {
        id: "rel-1",
        type: "spouse",
        personAId: "person-1",
        personBId: "person-2",
        label: "夫妻",
        sortOrder: 0,
        createdAt: "2026-06-02T08:00:00.000Z",
      },
    ],
    events: [
      {
        id: "event-1",
        personId: "person-2",
        type: "migration",
        title: "迁居苏州",
        dateLabel: "2002",
        location: "苏州",
        description: null,
        sortOrder: 1,
        createdAt: "2026-06-03T08:00:00.000Z",
      },
    ],
  });
}

describe("backup-format", () => {
  it("builds a versioned backup document with summary counts", () => {
    const document = makeBackupDocument();

    assert.equal(document.kind, FAMILY_BACKUP_KIND);
    assert.equal(document.version, FAMILY_BACKUP_VERSION);
    assert.deepEqual(document.summary, {
      personCount: 2,
      relationshipCount: 1,
      eventCount: 1,
    });
  });

  it("validates a correct backup document", () => {
    const document = validateFamilyBackupDocument(makeBackupDocument());
    assert.equal(document.persons[0]?.name, "张三");
    assert.equal(document.relationships[0]?.personBId, "person-2");
  });

  it("rejects an unsupported backup version", () => {
    const input = {
      ...makeBackupDocument(),
      version: FAMILY_BACKUP_VERSION + 1,
    };

    assert.throws(
      () => validateFamilyBackupDocument(input),
      /不支持的备份版本：2/,
    );
  });

  it("rejects broken relationship references", () => {
    const input = {
      ...makeBackupDocument(),
      relationships: [
        {
          ...makeBackupDocument().relationships[0],
          personBId: "missing-person",
        },
      ],
    };

    assert.throws(
      () => validateFamilyBackupDocument(input),
      /关系引用了不存在的人物/,
    );
  });

  it("rejects malformed input payloads", () => {
    assert.throws(
      () =>
        validateFamilyBackupDocument({
          kind: FAMILY_BACKUP_KIND,
          version: FAMILY_BACKUP_VERSION,
          persons: [],
        }),
      /备份文件格式无效/,
    );
  });

  it("maps restored relationships and events to newly created person ids", () => {
    const restorePayloads = buildRestorePayloads(
      makeBackupDocument(),
      new Map([
        ["person-1", "new-person-1"],
        ["person-2", "new-person-2"],
      ]),
    );

    assert.deepEqual(restorePayloads.relationships, [
      {
        type: "spouse",
        personAId: "new-person-1",
        personBId: "new-person-2",
        label: "夫妻",
        sortOrder: 0,
        createdAt: new Date("2026-06-02T08:00:00.000Z"),
      },
    ]);
    assert.deepEqual(restorePayloads.events, [
      {
        personId: "new-person-2",
        type: "migration",
        title: "迁居苏州",
        dateLabel: "2002",
        location: "苏州",
        description: null,
        sortOrder: 1,
        createdAt: new Date("2026-06-03T08:00:00.000Z"),
      },
    ]);
  });
});
