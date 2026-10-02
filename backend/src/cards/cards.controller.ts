import { Get, Query } from "@nestjs/common";
import type { User } from "@prisma/client";
import { ApiAuthenticatedController } from "../auth/api-controller.decorators";
import { CurrentUser } from "../auth/current-user.decorator";
import type { AppLocale } from "../common/locale";
import { ApiLocalized, RequestLocale } from "../common/request-locale.decorator";
import { ApiEndpoint, ApiTag, UuidParam } from "../common/swagger";
import { CollectionService } from "./collection.service";
import {
  CardDetailDto,
  LeaderboardEntryDto,
  LeaderboardQueryDto,
} from "./dto/card.dto";

@ApiAuthenticatedController(ApiTag.Cards, "v1/cards")
export class CardsController {
  constructor(private readonly collection: CollectionService) {}

  @Get(":id")
  @ApiEndpoint({
    summary: "Get a card",
    description:
      "Full card, with the article's opening sentences and the caller's copies. A card that can no longer drop is only visible to its owners.",
    response: "Card returned",
    type: CardDetailDto,
    notFound: true,
  })
  @ApiLocalized()
  detail(
    @CurrentUser() user: User,
    @UuidParam("id", "Identifier of the card") id: string,
    @RequestLocale() locale: AppLocale,
  ): Promise<CardDetailDto> {
    return this.collection.detail(user.id, id, locale);
  }
}

@ApiAuthenticatedController(ApiTag.Leaderboard, "v1/leaderboard")
export class LeaderboardController {
  constructor(private readonly collection: CollectionService) {}

  @Get()
  @ApiEndpoint({
    summary: "Top collectors",
    description:
      "Ranked by the sum of the rarity points of every distinct card owned (COMMON 1, UNCOMMON 3, RARE 10, EPIC 30, LEGENDARY 100).",
    response: "Leaderboard returned",
    type: [LeaderboardEntryDto],
    validation: true,
  })
  leaderboard(
    @Query() query: LeaderboardQueryDto,
  ): Promise<LeaderboardEntryDto[]> {
    return this.collection.leaderboard(query.limit ?? 20);
  }
}
