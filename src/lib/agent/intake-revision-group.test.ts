import assert from "node:assert/strict";
import test from "node:test";
import type { IntakeDraft } from "./types";
import { buildIntakeRevisionGroup, getStandaloneRelationshipRevision } from "./intake-revision-group";

const draft: IntakeDraft = {
  summary: "新增一位成员及其亲子关系",
  persons: [
    { ref: "existing", action: "reuse", existingPersonId: "person-existing", name: "甲", gender: "male", birthDate: null, deathDate: null, bio: null, evidence: "当前家谱" },
    { ref: "new", action: "create", existingPersonId: null, name: "乙", gender: "female", birthDate: null, deathDate: null, bio: null, evidence: "用户口述" },
  ],
  relationships: [
    { ref: "relation", action: "create", type: "child", personARef: "existing", personBRef: "new", label: null, evidence: "用户口述", reason: null },
  ],
  ambiguities: [],
  questions: [],
  readyToApply: true,
};

test("builds ordered group members without formal entity identifiers", () => {
  const group = buildIntakeRevisionGroup(draft, {
    sourceText: "甲的女儿是乙。",
    capturedAt: new Date("2026-06-20T00:00:00.000Z"),
  });

  assert.equal(group.members.length, 2);
  assert.deepEqual(group.members.map((member) => member.order), [0, 1]);
  assert.equal(group.members[0]?.contentType, "PERSON");
  const relationship = group.members[1];
  assert.equal(relationship?.contentType, "RELATIONSHIP");
  if (relationship?.contentType === "RELATIONSHIP") {
    assert.deepEqual(relationship.payload.personA, { kind: "EXISTING", entityId: "person-existing" });
    assert.deepEqual(relationship.payload.personB, { kind: "TEMPORARY", tempRef: "tmp:person-0" });
  }
});

test("rejects unresolved intake drafts", () => {
  assert.throws(
    () => buildIntakeRevisionGroup({ ...draft, readyToApply: false }, { sourceText: "口述" }),
    /仍有歧义/,
  );
});

test("extracts a standalone revision when both relationship endpoints exist", () => {
  const existingOnly = buildIntakeRevisionGroup({
    ...draft,
    persons: draft.persons.map((person, index) => ({
      ...person,
      action: "reuse" as const,
      existingPersonId: `person-${index}`,
    })),
  }, { sourceText: "甲和乙是父女。" });

  assert.deepEqual(getStandaloneRelationshipRevision(existingOnly), {
    type: "child",
    personAId: "person-0",
    personBId: "person-1",
    label: null,
    sortOrder: 0,
  });
});
