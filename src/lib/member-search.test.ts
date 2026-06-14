import * as assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Node } from "@xyflow/react";
import {
  filterMemberSearchResults,
  formatMemberSearchMeta,
  getTreeFocusTarget,
  syncHighlightedNodes,
} from "./member-search";
import type { PersonData } from "@/types";

const persons: PersonData[] = [
  {
    id: "1",
    name: "张三",
    gender: "male",
    birthDate: "1980-01-01",
    deathDate: null,
    bio: null,
    aliases: ["阿三"],
    generationNumber: 1,
    generationLabel: null,
    nativePlace: null,
    notes: null,
    posX: null,
    posY: null,
    createdAt: "2026-06-01T00:00:00.000Z",
  },
  {
    id: "2",
    name: "张小花",
    gender: "female",
    birthDate: "1990-01-01",
    deathDate: null,
    bio: null,
    aliases: ["花花"],
    generationNumber: 2,
    generationLabel: null,
    nativePlace: null,
    notes: null,
    posX: null,
    posY: null,
    createdAt: "2026-06-01T00:00:00.000Z",
  },
  {
    id: "3",
    name: "李四",
    gender: "male",
    birthDate: null,
    deathDate: "2020-01-01",
    bio: null,
    aliases: ["老四"],
    generationNumber: 1,
    generationLabel: null,
    nativePlace: null,
    notes: null,
    posX: null,
    posY: null,
    createdAt: "2026-06-01T00:00:00.000Z",
  },
];

describe("member-search helpers", () => {
  it("returns empty results for blank queries", () => {
    assert.deepEqual(filterMemberSearchResults(persons, " "), []);
  });

  it("prioritizes exact name matches ahead of partial matches", () => {
    const results = filterMemberSearchResults(persons, "张三");

    assert.equal(results.length, 1);
    assert.equal(results[0]?.person.id, "1");
    assert.equal(results[0]?.matchedBy, "name");
  });

  it("supports alias matches", () => {
    const results = filterMemberSearchResults(persons, "花花");

    assert.equal(results.length, 1);
    assert.equal(results[0]?.person.id, "2");
    assert.equal(results[0]?.matchedBy, "alias");
  });

  it("formats gender and year metadata for display", () => {
    assert.deepEqual(formatMemberSearchMeta(persons[0]), {
      genderLabel: "男",
      birthYear: 1980,
      deathYear: null,
    });
    assert.deepEqual(formatMemberSearchMeta(persons[2]), {
      genderLabel: "男",
      birthYear: null,
      deathYear: 2020,
    });
  });

  it("syncs highlighted node state and clears stale highlights", () => {
    const nodes = [
      {
        id: "1",
        position: { x: 10, y: 20 },
        data: { highlighted: false },
      },
      {
        id: "2",
        position: { x: 30, y: 40 },
        data: { highlighted: true },
      },
    ] as Node[];

    const updated = syncHighlightedNodes(nodes, "1");

    assert.equal((updated[0]?.data as { highlighted?: boolean }).highlighted, true);
    assert.equal((updated[1]?.data as { highlighted?: boolean }).highlighted, false);
  });

  it("returns viewport focus coordinates for a rendered node", () => {
    const target = getTreeFocusTarget(
      [
        {
          id: "2",
          position: { x: 30, y: 40 },
          data: {},
        },
      ] as Node[],
      "2",
    );

    assert.deepEqual(target, { x: 125, y: 80 });
    assert.equal(getTreeFocusTarget([] as Node[], "missing"), null);
  });
});
