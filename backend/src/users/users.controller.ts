import { Body, Get, Patch, Query } from "@nestjs/common";
import type { User } from "@prisma/client";
import { ApiAuthenticatedController } from "../auth/api-controller.decorators";
import { CurrentUser } from "../auth/current-user.decorator";
import { CollectionService } from "../cards/collection.service";
import {
  CollectionPageDto,
  CollectionQueryDto,
  CollectionSummaryDto,
  FamilyProgressDto,
} from "../cards/dto/card.dto";
import { FamiliesService } from "../families/families.service";
import type { AppLocale } from "../common/locale";
import { ApiLocalized, RequestLocale } from "../common/request-locale.decorator";
import { ApiEndpoint, ApiTag } from "../common/swagger";
import { MeDto, UpdateMeDto } from "./dto/me.dto";
import { UsersService } from "./users.service";

@ApiAuthenticatedController(ApiTag.Me, "v1/me")
export class UsersController {
  constructor(
    private readonly users: UsersService,
    private readonly collection: CollectionService,
    private readonly families: FamiliesService,
  ) {}

  @Get()
  @ApiEndpoint({
    summary: "Get the current player",
    description:
      "Creates the player on the very first call. Carries the pack wallet and the collection summary, which is everything a home screen needs.",
    response: "Current player returned",
    type: MeDto,
  })
  me(@CurrentUser() user: User): Promise<MeDto> {
    return this.users.me(user.id);
  }

  @Patch()
  @ApiEndpoint({
    summary: "Update the current player's profile",
    response: "Profile updated",
    type: MeDto,
    validation: true,
  })
  update(@CurrentUser() user: User, @Body() dto: UpdateMeDto): Promise<MeDto> {
    return this.users.update(user.id, dto);
  }

  @Get("collection")
  @ApiEndpoint({
    summary: "Browse the catalog with the caller's copies",
    description: [
      "Every card that can drop, plus the cards the caller owns that no longer can.",
      "`quantity` is 0 for a card not collected yet: render it face down.",
    ].join(" "),
    response: "Collection page returned",
    type: CollectionPageDto,
    validation: true,
  })
  collectionPage(
    @CurrentUser() user: User,
    @Query() query: CollectionQueryDto,
    @RequestLocale() locale: AppLocale,
  ): Promise<CollectionPageDto> {
    return this.collection.page(user.id, query, locale);
  }

  @Get("collection/summary")
  @ApiEndpoint({
    summary: "Get the caller's completion per rarity",
    response: "Summary returned",
    type: CollectionSummaryDto,
  })
  summary(@CurrentUser() user: User): Promise<CollectionSummaryDto> {
    return this.collection.summary(user.id);
  }

  @Get("families")
  @ApiEndpoint({
    summary: "Get the caller's progress in every family",
    description:
      "Families are themed sets of cards (cancers, mental disorders…). Owning every droppable member of one adds its `bonusPoints` to the score. Filter the collection with `?family=` to browse one.",
    response: "Families returned",
    type: [FamilyProgressDto],
  })
  @ApiLocalized()
  familyProgress(
    @CurrentUser() user: User,
    @RequestLocale() locale: AppLocale,
  ): Promise<FamilyProgressDto[]> {
    return this.families.progress(user.id, locale);
  }
}
