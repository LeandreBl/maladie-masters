-- Announcements now follow the player's language, not the server's.
ALTER TABLE "discord_guilds" DROP COLUMN "locale";
