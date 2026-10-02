import { Body, Get, HttpCode, HttpStatus, Patch, Post, Query } from "@nestjs/common";
import type { User } from "@prisma/client";
import { ApiAdminController } from "../auth/api-controller.decorators";
import { CurrentUser } from "../auth/current-user.decorator";
import type { AppLocale } from "../common/locale";
import { ApiLocalized, RequestLocale } from "../common/request-locale.decorator";
import { ApiEndpoint, ApiTag, UuidParam } from "../common/swagger";
import { AdminCardsService } from "./admin-cards.service";
import {
  AdminCardDetailDto,
  AdminCardsPageDto,
  AdminCardsQueryDto,
  RankingResultDto,
  UpdateAdminCardDto,
} from "./dto/admin-cards.dto";

@ApiAdminController(ApiTag.AdminCards, "v1/admin/cards")
export class AdminCardsController {
  constructor(private readonly cards: AdminCardsService) {}

  @Get()
  @ApiEndpoint({
    summary: "List the catalog",
    description: "Every card, droppable or not, with how many players own it.",
    response: "Cards returned",
    type: AdminCardsPageDto,
    validation: true,
  })
  list(
    @Query() query: AdminCardsQueryDto,
    @RequestLocale() locale: AppLocale,
  ): Promise<AdminCardsPageDto> {
    return this.cards.list(query, locale);
  }

  @Post("recompute-rarities")
  @HttpCode(HttpStatus.OK)
  @ApiEndpoint({
    summary: "Recompute rarities from the current pageviews",
    description:
      "The sync does it after every import; this is for a change to the rarity shares to apply without one. Pinned rarities are kept.",
    response: "Rarities recomputed",
    type: RankingResultDto,
  })
  recompute(@CurrentUser() actor: User): Promise<RankingResultDto> {
    return this.cards.recompute(actor);
  }

  @Get(":id")
  @ApiEndpoint({
    summary: "Get a card",
    response: "Card returned",
    type: AdminCardDetailDto,
    notFound: true,
  })
  @ApiLocalized()
  detail(
    @UuidParam("id", "Identifier of the card") id: string,
    @RequestLocale() locale: AppLocale,
  ): Promise<AdminCardDetailDto> {
    return this.cards.detail(id, locale);
  }

  @Patch(":id")
  @ApiEndpoint({
    summary: "Enable, disable or pin the rarity of a card",
    description:
      "A disabled card stops dropping; copies already owned are kept. `rarityOverride: null` hands the rarity back to the popularity ranking.",
    response: "Card updated",
    type: AdminCardDetailDto,
    validation: true,
    notFound: true,
  })
  @ApiLocalized()
  update(
    @CurrentUser() actor: User,
    @UuidParam("id", "Identifier of the card") id: string,
    @Body() dto: UpdateAdminCardDto,
    @RequestLocale() locale: AppLocale,
  ): Promise<AdminCardDetailDto> {
    return this.cards.update(actor, id, dto, locale);
  }
}
