import { Module } from "@nestjs/common";
import { CardsModule } from "../cards/cards.module";
import { PacksModule } from "../packs/packs.module";
import { SyncModule } from "../sync/sync.module";
import { AdminAccessController } from "./admin-access.controller";
import { AdminAccessService } from "./admin-access.service";
import { AdminCardsController } from "./admin-cards.controller";
import { AdminCardsService } from "./admin-cards.service";
import { AdminSettingsController } from "./admin-settings.controller";
import { AdminStatsController } from "./admin-stats.controller";
import { AdminStatsService } from "./admin-stats.service";
import { AdminSyncController } from "./admin-sync.controller";
import { AdminUsersController } from "./admin-users.controller";
import { AdminUsersService } from "./admin-users.service";

@Module({
  imports: [CardsModule, PacksModule, SyncModule],
  controllers: [
    AdminUsersController,
    AdminCardsController,
    AdminStatsController,
    AdminSyncController,
    AdminSettingsController,
    AdminAccessController,
  ],
  providers: [
    AdminUsersService,
    AdminCardsService,
    AdminStatsService,
    AdminAccessService,
  ],
})
export class AdminModule {}
