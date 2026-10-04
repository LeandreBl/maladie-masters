-- CreateTable
CREATE TABLE "card_families" (
    "id" TEXT NOT NULL,
    "names" JSONB NOT NULL,
    "icon" TEXT,
    "bonus_points" INTEGER NOT NULL DEFAULT 0,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "position" INTEGER NOT NULL DEFAULT 0,
    "match" TEXT NOT NULL DEFAULT 'any',
    "rules" JSONB NOT NULL DEFAULT '[]',
    "included_card_ids" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "excluded_card_ids" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "resolved_at" TIMESTAMP(3),
    "resolve_error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "card_families_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "card_family_members" (
    "family_id" TEXT NOT NULL,
    "card_id" TEXT NOT NULL,

    CONSTRAINT "card_family_members_pkey" PRIMARY KEY ("family_id","card_id")
);

-- CreateIndex
CREATE INDEX "card_family_members_card_id_idx" ON "card_family_members"("card_id");

-- AddForeignKey
ALTER TABLE "card_family_members" ADD CONSTRAINT "card_family_members_family_id_fkey" FOREIGN KEY ("family_id") REFERENCES "card_families"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "card_family_members" ADD CONSTRAINT "card_family_members_card_id_fkey" FOREIGN KEY ("card_id") REFERENCES "cards"("id") ON DELETE CASCADE ON UPDATE CASCADE;

