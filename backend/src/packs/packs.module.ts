import { Module } from "@nestjs/common";
import { DiscordModule } from "../discord/discord.module";
import { FamiliesCoreModule } from "../families/families-core.module";
import { PacksController } from "./packs.controller";
import { PacksService } from "./packs.service";

@Module({
  imports: [DiscordModule, FamiliesCoreModule],
  controllers: [PacksController],
  providers: [PacksService],
  exports: [PacksService],
})
export class PacksModule {}
