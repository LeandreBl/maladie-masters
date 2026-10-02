import { Module } from "@nestjs/common";
import { DiscordAnnouncerService } from "./discord-announcer.service";
import { DiscordApiService } from "./discord-api.service";
import { DiscordInteractionsController } from "./discord-interactions.controller";
import { DiscordInteractionsService } from "./discord-interactions.service";
import { DiscordLinkService } from "./discord-link.service";
import { DiscordController } from "./discord.controller";

@Module({
  controllers: [DiscordController, DiscordInteractionsController],
  providers: [
    DiscordApiService,
    DiscordLinkService,
    DiscordInteractionsService,
    DiscordAnnouncerService,
  ],
  exports: [DiscordAnnouncerService],
})
export class DiscordModule {}
