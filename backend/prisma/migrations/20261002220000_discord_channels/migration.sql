-- A server can announce in several channels: the channels move to their own
-- table, keyed by the channel's snowflake, and the server keeps one row with
-- its language.

-- CreateTable
CREATE TABLE "discord_channels" (
    "channel_id" TEXT NOT NULL,
    "guild_id" TEXT NOT NULL,
    "setup_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "discord_channels_pkey" PRIMARY KEY ("channel_id")
);

-- CreateIndex
CREATE INDEX "discord_channels_guild_id_idx" ON "discord_channels"("guild_id");

-- AddForeignKey
ALTER TABLE "discord_channels" ADD CONSTRAINT "discord_channels_guild_id_fkey" FOREIGN KEY ("guild_id") REFERENCES "discord_guilds"("guild_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Copy the channel each server had picked.
INSERT INTO "discord_channels" ("channel_id", "guild_id", "setup_by", "created_at")
SELECT "channel_id", "guild_id", "setup_by", "updated_at" FROM "discord_guilds"
ON CONFLICT ("channel_id") DO NOTHING;

-- AlterTable
ALTER TABLE "discord_guilds" DROP COLUMN "channel_id",
DROP COLUMN "setup_by";
