-- Discord bot: players link their Discord account with a short code, servers
-- pick a channel, and legendary drops are announced there with a mention.

-- CreateTable
CREATE TABLE "discord_accounts" (
    "user_id" TEXT NOT NULL,
    "discord_user_id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "announce" BOOLEAN NOT NULL DEFAULT true,
    "linked_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "discord_accounts_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "discord_link_codes" (
    "user_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "discord_link_codes_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "discord_guilds" (
    "guild_id" TEXT NOT NULL,
    "channel_id" TEXT NOT NULL,
    "locale" "Locale" NOT NULL DEFAULT 'en',
    "setup_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "discord_guilds_pkey" PRIMARY KEY ("guild_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "discord_accounts_discord_user_id_key" ON "discord_accounts"("discord_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "discord_link_codes_code_key" ON "discord_link_codes"("code");

-- AddForeignKey
ALTER TABLE "discord_accounts" ADD CONSTRAINT "discord_accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "discord_link_codes" ADD CONSTRAINT "discord_link_codes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
