-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('USER', 'ADMIN');

-- CreateEnum
CREATE TYPE "Rarity" AS ENUM ('COMMON', 'UNCOMMON', 'RARE', 'EPIC', 'LEGENDARY');

-- CreateEnum
CREATE TYPE "PackSource" AS ENUM ('NATURAL', 'BONUS');

-- CreateEnum
CREATE TYPE "SyncRunStatus" AS ENUM ('RUNNING', 'SUCCEEDED', 'FAILED');

-- CreateEnum
CREATE TYPE "SyncTrigger" AS ENUM ('SCHEDULE', 'MANUAL');

-- CreateTable
CREATE TABLE "admin_audit_entries" (
    "id" TEXT NOT NULL,
    "actor_id" TEXT,
    "target_user_id" TEXT,
    "action" TEXT NOT NULL,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_audit_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_grants" (
    "email" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_grants_pkey" PRIMARY KEY ("email")
);

-- CreateTable
CREATE TABLE "cards" (
    "id" TEXT NOT NULL,
    "number" SERIAL NOT NULL,
    "wikidata_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "page_title" TEXT NOT NULL,
    "wikipedia_url" TEXT NOT NULL,
    "description" TEXT,
    "extract" TEXT,
    "image_url" TEXT,
    "icd10" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "pageviews" INTEGER NOT NULL DEFAULT 0,
    "popularity_rank" INTEGER,
    "popularity_rarity" "Rarity" NOT NULL DEFAULT 'COMMON',
    "rarity_override" "Rarity",
    "rarity" "Rarity" NOT NULL DEFAULT 'COMMON',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "missing_since" TIMESTAMP(3),
    "last_synced_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "disease_sync_runs" (
    "id" TEXT NOT NULL,
    "status" "SyncRunStatus" NOT NULL DEFAULT 'RUNNING',
    "trigger" "SyncTrigger" NOT NULL,
    "triggered_by_id" TEXT,
    "phase" TEXT,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" TIMESTAMP(3),
    "fetched" INTEGER NOT NULL DEFAULT 0,
    "created" INTEGER NOT NULL DEFAULT 0,
    "updated" INTEGER NOT NULL DEFAULT 0,
    "missing" INTEGER NOT NULL DEFAULT 0,
    "restored" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "log" JSONB NOT NULL DEFAULT '[]',

    CONSTRAINT "disease_sync_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "game_settings" (
    "id" TEXT NOT NULL DEFAULT 'global',
    "pack_interval_minutes" INTEGER NOT NULL DEFAULT 10,
    "pack_max_stored" INTEGER NOT NULL DEFAULT 10,
    "cards_per_pack" INTEGER NOT NULL DEFAULT 5,
    "guaranteed_rare_slot" BOOLEAN NOT NULL DEFAULT true,
    "drop_weight_common" DOUBLE PRECISION NOT NULL DEFAULT 60,
    "drop_weight_uncommon" DOUBLE PRECISION NOT NULL DEFAULT 25,
    "drop_weight_rare" DOUBLE PRECISION NOT NULL DEFAULT 10,
    "drop_weight_epic" DOUBLE PRECISION NOT NULL DEFAULT 4,
    "drop_weight_legendary" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "share_legendary" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "share_epic" DOUBLE PRECISION NOT NULL DEFAULT 4,
    "share_rare" DOUBLE PRECISION NOT NULL DEFAULT 10,
    "share_uncommon" DOUBLE PRECISION NOT NULL DEFAULT 25,
    "sync_enabled" BOOLEAN NOT NULL DEFAULT true,
    "sync_interval_hours" INTEGER NOT NULL DEFAULT 24,
    "pageviews_window_days" INTEGER NOT NULL DEFAULT 60,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "game_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pack_openings" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "source" "PackSource" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pack_openings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pack_opening_cards" (
    "id" TEXT NOT NULL,
    "opening_id" TEXT NOT NULL,
    "card_id" TEXT NOT NULL,
    "slot" INTEGER NOT NULL,
    "rarity" "Rarity" NOT NULL,
    "is_new" BOOLEAN NOT NULL,

    CONSTRAINT "pack_opening_cards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_cards" (
    "user_id" TEXT NOT NULL,
    "card_id" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "first_obtained_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_obtained_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_cards_pkey" PRIMARY KEY ("user_id","card_id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "firebase_uid" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "display_name" TEXT,
    "photo_url" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'USER',
    "suspended_at" TIMESTAMP(3),
    "suspended_reason" TEXT,
    "packs_stored" INTEGER NOT NULL DEFAULT 0,
    "packs_anchor_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "bonus_packs" INTEGER NOT NULL DEFAULT 0,
    "last_seen_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "admin_audit_entries_target_user_id_created_at_idx" ON "admin_audit_entries"("target_user_id", "created_at");

-- CreateIndex
CREATE INDEX "admin_audit_entries_created_at_idx" ON "admin_audit_entries"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "cards_number_key" ON "cards"("number");

-- CreateIndex
CREATE UNIQUE INDEX "cards_wikidata_id_key" ON "cards"("wikidata_id");

-- CreateIndex
CREATE INDEX "cards_rarity_enabled_idx" ON "cards"("rarity", "enabled");

-- CreateIndex
CREATE INDEX "cards_pageviews_idx" ON "cards"("pageviews");

-- CreateIndex
CREATE INDEX "cards_name_idx" ON "cards"("name");

-- CreateIndex
CREATE INDEX "disease_sync_runs_started_at_idx" ON "disease_sync_runs"("started_at");

-- CreateIndex
CREATE INDEX "disease_sync_runs_status_idx" ON "disease_sync_runs"("status");

-- CreateIndex
CREATE INDEX "pack_openings_user_id_created_at_idx" ON "pack_openings"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "pack_openings_created_at_idx" ON "pack_openings"("created_at");

-- CreateIndex
CREATE INDEX "pack_opening_cards_opening_id_idx" ON "pack_opening_cards"("opening_id");

-- CreateIndex
CREATE INDEX "pack_opening_cards_card_id_idx" ON "pack_opening_cards"("card_id");

-- CreateIndex
CREATE INDEX "user_cards_card_id_idx" ON "user_cards"("card_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_firebase_uid_key" ON "users"("firebase_uid");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_created_at_idx" ON "users"("created_at");

-- CreateIndex
CREATE INDEX "users_last_seen_at_idx" ON "users"("last_seen_at");

-- AddForeignKey
ALTER TABLE "admin_audit_entries" ADD CONSTRAINT "admin_audit_entries_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin_audit_entries" ADD CONSTRAINT "admin_audit_entries_target_user_id_fkey" FOREIGN KEY ("target_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "disease_sync_runs" ADD CONSTRAINT "disease_sync_runs_triggered_by_id_fkey" FOREIGN KEY ("triggered_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pack_openings" ADD CONSTRAINT "pack_openings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pack_opening_cards" ADD CONSTRAINT "pack_opening_cards_opening_id_fkey" FOREIGN KEY ("opening_id") REFERENCES "pack_openings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pack_opening_cards" ADD CONSTRAINT "pack_opening_cards_card_id_fkey" FOREIGN KEY ("card_id") REFERENCES "cards"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_cards" ADD CONSTRAINT "user_cards_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_cards" ADD CONSTRAINT "user_cards_card_id_fkey" FOREIGN KEY ("card_id") REFERENCES "cards"("id") ON DELETE CASCADE ON UPDATE CASCADE;
