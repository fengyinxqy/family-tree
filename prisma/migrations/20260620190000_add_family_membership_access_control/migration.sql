-- CreateEnum
CREATE TYPE "FamilyRole" AS ENUM ('OWNER', 'ADMIN', 'EDITOR', 'REVIEWER', 'VIEWER');

-- CreateEnum
CREATE TYPE "FamilyMembershipStatus" AS ENUM ('ACTIVE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "FamilyInvitationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REVOKED');

-- CreateTable
CREATE TABLE "family_memberships" (
    "id" TEXT NOT NULL,
    "tree_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "role" "FamilyRole" NOT NULL,
    "status" "FamilyMembershipStatus" NOT NULL DEFAULT 'ACTIVE',
    "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "family_memberships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "family_invitations" (
    "id" TEXT NOT NULL,
    "tree_id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "FamilyRole" NOT NULL,
    "token_hash" TEXT NOT NULL,
    "status" "FamilyInvitationStatus" NOT NULL DEFAULT 'PENDING',
    "expires_at" TIMESTAMP(3) NOT NULL,
    "invited_by" TEXT NOT NULL,
    "accepted_by" TEXT,
    "accepted_at" TIMESTAMP(3),
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "family_invitations_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "family_invitations_non_owner_role" CHECK ("role" <> 'OWNER')
);

-- Backfill one authoritative owner membership for every existing family.
INSERT INTO "family_memberships" ("id", "tree_id", "user_id", "role", "status", "joined_at", "updated_at")
SELECT
    'owner_' || md5("id" || ':' || "owner_id"),
    "id",
    "owner_id",
    'OWNER'::"FamilyRole",
    'ACTIVE'::"FamilyMembershipStatus",
    "created_at",
    CURRENT_TIMESTAMP
FROM "family_trees"
ON CONFLICT DO NOTHING;

-- CreateIndex
CREATE UNIQUE INDEX "uq_family_memberships_tree_user" ON "family_memberships"("tree_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_family_memberships_active_owner" ON "family_memberships"("tree_id")
WHERE "role" = 'OWNER' AND "status" = 'ACTIVE';

-- CreateIndex
CREATE INDEX "idx_family_memberships_user_status" ON "family_memberships"("user_id", "status");

-- CreateIndex
CREATE INDEX "idx_family_memberships_tree_role_status" ON "family_memberships"("tree_id", "role", "status");

-- CreateIndex
CREATE UNIQUE INDEX "family_invitations_token_hash_key" ON "family_invitations"("token_hash");

-- CreateIndex
CREATE INDEX "idx_family_invitations_tree_status_created" ON "family_invitations"("tree_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "idx_family_invitations_email_status_expiry" ON "family_invitations"("email", "status", "expires_at");

-- AddForeignKey
ALTER TABLE "family_memberships" ADD CONSTRAINT "family_memberships_tree_id_fkey" FOREIGN KEY ("tree_id") REFERENCES "family_trees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "family_memberships" ADD CONSTRAINT "family_memberships_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "family_invitations" ADD CONSTRAINT "family_invitations_tree_id_fkey" FOREIGN KEY ("tree_id") REFERENCES "family_trees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "family_invitations" ADD CONSTRAINT "family_invitations_invited_by_fkey" FOREIGN KEY ("invited_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "family_invitations" ADD CONSTRAINT "family_invitations_accepted_by_fkey" FOREIGN KEY ("accepted_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

