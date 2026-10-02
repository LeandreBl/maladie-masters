import { Module } from "@nestjs/common";
import { CollectionService } from "./collection.service";
import { RarityRankingService } from "./rarity-ranking.service";

/**
 * The card services without their routes, for the contexts that have no HTTP
 * layer — the sync CLI — and so no authentication to guard them with.
 */
@Module({
  providers: [CollectionService, RarityRankingService],
  exports: [CollectionService, RarityRankingService],
})
export class CardsCoreModule {}
