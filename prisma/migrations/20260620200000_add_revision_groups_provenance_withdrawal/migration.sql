-- CreateEnum
CREATE TYPE "RevisionProvenanceKind" AS ENUM ('MATERIAL', 'MEDIA_OBJECT', 'INTAKE_SNAPSHOT', 'MANUAL_KNOWLEDGE');

-- AlterTable
ALTER TABLE "content_revisions" ADD COLUMN     "withdrawal_operation_id" TEXT,
ADD COLUMN     "withdrawal_reason" TEXT,
ADD COLUMN     "withdrawn_at" TIMESTAMP(3),
ADD COLUMN     "withdrawn_by" TEXT,
ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "family_memberships" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "material_links" ADD COLUMN     "withdrawal_operation_id" TEXT,
ADD COLUMN     "withdrawal_reason" TEXT,
ADD COLUMN     "withdrawn_at" TIMESTAMP(3),
ADD COLUMN     "withdrawn_by" TEXT;

-- AlterTable
ALTER TABLE "media_objects" ADD COLUMN     "withdrawal_operation_id" TEXT,
ADD COLUMN     "withdrawal_reason" TEXT,
ADD COLUMN     "withdrawn_at" TIMESTAMP(3),
ADD COLUMN     "withdrawn_by" TEXT;

-- AlterTable
ALTER TABLE "person_events" ADD COLUMN     "withdrawal_operation_id" TEXT,
ADD COLUMN     "withdrawal_reason" TEXT,
ADD COLUMN     "withdrawn_at" TIMESTAMP(3),
ADD COLUMN     "withdrawn_by" TEXT;

-- AlterTable
ALTER TABLE "persons" ADD COLUMN     "withdrawal_operation_id" TEXT,
ADD COLUMN     "withdrawal_reason" TEXT,
ADD COLUMN     "withdrawn_at" TIMESTAMP(3),
ADD COLUMN     "withdrawn_by" TEXT;

-- AlterTable
ALTER TABLE "relationships" ADD COLUMN     "withdrawal_operation_id" TEXT,
ADD COLUMN     "withdrawal_reason" TEXT,
ADD COLUMN     "withdrawn_at" TIMESTAMP(3),
ADD COLUMN     "withdrawn_by" TEXT;

-- AlterTable
ALTER TABLE "review_decisions" ADD COLUMN     "group_id" TEXT,
ALTER COLUMN "revision_id" DROP NOT NULL;

-- AlterTable
ALTER TABLE "source_materials" ADD COLUMN     "withdrawal_operation_id" TEXT,
ADD COLUMN     "withdrawal_reason" TEXT,
ADD COLUMN     "withdrawn_at" TIMESTAMP(3),
ADD COLUMN     "withdrawn_by" TEXT;

-- CreateTable
CREATE TABLE "revision_groups" (
    "id" TEXT NOT NULL,
    "tree_id" TEXT NOT NULL,
    "author_id" TEXT NOT NULL,
    "schema_version" INTEGER NOT NULL DEFAULT 1,
    "summary" TEXT NOT NULL,
    "source_snapshot" JSONB NOT NULL,
    "source_text_hash" TEXT NOT NULL,
    "safe_source_excerpt" TEXT NOT NULL,
    "base_family_revision" INTEGER NOT NULL,
    "status" "ContentRevisionStatus" NOT NULL DEFAULT 'DRAFT',
    "submitted_at" TIMESTAMP(3),
    "approved_at" TIMESTAMP(3),
    "published_at" TIMESTAMP(3),
    "published_by" TEXT,
    "publish_operation_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "revision_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "revision_group_members" (
    "id" TEXT NOT NULL,
    "group_id" TEXT NOT NULL,
    "revision_id" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "temp_ref" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "revision_group_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "revision_provenance" (
    "id" TEXT NOT NULL,
    "tree_id" TEXT NOT NULL,
    "revision_id" TEXT,
    "group_id" TEXT,
    "kind" "RevisionProvenanceKind" NOT NULL,
    "source_material_id" TEXT,
    "media_object_id" TEXT,
    "locator" TEXT,
    "source_text_hash" TEXT,
    "safe_excerpt" TEXT,
    "manual_rationale" TEXT,
    "safe_source_label" TEXT NOT NULL,
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "revision_provenance_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_revision_groups_review_queue" ON "revision_groups"("tree_id", "status", "submitted_at");

-- CreateIndex
CREATE INDEX "idx_revision_groups_author_status" ON "revision_groups"("author_id", "status", "updated_at");

-- CreateIndex
CREATE INDEX "idx_revision_groups_tree_created" ON "revision_groups"("tree_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "revision_group_members_revision_id_key" ON "revision_group_members"("revision_id");

-- CreateIndex
CREATE INDEX "idx_revision_group_members_group_created" ON "revision_group_members"("group_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "uq_revision_group_members_order" ON "revision_group_members"("group_id", "order");

-- CreateIndex
CREATE UNIQUE INDEX "uq_revision_group_members_temp_ref" ON "revision_group_members"("group_id", "temp_ref");

-- CreateIndex
CREATE INDEX "idx_revision_provenance_tree_created" ON "revision_provenance"("tree_id", "created_at");

-- CreateIndex
CREATE INDEX "idx_revision_provenance_revision_created" ON "revision_provenance"("revision_id", "created_at");

-- CreateIndex
CREATE INDEX "idx_revision_provenance_group_created" ON "revision_provenance"("group_id", "created_at");

-- CreateIndex
CREATE INDEX "idx_revision_provenance_material" ON "revision_provenance"("source_material_id");

-- CreateIndex
CREATE INDEX "idx_revision_provenance_media" ON "revision_provenance"("media_object_id");

-- CreateIndex
CREATE INDEX "idx_material_links_material_withdrawn" ON "material_links"("material_id", "withdrawn_at");

-- CreateIndex
CREATE INDEX "idx_media_objects_material_withdrawn" ON "media_objects"("material_id", "withdrawn_at");

-- CreateIndex
CREATE INDEX "idx_person_events_person_withdrawn" ON "person_events"("person_id", "withdrawn_at");

-- CreateIndex
CREATE INDEX "idx_persons_tree_withdrawn" ON "persons"("tree_id", "withdrawn_at");

-- CreateIndex
CREATE INDEX "idx_relationships_endpoints_withdrawn" ON "relationships"("person_a_id", "person_b_id", "withdrawn_at");

-- CreateIndex
CREATE INDEX "idx_review_decisions_group_created" ON "review_decisions"("group_id", "created_at");

-- CreateIndex
CREATE INDEX "idx_source_materials_tree_withdrawn" ON "source_materials"("tree_id", "withdrawn_at");

-- AddForeignKey
ALTER TABLE "content_revisions" ADD CONSTRAINT "content_revisions_withdrawn_by_fkey" FOREIGN KEY ("withdrawn_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "revision_groups" ADD CONSTRAINT "revision_groups_tree_id_fkey" FOREIGN KEY ("tree_id") REFERENCES "family_trees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "revision_groups" ADD CONSTRAINT "revision_groups_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "revision_groups" ADD CONSTRAINT "revision_groups_published_by_fkey" FOREIGN KEY ("published_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "revision_group_members" ADD CONSTRAINT "revision_group_members_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "revision_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "revision_group_members" ADD CONSTRAINT "revision_group_members_revision_id_fkey" FOREIGN KEY ("revision_id") REFERENCES "content_revisions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_decisions" ADD CONSTRAINT "review_decisions_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "revision_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "revision_provenance" ADD CONSTRAINT "revision_provenance_tree_id_fkey" FOREIGN KEY ("tree_id") REFERENCES "family_trees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "revision_provenance" ADD CONSTRAINT "revision_provenance_revision_id_fkey" FOREIGN KEY ("revision_id") REFERENCES "content_revisions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "revision_provenance" ADD CONSTRAINT "revision_provenance_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "revision_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "revision_provenance" ADD CONSTRAINT "revision_provenance_source_material_id_fkey" FOREIGN KEY ("source_material_id") REFERENCES "source_materials"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "revision_provenance" ADD CONSTRAINT "revision_provenance_media_object_id_fkey" FOREIGN KEY ("media_object_id") REFERENCES "media_objects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "revision_provenance" ADD CONSTRAINT "revision_provenance_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Existing formal records remain visible because withdrawal fields default to NULL.
-- Existing published revisions are intentionally not assigned fabricated provenance.

ALTER TABLE "revision_groups"
ADD CONSTRAINT "revision_groups_positive_schema_version" CHECK ("schema_version" > 0),
ADD CONSTRAINT "revision_groups_source_hash_format" CHECK ("source_text_hash" ~ '^[A-Fa-f0-9]{64}$');

ALTER TABLE "revision_group_members"
ADD CONSTRAINT "revision_group_members_nonnegative_order" CHECK ("order" >= 0),
ADD CONSTRAINT "revision_group_members_temp_ref_format" CHECK ("temp_ref" ~ '^tmp:[A-Za-z0-9_-]{1,120}$');

ALTER TABLE "review_decisions"
ADD CONSTRAINT "review_decisions_exactly_one_subject" CHECK (
  (("revision_id" IS NOT NULL)::int + ("group_id" IS NOT NULL)::int) = 1
);

ALTER TABLE "revision_provenance"
ADD CONSTRAINT "revision_provenance_exactly_one_subject" CHECK (
  (("revision_id" IS NOT NULL)::int + ("group_id" IS NOT NULL)::int) = 1
),
ADD CONSTRAINT "revision_provenance_kind_fields" CHECK (
  ("kind" = 'MATERIAL' AND "source_material_id" IS NOT NULL AND "media_object_id" IS NULL AND "source_text_hash" IS NULL)
  OR ("kind" = 'MEDIA_OBJECT' AND "media_object_id" IS NOT NULL AND "source_material_id" IS NULL AND "source_text_hash" IS NULL)
  OR ("kind" = 'INTAKE_SNAPSHOT' AND "source_text_hash" IS NOT NULL AND "source_material_id" IS NULL AND "media_object_id" IS NULL)
  OR ("kind" = 'MANUAL_KNOWLEDGE' AND "source_material_id" IS NULL AND "media_object_id" IS NULL AND "source_text_hash" IS NULL)
),
ADD CONSTRAINT "revision_provenance_source_hash_format" CHECK (
  "source_text_hash" IS NULL OR "source_text_hash" ~ '^[A-Fa-f0-9]{64}$'
);
