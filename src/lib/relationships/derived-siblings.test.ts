import * as assert from "node:assert/strict";
import { describe, it } from "node:test";
import { deriveSiblingRelations, getSiblingRelationLabel } from "./derived-siblings";

describe("getSiblingRelationLabel", () => {
  it("returns 兄弟 for two male siblings", () => {
    assert.equal(getSiblingRelationLabel("male", "male"), "兄弟");
  });

  it("returns 姐妹 for two female siblings", () => {
    assert.equal(getSiblingRelationLabel("female", "female"), "姐妹");
  });

  it("returns 兄妹 for mixed gender siblings", () => {
    assert.equal(getSiblingRelationLabel("male", "female"), "兄妹");
    assert.equal(getSiblingRelationLabel("female", "male"), "兄妹");
  });
});

describe("deriveSiblingRelations", () => {
  it("derives brother relationships for two sons", () => {
    const result = deriveSiblingRelations("child-1", "male", [
      {
        parentId: "parent-1",
        parentName: "父亲",
        sibling: {
          id: "child-2",
          name: "次子",
          gender: "male",
        },
      },
    ]);

    assert.deepEqual(result, [
      {
        personId: "child-2",
        name: "次子",
        gender: "male",
        relationLabel: "兄弟",
        sharedParentNames: ["父亲"],
      },
    ]);
  });

  it("derives mixed sibling relationships for a son and a daughter", () => {
    const result = deriveSiblingRelations("child-1", "male", [
      {
        parentId: "parent-1",
        parentName: "父亲",
        sibling: {
          id: "child-2",
          name: "长女",
          gender: "female",
        },
      },
    ]);

    assert.equal(result[0]?.relationLabel, "兄妹");
  });

  it("derives sister relationships for two daughters", () => {
    const result = deriveSiblingRelations("child-1", "female", [
      {
        parentId: "parent-1",
        parentName: "母亲",
        sibling: {
          id: "child-2",
          name: "次女",
          gender: "female",
        },
      },
    ]);

    assert.equal(result[0]?.relationLabel, "姐妹");
  });

  it("deduplicates siblings who share both parents", () => {
    const result = deriveSiblingRelations("child-1", "male", [
      {
        parentId: "father",
        parentName: "父亲",
        sibling: {
          id: "child-2",
          name: "弟弟",
          gender: "male",
        },
      },
      {
        parentId: "mother",
        parentName: "母亲",
        sibling: {
          id: "child-2",
          name: "弟弟",
          gender: "male",
        },
      },
    ]);

    assert.deepEqual(result, [
      {
        personId: "child-2",
        name: "弟弟",
        gender: "male",
        relationLabel: "兄弟",
        sharedParentNames: ["父亲", "母亲"],
      },
    ]);
  });

  it("supports siblings who share only one parent", () => {
    const result = deriveSiblingRelations("child-1", "female", [
      {
        parentId: "father",
        parentName: "父亲",
        sibling: {
          id: "child-2",
          name: "哥哥",
          gender: "male",
        },
      },
    ]);

    assert.equal(result.length, 1);
    assert.equal(result[0]?.relationLabel, "兄妹");
    assert.deepEqual(result[0]?.sharedParentNames, ["父亲"]);
  });
});
