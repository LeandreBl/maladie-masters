import { Get, HttpCode, HttpStatus, Post, Query } from "@nestjs/common";
import { ApiConflictResponse, ApiServiceUnavailableResponse } from "@nestjs/swagger";
import type { User } from "@prisma/client";
import { ApiAuthenticatedController } from "../auth/api-controller.decorators";
import { CurrentUser } from "../auth/current-user.decorator";
import { ApiErrorResponseDto } from "../common/dto/api-error-response.dto";
import type { AppLocale } from "../common/locale";
import { PageQueryDto } from "../common/pagination";
import { ApiLocalized, RequestLocale } from "../common/request-locale.decorator";
import { ApiEndpoint, ApiTag } from "../common/swagger";
import { ThrottlePacks } from "../common/throttling/throttling.module";
import {
  PackHistoryPageDto,
  PackOpeningDto,
  PackWalletDto,
} from "./dto/pack.dto";
import { PacksService } from "./packs.service";

@ApiAuthenticatedController(ApiTag.Packs, "v1/me/packs")
export class PacksController {
  constructor(private readonly packs: PacksService) {}

  @Get()
  @ApiEndpoint({
    summary: "Get the caller's pack wallet",
    description:
      "Computed from the clock on every call. Count down to `nextPackAt` rather than polling.",
    response: "Wallet returned",
    type: PackWalletDto,
  })
  wallet(@CurrentUser() user: User): Promise<PackWalletDto> {
    return this.packs.wallet(user.id);
  }

  @Post("open")
  @HttpCode(HttpStatus.OK)
  @ThrottlePacks()
  @ApiEndpoint({
    summary: "Open a pack",
    description: [
      "Spends a natural pack first, then a bonus one. Each slot draws a rarity from the drop weights,",
      "then a card of that rarity; the last slot is at least RARE when the guarantee is on.",
      "The response lists the cards in slot order, flags the ones new to the collection,",
      "and carries the wallet as it stands after the opening.",
    ].join(" "),
    response: "Pack opened",
    type: PackOpeningDto,
  })
  @ApiConflictResponse({
    description: "No pack left (`NO_PACK_AVAILABLE`). The message gives the next refill time.",
    type: ApiErrorResponseDto,
  })
  @ApiServiceUnavailableResponse({
    description: "No card can drop yet (`EMPTY_CATALOG`): the Wikipedia sync has not run.",
    type: ApiErrorResponseDto,
  })
  @ApiLocalized()
  open(
    @CurrentUser() user: User,
    @RequestLocale() locale: AppLocale,
  ): Promise<PackOpeningDto> {
    return this.packs.open(user.id, locale);
  }

  @Get("history")
  @ApiEndpoint({
    summary: "List the caller's past openings",
    description: "Newest first, with the cards each pack gave.",
    response: "Openings returned",
    type: PackHistoryPageDto,
    validation: true,
  })
  history(
    @CurrentUser() user: User,
    @Query() query: PageQueryDto,
    @RequestLocale() locale: AppLocale,
  ): Promise<PackHistoryPageDto> {
    return this.packs.history(user.id, query, locale);
  }
}
