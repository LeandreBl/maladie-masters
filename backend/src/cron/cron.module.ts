import { Module } from "@nestjs/common";
import { SyncModule } from "../sync/sync.module";
import { CronService } from "./cron.service";

@Module({
  imports: [SyncModule],
  providers: [CronService],
})
export class CronModule {}
