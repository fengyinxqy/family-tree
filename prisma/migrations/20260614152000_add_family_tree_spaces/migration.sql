CREATE TABLE "family_trees" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "owner_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "family_trees_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "idx_family_trees_owner_created" ON "family_trees"("owner_id", "created_at");

ALTER TABLE "family_trees" ADD CONSTRAINT "family_trees_owner_id_fkey"
FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "family_trees" ("id", "name", "description", "owner_id", "created_at", "updated_at")
SELECT
    'default_' || "id",
    COALESCE(NULLIF("name", ''), '我的') || '的家谱',
    '由旧版单家谱数据自动创建',
    "id",
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "users";

ALTER TABLE "persons" ADD COLUMN "tree_id" TEXT;

UPDATE "persons"
SET "tree_id" = 'default_' || "created_by"
WHERE "tree_id" IS NULL;

ALTER TABLE "persons" ALTER COLUMN "tree_id" SET NOT NULL;

CREATE INDEX "idx_persons_created_by_tree" ON "persons"("created_by", "tree_id");

ALTER TABLE "persons" ADD CONSTRAINT "persons_tree_id_fkey"
FOREIGN KEY ("tree_id") REFERENCES "family_trees"("id") ON DELETE CASCADE ON UPDATE CASCADE;
