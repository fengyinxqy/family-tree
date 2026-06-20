-- Alter FamilyTree: add dataRevision
ALTER TABLE "family_trees" ADD COLUMN "data_revision" INTEGER NOT NULL DEFAULT 0;

-- Alter Person: add soft-delete metadata
ALTER TABLE "persons" ADD COLUMN "deleted_at" TIMESTAMP(3);
ALTER TABLE "persons" ADD COLUMN "deleted_by" TEXT;
ALTER TABLE "persons" ADD COLUMN "deletion_operation_id" TEXT;

CREATE INDEX "idx_persons_tree_deleted" ON "persons"("tree_id", "deleted_at");

-- Alter Relationship: add soft-delete metadata
ALTER TABLE "relationships" ADD COLUMN "deleted_at" TIMESTAMP(3);
ALTER TABLE "relationships" ADD COLUMN "deleted_by" TEXT;
ALTER TABLE "relationships" ADD COLUMN "deletion_operation_id" TEXT;

CREATE INDEX "idx_relationships_endpoints_deleted" ON "relationships"("person_a_id", "person_b_id", "deleted_at");

-- Create OperationBatch table
CREATE TABLE "operation_batches" (
    "id" TEXT NOT NULL,
    "tree_id" TEXT NOT NULL,
    "actor_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'complete',
    "summary" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "operation_batches_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "idx_operation_batches_tree_created" ON "operation_batches"("tree_id", "created_at");

ALTER TABLE "operation_batches" ADD CONSTRAINT "operation_batches_tree_id_fkey"
FOREIGN KEY ("tree_id") REFERENCES "family_trees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Create AuditEntry table
CREATE TABLE "audit_entries" (
    "id" TEXT NOT NULL,
    "batch_id" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "before_json" JSONB,
    "after_json" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_entries_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "idx_audit_entries_batch" ON "audit_entries"("batch_id");
CREATE INDEX "idx_audit_entries_entity" ON "audit_entries"("entity_type", "entity_id");

ALTER TABLE "audit_entries" ADD CONSTRAINT "audit_entries_batch_id_fkey"
FOREIGN KEY ("batch_id") REFERENCES "operation_batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Create OperationConfirmation table
CREATE TABLE "operation_confirmations" (
    "id" TEXT NOT NULL,
    "tree_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "input_hash" TEXT NOT NULL,
    "revision" INTEGER NOT NULL,
    "preview_result" JSONB NOT NULL DEFAULT '{}',
    "consumed" BOOLEAN NOT NULL DEFAULT false,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "operation_confirmations_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "idx_confirmations_lookup" ON "operation_confirmations"("tree_id", "user_id", "kind", "consumed");
CREATE INDEX "idx_confirmations_expires" ON "operation_confirmations"("expires_at");

ALTER TABLE "operation_confirmations" ADD CONSTRAINT "operation_confirmations_tree_id_fkey"
FOREIGN KEY ("tree_id") REFERENCES "family_trees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Create FamilySnapshot table
CREATE TABLE "family_snapshots" (
    "id" TEXT NOT NULL,
    "tree_id" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "source_revision" INTEGER NOT NULL,
    "creator_id" TEXT NOT NULL,
    "operation_id" TEXT,
    "snapshot_json" JSONB NOT NULL,
    "person_count" INTEGER NOT NULL DEFAULT 0,
    "relationship_count" INTEGER NOT NULL DEFAULT 0,
    "event_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "family_snapshots_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "idx_snapshots_tree_created" ON "family_snapshots"("tree_id", "created_at");

ALTER TABLE "family_snapshots" ADD CONSTRAINT "family_snapshots_tree_id_fkey"
FOREIGN KEY ("tree_id") REFERENCES "family_trees"("id") ON DELETE CASCADE ON UPDATE CASCADE;