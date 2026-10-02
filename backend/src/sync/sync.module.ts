import { Module } from "@nestjs/common";
import { CardsCoreModule } from "../cards/cards-core.module";
import { WikipediaModule } from "../wikipedia/wikipedia.module";
import { DiseaseSyncService } from "./disease-sync.service";

@Module({
  imports: [CardsCoreModule, WikipediaModule],
  providers: [DiseaseSyncService],
  exports: [DiseaseSyncService],
})
export class SyncModule {}
