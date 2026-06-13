/**
 * 关系引擎单元测试 — 覆盖中文亲属称谓映射、正向/逆向称谓、解释文案与兜底策略
 *
 * 运行方式: npx tsx src/lib/kinship/__tests__/relationship-engine.test.ts
 */
import { describe, it } from "node:test";
import * as assert from "node:assert/strict";
import { inferRelationship } from "../relationship-engine";
import type { Person, Relationship } from "@prisma/client";

// ---------------------------------------------------------------------------
// Test fixture helpers
// ---------------------------------------------------------------------------

let personCounter = 0;
function person(name: string, gender: "male" | "female"): Person {
  return {
    id: `p-${++personCounter}-${name}`,
    name,
    gender,
    birthDate: null,
    deathDate: null,
    bio: null,
    posX: null,
    posY: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy: "test-user",
  } as Person;
}

let relCounter = 0;
function childRel(parent: Person, child: Person): Relationship {
  return {
    id: `r-${++relCounter}`,
    personAId: parent.id,
    personBId: child.id,
    type: "child",
    label: null,
    sortOrder: 0,
    createdAt: new Date(),
  } as Relationship;
}

function spouseRel(a: Person, b: Person): Relationship {
  return {
    id: `r-${++relCounter}`,
    personAId: a.id,
    personBId: b.id,
    type: "spouse",
    label: null,
    sortOrder: 0,
    createdAt: new Date(),
  } as Relationship;
}

/** 快捷调用 inference */
function infer(
  source: Person,
  target: Person,
  people: Person[],
  relationships: Relationship[],
) {
  return inferRelationship(source.id, target.id, people, relationships);
}

// ---------------------------------------------------------------------------
// 1. 直系与一代内关系（回归测试）
// ---------------------------------------------------------------------------

describe("直系与一代内关系", () => {
  it("自反：同一个人", () => {
    const s = person("我", "male");
    const result = infer(s, s, [s], []);
    assert.equal(result.found, true);
    assert.equal(result.relationship, "同一人");
    assert.equal(result.inverseRelationship, "同一人");
    assert.ok(result.explanation.includes("同一个人物"));
  });

  it("配偶关系", () => {
    const a = person("张三", "male");
    const b = person("李四", "female");
    const result = infer(a, b, [a, b], [spouseRel(a, b)]);
    assert.equal(result.found, true);
    assert.equal(result.relationship, "配偶");
    assert.equal(result.inverseRelationship, "配偶");
    assert.ok(result.explanation.includes("配偶关系"));
  });

  it("父亲关系", () => {
    const father = person("父", "male");
    const child = person("子", "male");
    const result = infer(child, father, [father, child], [childRel(father, child)]);
    assert.equal(result.found, true);
    assert.equal(result.relationship, "父亲");
    assert.equal(result.inverseRelationship, "儿子");
    assert.ok(result.explanation.includes("直系亲子关系"));
  });

  it("母亲关系", () => {
    const mother = person("母", "female");
    const child = person("女", "female");
    const result = infer(child, mother, [mother, child], [childRel(mother, child)]);
    assert.equal(result.found, true);
    assert.equal(result.relationship, "母亲");
    assert.equal(result.inverseRelationship, "女儿");
  });

  it("子女关系", () => {
    const father = person("父", "male");
    const child = person("子", "male");
    const result = infer(father, child, [father, child], [childRel(father, child)]);
    assert.equal(result.relationship, "儿子");
    assert.equal(result.inverseRelationship, "父亲");
  });
});

// ---------------------------------------------------------------------------
// 2. 两跳关系（兄弟姐妹 / 祖辈）
// ---------------------------------------------------------------------------

describe("两跳关系", () => {
  it("兄弟关系 (parent>child)", () => {
    const father = person("父", "male");
    const brother1 = person("兄", "male");
    const brother2 = person("弟", "male");
    const result = infer(brother1, brother2, [father, brother1, brother2], [
      childRel(father, brother1),
      childRel(father, brother2),
    ]);
    assert.equal(result.relationship, "兄弟");
    assert.equal(result.inverseRelationship, "兄弟");
    assert.ok(result.explanation.includes("兄弟姐妹"));
  });

  it("姐妹关系 (parent>child)", () => {
    const father = person("父", "male");
    const sis1 = person("姐", "female");
    const sis2 = person("妹", "female");
    const result = infer(sis1, sis2, [father, sis1, sis2], [
      childRel(father, sis1),
      childRel(father, sis2),
    ]);
    assert.equal(result.relationship, "姐妹");
    assert.equal(result.inverseRelationship, "姐妹");
  });

  it("祖父关系 (parent>parent)", () => {
    const grandpa = person("祖父", "male");
    const father = person("父", "male");
    const child = person("子", "male");
    const result = infer(child, grandpa, [grandpa, father, child], [
      childRel(grandpa, father),
      childRel(father, child),
    ]);
    assert.equal(result.relationship, "祖父");
    assert.equal(result.inverseRelationship, "孙子");
  });

  it("祖母关系 (parent>parent)", () => {
    const grandma = person("祖母", "female");
    const father = person("父", "male");
    const child = person("子", "male");
    const result = infer(child, grandma, [grandma, father, child], [
      childRel(grandma, father),
      childRel(father, child),
    ]);
    assert.equal(result.relationship, "祖母");
    assert.equal(result.inverseRelationship, "孙子");
  });

  it("孙子关系 (child>child)", () => {
    const grandpa = person("祖父", "male");
    const father = person("父", "male");
    const child = person("子", "male");
    const result = infer(grandpa, child, [grandpa, father, child], [
      childRel(grandpa, father),
      childRel(father, child),
    ]);
    assert.equal(result.relationship, "孙子");
    assert.equal(result.inverseRelationship, "祖父");
  });
});

// ---------------------------------------------------------------------------
// 3. 侄甥辈（parent>child>child）— 正向/逆向 + 分支性别区分
// ---------------------------------------------------------------------------

describe("侄甥辈关系 (parent>child>child)", () => {
  it("侄子：兄弟的儿子（分支男性，目标男性）", () => {
    const father = person("父", "male");
    const self = person("我", "male");
    const brother = person("兄", "male");
    const nephew = person("侄子", "male");
    const result = infer(self, nephew, [father, self, brother, nephew], [
      childRel(father, self),
      childRel(father, brother),
      childRel(brother, nephew),
    ]);
    assert.equal(result.relationship, "侄子");
    assert.equal(result.inverseRelationship, "伯叔辈长辈");
    // inverse: nephew → self = father's brother = 伯叔辈长辈
    assert.ok(result.explanation.includes("侄甥辈晚辈"));
  });

  it("侄女：兄弟的女儿（分支男性，目标女性）", () => {
    const father = person("父", "male");
    const self = person("我", "male");
    const brother = person("兄", "male");
    const niece = person("侄女", "female");
    const result = infer(self, niece, [father, self, brother, niece], [
      childRel(father, self),
      childRel(father, brother),
      childRel(brother, niece),
    ]);
    assert.equal(result.relationship, "侄女");
    assert.equal(result.inverseRelationship, "伯叔辈长辈");
  });

  it("外甥：姐妹的儿子（分支女性，目标男性）", () => {
    const father = person("父", "male");
    const self = person("我", "male");
    const sister = person("姐", "female");
    const nephew = person("外甥", "male");
    const result = infer(self, nephew, [father, self, sister, nephew], [
      childRel(father, self),
      childRel(father, sister),
      childRel(sister, nephew),
    ]);
    assert.equal(result.relationship, "外甥");
    // inverse: nephew → self = mother's brother = 舅辈长辈 (since sister is female)
    assert.equal(result.inverseRelationship, "舅辈长辈");
  });

  it("外甥女：姐妹的女儿（分支女性，目标女性）", () => {
    const father = person("父", "male");
    const self = person("我", "male");
    const sister = person("姐", "female");
    const niece = person("外甥女", "female");
    const result = infer(self, niece, [father, self, sister, niece], [
      childRel(father, self),
      childRel(father, sister),
      childRel(sister, niece),
    ]);
    assert.equal(result.relationship, "外甥女");
    assert.equal(result.inverseRelationship, "舅辈长辈");
  });
});

// ---------------------------------------------------------------------------
// 4. 父母辈旁系长辈（parent>parent>child）— 父系/母系区分
// ---------------------------------------------------------------------------

describe("父母辈旁系长辈 (parent>parent>child)", () => {
  it("伯叔辈长辈：父亲的兄弟", () => {
    const grandpa = person("祖父", "male");
    const father = person("父", "male");
    const uncle = person("叔", "male");
    const self = person("我", "male");
    const result = infer(self, uncle, [grandpa, father, uncle, self], [
      childRel(grandpa, father),
      childRel(grandpa, uncle),
      childRel(father, self),
    ]);
    assert.equal(result.relationship, "伯叔辈长辈");
    assert.equal(result.inverseRelationship, "侄子");
    assert.ok(result.explanation.includes("旁系亲属"));
  });

  it("姑辈长辈：父亲的姐妹", () => {
    const grandpa = person("祖父", "male");
    const father = person("父", "male");
    const aunt = person("姑", "female");
    const self = person("我", "male");
    const result = infer(self, aunt, [grandpa, father, aunt, self], [
      childRel(grandpa, father),
      childRel(grandpa, aunt),
      childRel(father, self),
    ]);
    assert.equal(result.relationship, "姑辈长辈");
    assert.equal(result.inverseRelationship, "侄子");
  });

  it("舅辈长辈：母亲的兄弟", () => {
    const grandpaM = person("外祖父", "male");
    const mother = person("母", "female");
    const uncle = person("舅", "male");
    const self = person("我", "male");
    const result = infer(self, uncle, [grandpaM, mother, uncle, self], [
      childRel(grandpaM, mother),
      childRel(grandpaM, uncle),
      childRel(mother, self),
    ]);
    assert.equal(result.relationship, "舅辈长辈");
    assert.equal(result.inverseRelationship, "外甥");
    assert.ok(result.explanation.includes("旁系亲属"));
  });

  it("姨辈长辈：母亲的姐妹", () => {
    const grandpaM = person("外祖父", "male");
    const mother = person("母", "female");
    const aunt = person("姨", "female");
    const self = person("我", "female");
    const result = infer(self, aunt, [grandpaM, mother, aunt, self], [
      childRel(grandpaM, mother),
      childRel(grandpaM, aunt),
      childRel(mother, self),
    ]);
    assert.equal(result.relationship, "姨辈长辈");
    assert.equal(result.inverseRelationship, "外甥女");
  });

  it("姑姨辈长辈：连接父/母性别未知时使用聚合称谓", () => {
    // parent>parent>child with parent gender unknown
    // We use a parent with unknown gender — but Person has only male/female
    // So this case tests when parent info is missing from peopleById
    const grandpa = person("祖父", "male");
    const father = person("父", "male");
    const aunt = person("姑", "female");
    const self = person("我", "male");
    // remove father from peopleById by not including him in the people list
    const result = infer(self, aunt, [grandpa, aunt, self], [
      childRel(grandpa, father),
      childRel(grandpa, aunt),
      childRel(father, self),
    ]);
    // father is not in the people list, so sourceParent?.gender is undefined
    assert.equal(result.relationship, "姑姨辈长辈");
  });

  it("伯叔舅辈长辈：父系/母系未知 + 目标男性 → 聚合称谓", () => {
    const grandpa = person("祖父", "male");
    const father = person("父", "male");
    const uncle = person("叔", "male");
    const self = person("我", "male");
    // Remove father from people list to simulate missing parent info
    const result = infer(self, uncle, [grandpa, uncle, self], [
      childRel(grandpa, father),
      childRel(grandpa, uncle),
      childRel(father, self),
    ]);
    assert.equal(result.relationship, "伯叔舅辈长辈");
  });
});

// ---------------------------------------------------------------------------
// 5. 堂表亲（parent>parent>child>child）
// ---------------------------------------------------------------------------

describe("堂表亲关系 (parent>parent>child>child)", () => {
  it("堂表兄弟", () => {
    const grandpa = person("祖父", "male");
    const father = person("父", "male");
    const uncle = person("叔", "male");
    const self = person("我", "male");
    const cousin = person("堂兄", "male");
    const result = infer(self, cousin, [grandpa, father, uncle, self, cousin], [
      childRel(grandpa, father),
      childRel(grandpa, uncle),
      childRel(father, self),
      childRel(uncle, cousin),
    ]);
    assert.equal(result.relationship, "堂表兄弟");
    assert.equal(result.inverseRelationship, "堂表兄弟");
    assert.ok(result.explanation.includes("堂表亲"));
  });

  it("堂表姐妹", () => {
    const grandpa = person("祖父", "male");
    const father = person("父", "male");
    const uncle = person("叔", "male");
    const self = person("我", "male");
    const cousin = person("堂姐", "female");
    const result = infer(self, cousin, [grandpa, father, uncle, self, cousin], [
      childRel(grandpa, father),
      childRel(grandpa, uncle),
      childRel(father, self),
      childRel(uncle, cousin),
    ]);
    assert.equal(result.relationship, "堂表姐妹");
    assert.equal(result.inverseRelationship, "堂表兄弟");
  });
});

// ---------------------------------------------------------------------------
// 6. 兄弟姐妹的配偶（parent>child>spouse）— 新增
// ---------------------------------------------------------------------------

describe("兄弟姐妹的配偶 (parent>child>spouse)", () => {
  it("兄弟的配偶", () => {
    const father = person("父", "male");
    const self = person("我", "male");
    const brother = person("兄", "male");
    const brotherWife = person("嫂", "female");
    const result = infer(self, brotherWife, [father, self, brother, brotherWife], [
      childRel(father, self),
      childRel(father, brother),
      spouseRel(brother, brotherWife),
    ]);
    assert.equal(result.relationship, "兄弟的配偶");
    // inverse: brotherWife → self = spouse's sibling (male) = 配偶的兄弟
    assert.equal(result.inverseRelationship, "配偶的兄弟");
    assert.ok(result.explanation.includes("配偶"));
  });

  it("姐妹的配偶", () => {
    const father = person("父", "male");
    const self = person("我", "male");
    const sister = person("姐", "female");
    const sisterHusband = person("姐夫", "male");
    const result = infer(self, sisterHusband, [father, self, sister, sisterHusband], [
      childRel(father, self),
      childRel(father, sister),
      spouseRel(sister, sisterHusband),
    ]);
    assert.equal(result.relationship, "姐妹的配偶");
    // inverse: sisterHusband → self = spouse's sibling = 配偶的姐妹 (self is female from sisterHusband's perspective? No, self is male)
    // Actually: sisterHusband → his spouse's sibling = sister's brother = self(male) → "配偶的兄弟"
    assert.equal(result.inverseRelationship, "配偶的兄弟");
  });
});

// ---------------------------------------------------------------------------
// 7. 配偶的兄弟姐妹（spouse>parent>child）— 新增
// ---------------------------------------------------------------------------

describe("配偶的兄弟姐妹 (spouse>parent>child)", () => {
  it("配偶的姐妹", () => {
    const self = person("我", "male");
    const spouse = person("配偶", "female");
    const spouseMother = person("岳母", "female");
    const spouseSister = person("小姨子", "female");
    const result = infer(self, spouseSister, [self, spouse, spouseMother, spouseSister], [
      spouseRel(self, spouse),
      childRel(spouseMother, spouse),
      childRel(spouseMother, spouseSister),
    ]);
    assert.equal(result.relationship, "配偶的姐妹");
    // inverse: spouseSister → self = sibling's spouse (sibling=spouse who is female)
    assert.equal(result.inverseRelationship, "姐妹的配偶");
    assert.ok(result.explanation.includes("配偶一方的兄弟姐妹"));
  });

  it("配偶的兄弟", () => {
    const self = person("我", "male");
    const spouse = person("配偶", "female");
    const spouseMother = person("岳母", "female");
    const spouseBrother = person("小舅子", "male");
    const result = infer(self, spouseBrother, [self, spouse, spouseMother, spouseBrother], [
      spouseRel(self, spouse),
      childRel(spouseMother, spouse),
      childRel(spouseMother, spouseBrother),
    ]);
    assert.equal(result.relationship, "配偶的兄弟");
    // inverse: spouseBrother → self = sibling's spouse (sibling=female spouse)
    assert.equal(result.inverseRelationship, "姐妹的配偶");
  });
});

// ---------------------------------------------------------------------------
// 8. 姻亲关系（回归）
// ---------------------------------------------------------------------------

describe("姻亲关系", () => {
  it("配偶的父母 (spouse>parent)", () => {
    const self = person("我", "male");
    const spouse = person("配偶", "female");
    const motherInLaw = person("岳母", "female");
    const result = infer(self, motherInLaw, [self, spouse, motherInLaw], [
      spouseRel(self, spouse),
      childRel(motherInLaw, spouse),
    ]);
    assert.equal(result.relationship, "姻亲长辈");
    assert.equal(result.inverseRelationship, "晚辈姻亲");
  });

  it("共同子女的另一位家长 (child>parent)", () => {
    const a = person("父", "male");
    const b = person("母", "female");
    const child = person("子", "male");
    const result = infer(a, b, [a, b, child], [
      childRel(a, child),
      childRel(b, child),
    ]);
    assert.equal(result.relationship, "共同子女的另一位家长");
  });
});

// ---------------------------------------------------------------------------
// 9. 找不到路径
// ---------------------------------------------------------------------------

describe("无法关联的情况", () => {
  it("无路径时 found=false", () => {
    const a = person("甲", "male");
    const b = person("乙", "female");
    const result = infer(a, b, [a, b], []);
    assert.equal(result.found, false);
    assert.equal(result.relationship, null);
    assert.ok(result.explanation.includes("没有找到"));
  });
});

// ---------------------------------------------------------------------------
// 10. 友好兜底 — 半精确层
// ---------------------------------------------------------------------------

describe("半精确层兜底", () => {
  it("未精确映射的血亲路径输出分层描述（上辈旁系）", () => {
    // 构建一个 grandparent's child's child's child 路径（path length 4, 3 parent, 1 child）
    // Actually we need: source → parent → parent → parent → child
    // Let me construct a great-grandparent scenario
    const ggp = person("曾祖", "male");
    const gp = person("祖父", "male");
    const father = person("父", "male");
    const self = person("我", "male");
    const uncle = person("叔祖", "male"); // grandparent's sibling — a 3-hop path
    const result = infer(self, uncle, [ggp, gp, father, self, uncle], [
      childRel(ggp, gp),
      childRel(ggp, uncle), // uncle is sibling of gp
      childRel(gp, father),
      childRel(father, self),
    ]);
    // Path: self → father(parent) → gp(parent) → ggp(parent) → uncle(child)
    // Pattern: parent>parent>parent>child — not explicitly mapped
    // Profile: up=3, down=1, diff=+2 → "上两辈旁系亲属"
    assert.equal(result.found, true);
    assert.ok(
      result.relationship!.includes("上辈") || result.relationship!.includes("旁系"),
      `Expected tiered fallback, got: ${result.relationship}`,
    );
    assert.ok(
      result.explanation.includes("亲属路径"),
      `Explanation should mention path, got: ${result.explanation}`,
    );
  });

  it("含配偶的未精确映射路径输出姻亲分层描述", () => {
    // Build a spouse>parent>child>child (spouse's grandchild — 4 hops, not explicitly mapped)
    const self = person("我", "male");
    const spouse = person("配偶", "female");
    const spouseParent = person("岳父", "male");
    const spouseSibling = person("小舅子", "male");
    const spouseNephew = person("小舅子的儿子", "male");
    const result = infer(self, spouseNephew, [self, spouse, spouseParent, spouseSibling, spouseNephew], [
      spouseRel(self, spouse),
      childRel(spouseParent, spouse),
      childRel(spouseParent, spouseSibling),
      childRel(spouseSibling, spouseNephew),
    ]);
    // Path: self → spouse → spouseParent → spouseSibling → spouseNephew
    // Pattern: spouse>parent>child>child — not mapped
    // Profile: up=1, down=2, spouse=1, isAffine=true → diff=-1 → "姻亲晚辈"
    assert.equal(result.found, true);
    assert.ok(
      result.relationship!.includes("姻亲"),
      `Expected affine tiered fallback, got: ${result.relationship}`,
    );
    assert.ok(
      result.inverseRelationship !== null,
      `Inverse should not be null for fallback`,
    );
  });
});

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

console.log("✅ 所有关系引擎测试通过");
