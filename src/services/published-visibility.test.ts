import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const readSource = (relativePath: string) => readFile(new URL(`../${relativePath}`, import.meta.url), "utf8");

void test("普通树、人物、资料、关系推导与导出只查询正式业务表", async () => {
  const paths = [
    "services/family-workspace.service.ts",
    "services/person.service.ts",
    "services/relationship.service.ts",
    "services/material.service.ts",
    "services/import-export-core.ts",
    "services/snapshot.service.ts",
  ];
  const sources = await Promise.all(paths.map(readSource));
  for (const [index, source] of sources.entries()) {
    assert.doesNotMatch(source, /contentRevision\.(?:find|aggregate|count)/, `${paths[index]} 不应读取未发布修订`);
    assert.doesNotMatch(source, /reviewDecision\.(?:find|aggregate|count)/, `${paths[index]} 不应读取审校意见`);
  }
});

void test("正式读取和导出排除软删除及撤回数据", async () => {
  const [activeQueries, importExport, workspace] = await Promise.all([
    readSource("lib/data-safety/active-queries.ts"),
    readSource("services/import-export-core.ts"),
    readSource("services/family-workspace.service.ts"),
  ]);
  assert.match(activeQueries, /deletedAt: null/);
  assert.match(activeQueries, /withdrawnAt: null/);
  assert.match(importExport, /deletedAt: null/);
  assert.match(workspace, /where: \{ treeId: activeTree\.id, deletedAt: null, withdrawnAt: null \}/);
  assert.match(workspace, /events: \{ where: \{ withdrawnAt: null \}/);
});

void test("正式表只由发布协调器写入，草稿服务仅写修订表", async () => {
  const [draftService, publishService] = await Promise.all([
    readSource("services/editorial-revision.service.ts"),
    readSource("services/editorial-publish.service.ts"),
  ]);
  assert.doesNotMatch(draftService, /tx\.(?:person|relationship|personEvent|sourceMaterial|mediaObject|materialLink)\.(?:create|update|delete)/);
  assert.match(draftService, /contentRevision\.(?:create|update)/);
  assert.match(publishService, /contentRevision\.update/);
  assert.match(publishService, /status: "PUBLISHED"/);
});
