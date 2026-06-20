-- CreateEnum
CREATE TYPE "MaterialCategory" AS ENUM ('genealogy', 'document', 'photo', 'certificate', 'oral_history', 'other');

-- Extend family snapshots with material summary counts
ALTER TABLE "family_snapshots"
ADD COLUMN "material_count" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "file_count" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "source_materials" (
    "id" TEXT NOT NULL,
    "tree_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "category" "MaterialCategory" NOT NULL,
    "source" TEXT,
    "era_label" TEXT,
    "contributor" TEXT,
    "description" TEXT,
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "deleted_by" TEXT,
    "deletion_operation_id" TEXT,

    CONSTRAINT "source_materials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "media_objects" (
    "id" TEXT NOT NULL,
    "material_id" TEXT NOT NULL,
    "original_name" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "byte_size" INTEGER NOT NULL,
    "content_hash" TEXT NOT NULL,
    "storage_key" TEXT NOT NULL,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),
    "deleted_by" TEXT,
    "deletion_operation_id" TEXT,

    CONSTRAINT "media_objects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "material_links" (
    "id" TEXT NOT NULL,
    "material_id" TEXT NOT NULL,
    "person_id" TEXT,
    "person_event_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),
    "deleted_by" TEXT,
    "deletion_operation_id" TEXT,

    CONSTRAINT "material_links_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "material_links_exactly_one_target" CHECK (
        (("person_id" IS NOT NULL)::int + ("person_event_id" IS NOT NULL)::int) = 1
    )
);

-- CreateIndex
CREATE INDEX "idx_source_materials_tree_active_created" ON "source_materials"("tree_id", "deleted_at", "created_at");

-- CreateIndex
CREATE INDEX "idx_source_materials_creator_tree" ON "source_materials"("created_by", "tree_id");

-- CreateIndex
CREATE UNIQUE INDEX "media_objects_storage_key_key" ON "media_objects"("storage_key");

-- CreateIndex
CREATE INDEX "idx_media_objects_material_active_order" ON "media_objects"("material_id", "deleted_at", "display_order");

-- CreateIndex
CREATE INDEX "idx_media_objects_hash" ON "media_objects"("content_hash");

-- CreateIndex
CREATE INDEX "idx_material_links_person_active" ON "material_links"("person_id", "deleted_at");

-- CreateIndex
CREATE INDEX "idx_material_links_event_active" ON "material_links"("person_event_id", "deleted_at");

-- CreateIndex
CREATE INDEX "idx_material_links_material_active" ON "material_links"("material_id", "deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "uq_material_links_person" ON "material_links"("material_id", "person_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_material_links_event" ON "material_links"("material_id", "person_event_id");

-- AddForeignKey
ALTER TABLE "source_materials" ADD CONSTRAINT "source_materials_tree_id_fkey" FOREIGN KEY ("tree_id") REFERENCES "family_trees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "source_materials" ADD CONSTRAINT "source_materials_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media_objects" ADD CONSTRAINT "media_objects_material_id_fkey" FOREIGN KEY ("material_id") REFERENCES "source_materials"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_links" ADD CONSTRAINT "material_links_material_id_fkey" FOREIGN KEY ("material_id") REFERENCES "source_materials"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_links" ADD CONSTRAINT "material_links_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "persons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_links" ADD CONSTRAINT "material_links_person_event_id_fkey" FOREIGN KEY ("person_event_id") REFERENCES "person_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;
