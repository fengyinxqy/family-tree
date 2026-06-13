-- AlterTable
ALTER TABLE "persons" ADD COLUMN     "aliases" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "generation_label" TEXT,
ADD COLUMN     "native_place" TEXT,
ADD COLUMN     "notes" TEXT;

-- CreateTable
CREATE TABLE "person_events" (
    "id" TEXT NOT NULL,
    "person_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT,
    "date_label" TEXT,
    "location" TEXT,
    "description" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "person_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_person_events_person_sort" ON "person_events"("person_id", "sort_order");

-- AddForeignKey
ALTER TABLE "person_events" ADD CONSTRAINT "person_events_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "persons"("id") ON DELETE CASCADE ON UPDATE CASCADE;
