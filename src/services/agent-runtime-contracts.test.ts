import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = process.cwd();
const read = (path: string) => readFile(`${root}/${path}`, "utf8");

test("Agent 会话和运行路由在每个入口执行认证并使用服务端作用域", async () => {
  const [sessions, detail, runs, resume, cancel] = await Promise.all([
    read("src/app/api/agent/sessions/route.ts"),
    read("src/app/api/agent/sessions/[id]/route.ts"),
    read("src/app/api/agent/runs/route.ts"),
    read("src/app/api/agent/runs/[id]/resume/route.ts"),
    read("src/app/api/agent/runs/[id]/cancel/route.ts"),
  ]);
  for (const source of [sessions, detail, runs, resume, cancel]) {
    assert.match(source, /await auth\(\)/);
    assert.match(source, /export const runtime = "nodejs"/);
  }
  assert.match(detail, /const \{ id \} = await params/);
  assert.match(resume, /getResumableAgentRun\(session\.user\.id, id\)/);
  assert.match(cancel, /cancelAgentRun\(session\.user\.id, id\)/);
});

test("数据库与服务共同保证同一会话只有一个活动运行", async () => {
  const [migration, service] = await Promise.all([
    read("prisma/migrations/20260621035516_add_agent_runtime/migration.sql"),
    read("src/services/agent-runtime.service.ts"),
  ]);
  assert.match(migration, /uq_agent_runs_one_active_per_session/);
  assert.match(migration, /WHERE "status" IN \('PENDING', 'RUNNING', 'WAITING_FOR_USER', 'WAITING_FOR_CONFIRMATION'\)/);
  assert.match(service, /ACTIVE_RUN_EXISTS/);
  assert.match(service, /session\.createdBy !== userId/);
  assert.match(service, /authorizeFamilyAction/);
});

test("新 Runtime 受功能开关保护且旧聊天入口可回滚", async () => {
  const route = await read("src/app/api/agent/chat/route.ts");
  assert.match(route, /AGENT_RUNTIME_ENABLED === "true"/);
  assert.match(route, /runUnifiedAgentStream/);
  assert.match(route, /executeBoundedAgentRun/);
});

test("Agent 工具不注册正式发布能力，提案只能创建修订组", async () => {
  const tools = await read("src/lib/agent/runtime/genealogy-tools.ts");
  assert.doesNotMatch(tools, /name: "(?:publish|approve|withdraw|delete)/);
  assert.match(tools, /name: "create_revision_group"/);
  assert.match(tools, /sideEffect: "PROPOSE"/);
  assert.match(tools, /createRevisionGroup/);
});
