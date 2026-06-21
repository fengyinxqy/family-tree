-- LangGraph PostgreSQL checkpointer tables are managed by the pinned
-- @langchain/langgraph-checkpoint-postgres package. Keeping their DDL in the
-- project migration history prevents Prisma drift and makes fresh deploys reproducible.
CREATE TABLE IF NOT EXISTS "checkpoint_migrations" (
    "v" INTEGER PRIMARY KEY
);

CREATE TABLE IF NOT EXISTS "checkpoints" (
    "thread_id" TEXT NOT NULL,
    "checkpoint_ns" TEXT NOT NULL DEFAULT '',
    "checkpoint_id" TEXT NOT NULL,
    "parent_checkpoint_id" TEXT,
    "type" TEXT,
    "checkpoint" JSONB NOT NULL,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    PRIMARY KEY ("thread_id", "checkpoint_ns", "checkpoint_id")
);

CREATE TABLE IF NOT EXISTS "checkpoint_blobs" (
    "thread_id" TEXT NOT NULL,
    "checkpoint_ns" TEXT NOT NULL DEFAULT '',
    "channel" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "blob" BYTEA,
    PRIMARY KEY ("thread_id", "checkpoint_ns", "channel", "version")
);

CREATE TABLE IF NOT EXISTS "checkpoint_writes" (
    "thread_id" TEXT NOT NULL,
    "checkpoint_ns" TEXT NOT NULL DEFAULT '',
    "checkpoint_id" TEXT NOT NULL,
    "task_id" TEXT NOT NULL,
    "idx" INTEGER NOT NULL,
    "channel" TEXT NOT NULL,
    "type" TEXT,
    "blob" BYTEA NOT NULL,
    PRIMARY KEY ("thread_id", "checkpoint_ns", "checkpoint_id", "task_id", "idx")
);

INSERT INTO "checkpoint_migrations" ("v")
VALUES (0), (1), (2), (3), (4)
ON CONFLICT ("v") DO NOTHING;

-- CreateEnum
CREATE TYPE "AgentSessionStatus" AS ENUM ('ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "AgentMessageRole" AS ENUM ('USER', 'ASSISTANT', 'SYSTEM', 'TOOL');

-- CreateEnum
CREATE TYPE "AgentRunStatus" AS ENUM ('PENDING', 'RUNNING', 'WAITING_FOR_USER', 'WAITING_FOR_CONFIRMATION', 'COMPLETED', 'FAILED', 'CANCELLED', 'BUDGET_EXHAUSTED');

-- CreateEnum
CREATE TYPE "AgentStepStatus" AS ENUM ('RUNNING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "AgentToolCallStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'REJECTED');

-- CreateEnum
CREATE TYPE "AgentToolSideEffect" AS ENUM ('READ', 'PROPOSE');

-- CreateTable
CREATE TABLE "agent_sessions" (
    "id" TEXT NOT NULL,
    "tree_id" TEXT NOT NULL,
    "created_by" TEXT NOT NULL,
    "agent_type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" "AgentSessionStatus" NOT NULL DEFAULT 'ACTIVE',
    "current_run_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agent_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_messages" (
    "id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "author_id" TEXT,
    "role" "AgentMessageRole" NOT NULL,
    "content" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agent_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_runs" (
    "id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "initiated_by" TEXT NOT NULL,
    "goal" TEXT NOT NULL,
    "status" "AgentRunStatus" NOT NULL DEFAULT 'PENDING',
    "budget" JSONB NOT NULL,
    "usage" JSONB NOT NULL DEFAULT '{}',
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "prompt_version" TEXT NOT NULL,
    "graph_version" TEXT NOT NULL,
    "tool_schema_version" TEXT NOT NULL,
    "state_version" INTEGER NOT NULL DEFAULT 1,
    "interruption" JSONB,
    "result" JSONB,
    "termination_reason" TEXT,
    "error_category" TEXT,
    "error_message" TEXT,
    "started_at" TIMESTAMP(3),
    "ended_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agent_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_steps" (
    "id" TEXT NOT NULL,
    "run_id" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "node" TEXT NOT NULL,
    "status" "AgentStepStatus" NOT NULL DEFAULT 'RUNNING',
    "input_summary" JSONB NOT NULL DEFAULT '{}',
    "output_summary" JSONB NOT NULL DEFAULT '{}',
    "duration_ms" INTEGER,
    "input_tokens" INTEGER,
    "output_tokens" INTEGER,
    "error_category" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "agent_steps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_tool_calls" (
    "id" TEXT NOT NULL,
    "run_id" TEXT NOT NULL,
    "step_id" TEXT,
    "tool_name" TEXT NOT NULL,
    "tool_version" TEXT NOT NULL,
    "side_effect" "AgentToolSideEffect" NOT NULL,
    "status" "AgentToolCallStatus" NOT NULL DEFAULT 'PENDING',
    "idempotency_key" TEXT NOT NULL,
    "arguments_hash" TEXT NOT NULL,
    "arguments_summary" JSONB NOT NULL DEFAULT '{}',
    "result_summary" JSONB NOT NULL DEFAULT '{}',
    "permission_action" TEXT NOT NULL,
    "permission_result" TEXT,
    "duration_ms" INTEGER,
    "error_category" TEXT,
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "agent_tool_calls_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "agent_sessions_current_run_id_key" ON "agent_sessions"("current_run_id");

-- CreateIndex
CREATE INDEX "idx_agent_sessions_tree_creator_updated" ON "agent_sessions"("tree_id", "created_by", "updated_at");

-- CreateIndex
CREATE INDEX "idx_agent_sessions_tree_status_updated" ON "agent_sessions"("tree_id", "status", "updated_at");

-- CreateIndex
CREATE INDEX "idx_agent_messages_session_created" ON "agent_messages"("session_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "uq_agent_messages_session_sequence" ON "agent_messages"("session_id", "sequence");

-- CreateIndex
CREATE INDEX "idx_agent_runs_session_status_created" ON "agent_runs"("session_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "idx_agent_runs_initiator_created" ON "agent_runs"("initiated_by", "created_at");

-- A session can have at most one resumable or executing run at a time.
CREATE UNIQUE INDEX "uq_agent_runs_one_active_per_session"
ON "agent_runs"("session_id")
WHERE "status" IN ('PENDING', 'RUNNING', 'WAITING_FOR_USER', 'WAITING_FOR_CONFIRMATION');

-- CreateIndex
CREATE INDEX "idx_agent_steps_run_created" ON "agent_steps"("run_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "uq_agent_steps_run_sequence" ON "agent_steps"("run_id", "sequence");

-- CreateIndex
CREATE UNIQUE INDEX "agent_tool_calls_idempotency_key_key" ON "agent_tool_calls"("idempotency_key");

-- CreateIndex
CREATE INDEX "idx_agent_tool_calls_run_created" ON "agent_tool_calls"("run_id", "created_at");

-- CreateIndex
CREATE INDEX "idx_agent_tool_calls_step" ON "agent_tool_calls"("step_id");

-- AddForeignKey
ALTER TABLE "agent_sessions" ADD CONSTRAINT "agent_sessions_tree_id_fkey" FOREIGN KEY ("tree_id") REFERENCES "family_trees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_sessions" ADD CONSTRAINT "agent_sessions_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_sessions" ADD CONSTRAINT "agent_sessions_current_run_id_fkey" FOREIGN KEY ("current_run_id") REFERENCES "agent_runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_messages" ADD CONSTRAINT "agent_messages_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "agent_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_messages" ADD CONSTRAINT "agent_messages_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_runs" ADD CONSTRAINT "agent_runs_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "agent_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_runs" ADD CONSTRAINT "agent_runs_initiated_by_fkey" FOREIGN KEY ("initiated_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_steps" ADD CONSTRAINT "agent_steps_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "agent_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_tool_calls" ADD CONSTRAINT "agent_tool_calls_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "agent_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_tool_calls" ADD CONSTRAINT "agent_tool_calls_step_id_fkey" FOREIGN KEY ("step_id") REFERENCES "agent_steps"("id") ON DELETE SET NULL ON UPDATE CASCADE;
