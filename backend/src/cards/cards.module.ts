import { Module } from "@nestjs/common";
import { CardsController, LeaderboardController } from "./cards.controller";
import { CardsCoreModule } from "./cards-core.module";

@Module({
  imports: [CardsCoreModule],
  controllers: [CardsController, LeaderboardController],
  exports: [CardsCoreModule],
})
export class CardsModule {}
