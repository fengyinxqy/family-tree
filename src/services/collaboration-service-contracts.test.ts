import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const readSource = (relativePath: string) => readFile(new URL(`../${relativePath}`, import.meta.url), "utf8");

void test("成员路由遵循 Next.js 16 动态参数约定并只调用服务端授权服务", async () => {
  const [memberRoute, ownershipRoute, invitationRoute] = await Promise.all([
    readSource("app/api/family/members/[id]/route.ts"),
    readSource("app/api/family/ownership/route.ts"),
    readSource("app/api/family/invitations/accept/route.ts"),
  ]);
  assert.match(memberRoute, /params: Promise<\{ id: string \}>/);
  assert.match(memberRoute, /await Promise\.all\(\[params, request\.json\(\)\]\)/);
  assert.match(ownershipRoute, /transferFamilyOwnership/);
  assert.match(invitationRoute, /acceptFamilyInvitation/);
  for (const source of [memberRoute, ownershipRoute, invitationRoute]) assert.match(source, /toFamilyHttpError/);
});

void test("邀请接受在事务内重读令牌，所有权转移与审计处于同一事务", async () => {
  const source = await readSource("services/family-membership.service.ts");
  assert.match(source, /\$transaction\(async \(tx\) => \{[\s\S]*findUnique\(\{ where: \{ tokenHash \} \}\)/);
  assert.match(source, /familyMembership\.create[\s\S]*familyInvitation\.update[\s\S]*createAuditBatch/);
  assert.match(source, /familyMembership\.update[\s\S]*familyTree\.update[\s\S]*createAuditBatch/);
  assert.match(source, /if \(target\.role === "OWNER"\) throw new Error\("不能(?:停用|移除)家族所有者"\)/);
});

void test("审校服务要求派生新草稿、禁止原地编辑，并在每次决定前重新授权", async () => {
  const source = await readSource("services/editorial-revision.service.ts");
  assert.match(source, /parentRevisionId: source\.id/);
  assert.match(source, /assertRevisionPayloadMutable\(revision\.status\)/);
  assert.match(source, /requireRevisionContext\("review\.decide"\)/);
  assert.match(source, /validateReviewDecision/);
});

void test("发布协调器覆盖全部内容适配器、冲突、事务回滚和重复发布保护", async () => {
  const source = await readSource("services/editorial-publish.service.ts");
  for (const contentType of ["PERSON", "PERSON_EVENT", "RELATIONSHIP", "SOURCE_MATERIAL", "MEDIA_OBJECT", "MATERIAL_LINK"]) {
    assert.match(source, new RegExp(`contentType === "${contentType}"`));
  }
  assert.match(source, /status !== "APPROVED"/);
  assert.match(source, /assertTargetUnchanged/);
  assert.match(source, /assertDependenciesUnchanged/);
  assert.match(source, /\$transaction\(async \(tx\)/);
  assert.match(source, /createAuditBatch\(tx/);
  assert.match(source, /remove\(finalizedStorageKey\)/);
});
