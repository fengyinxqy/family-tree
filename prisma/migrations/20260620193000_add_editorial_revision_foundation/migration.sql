-- CreateEnum
CREATE TYPE "RevisionContentType" AS ENUM ('PERSON', 'PERSON_EVENT', 'RELATIONSHIP', 'SOURCE_MATERIAL', 'MEDIA_OBJECT', 'MATERIAL_LINK', 'IMPORT_BATCH');

-- CreateEnum
CREATE TYPE "ContentRevisionStatus" AS ENUM ('DRAFT', 'IN_REVIEW', 'CHANGES_REQUESTED', 'APPROVED', 'PUBLISHED');

-- CreateEnum
CREATE TYPE "ReviewDecisionType" AS ENUM ('APPROVED', 'CHANGES_REQUESTED');

-- CreateTable
CREATE TABLE "content_revisions" (
    "id" TEXT NOT NULL,
    "tree_id" TEXT NOT NULL,
    "content_type" "RevisionContentType" NOT NULL,
    "target_entity_id" TEXT,
    "author_id" TEXT NOT NULL,
    "parent_revision_id" TEXT,
    "base_family_revision" INTEGER NOT NULL,
    "base_target_updated_at" TIMESTAMP(3),
    "schema_version" INTEGER NOT NULL DEFAULT 1,
    "version" INTEGER NOT NULL DEFAULT 1,
    "status" "ContentRevisionStatus" NOT NULL DEFAULT 'DRAFT',
    "payload" JSONB NOT NULL,
    "submitted_at" TIMESTAMP(3),
    "approved_at" TIMESTAMP(3),
    "published_at" TIMESTAMP(3),
    "published_by" TEXT,
    "publish_operation_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "content_revisions_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "content_revisions_positive_versions" CHECK ("schema_version" > 0 AND "version" > 0)
);

-- CreateTable
CREATE TABLE "review_decisions" (
    "id" TEXT NOT NULL,
    "revision_id" TEXT NOT NULL,
    "reviewer_id" TEXT NOT NULL,
    "decision" "ReviewDecisionType" NOT NULL,
    "comment" TEXT,
    "override_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "review_decisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "staged_media_uploads" (
    "id" TEXT NOT NULL,
    "tree_id" TEXT NOT NULL,
    "uploaded_by" TEXT NOT NULL,
    "temporary_key" TEXT NOT NULL,
    "original_name" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "byte_size" INTEGER NOT NULL,
    "content_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "consumed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "staged_media_uploads_pkey" PRIMARY KEY ("id")
);

-- Existing published business records intentionally remain the baseline and are not backfilled as revisions.

-- CreateIndex
CREATE INDEX "idx_content_revisions_review_queue" ON "content_revisions"("tree_id", "status", "submitted_at");

-- CreateIndex
CREATE INDEX "idx_content_revisions_target_history" ON "content_revisions"("tree_id", "content_type", "target_entity_id", "created_at");

-- CreateIndex
CREATE INDEX "idx_content_revisions_author_status" ON "content_revisions"("author_id", "status", "updated_at");

-- CreateIndex
CREATE INDEX "idx_content_revisions_parent" ON "content_revisions"("parent_revision_id");

-- CreateIndex
CREATE INDEX "idx_review_decisions_revision_created" ON "review_decisions"("revision_id", "created_at");

-- CreateIndex
CREATE INDEX "idx_review_decisions_reviewer_created" ON "review_decisions"("reviewer_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "staged_media_uploads_temporary_key_key" ON "staged_media_uploads"("temporary_key");

-- CreateIndex
CREATE INDEX "idx_staged_media_uploads_tree_state" ON "staged_media_uploads"("tree_id", "consumed_at", "expires_at");

-- CreateIndex
CREATE INDEX "idx_staged_media_uploads_uploader_created" ON "staged_media_uploads"("uploaded_by", "created_at");

-- AddForeignKey
ALTER TABLE "content_revisions" ADD CONSTRAINT "content_revisions_tree_id_fkey" FOREIGN KEY ("tree_id") REFERENCES "family_trees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_revisions" ADD CONSTRAINT "content_revisions_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_revisions" ADD CONSTRAINT "content_revisions_parent_revision_id_fkey" FOREIGN KEY ("parent_revision_id") REFERENCES "content_revisions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_revisions" ADD CONSTRAINT "content_revisions_published_by_fkey" FOREIGN KEY ("published_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_decisions" ADD CONSTRAINT "review_decisions_revision_id_fkey" FOREIGN KEY ("revision_id") REFERENCES "content_revisions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_decisions" ADD CONSTRAINT "review_decisions_reviewer_id_fkey" FOREIGN KEY ("reviewer_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staged_media_uploads" ADD CONSTRAINT "staged_media_uploads_tree_id_fkey" FOREIGN KEY ("tree_id") REFERENCES "family_trees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staged_media_uploads" ADD CONSTRAINT "staged_media_uploads_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
