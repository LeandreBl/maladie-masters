-- Cards become language-neutral: everything that depends on the Wikipedia
-- they came from moves to one localization row per language. The catalog was
-- French-only until now, so the existing columns become the `fr` rows.

-- CreateEnum
CREATE TYPE "Locale" AS ENUM ('fr', 'en', 'zh');

-- CreateTable
CREATE TABLE "card_localizations" (
    "card_id" TEXT NOT NULL,
    "locale" "Locale" NOT NULL,
    "name" TEXT NOT NULL,
    "page_title" TEXT NOT NULL,
    "wikipedia_url" TEXT NOT NULL,
    "description" TEXT,
    "extract" TEXT,
    "pageviews" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "card_localizations_pkey" PRIMARY KEY ("card_id","locale")
);

-- CreateIndex
CREATE INDEX "card_localizations_locale_name_idx" ON "card_localizations"("locale", "name");

-- AddForeignKey
ALTER TABLE "card_localizations" ADD CONSTRAINT "card_localizations_card_id_fkey" FOREIGN KEY ("card_id") REFERENCES "cards"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Keep what the French import already fetched.
INSERT INTO "card_localizations" ("card_id", "locale", "name", "page_title", "wikipedia_url", "description", "extract", "pageviews")
SELECT "id", 'fr', "name", "page_title", "wikipedia_url", "description", "extract", "pageviews"
FROM "cards";

-- DropIndex
DROP INDEX "cards_name_idx";

-- AlterTable
ALTER TABLE "cards" DROP COLUMN "description",
DROP COLUMN "extract",
DROP COLUMN "name",
DROP COLUMN "page_title",
DROP COLUMN "wikipedia_url";

-- AlterTable: new accounts default to English, the accounts created while
-- the game was French-only keep French.
ALTER TABLE "users" ADD COLUMN "locale" "Locale" NOT NULL DEFAULT 'en';
UPDATE "users" SET "locale" = 'fr';
