import { Body, Delete, Get, HttpCode, HttpStatus, Post, Query } from "@nestjs/common";
import type { User } from "@prisma/client";
import { ApiAdminController } from "../auth/api-controller.decorators";
import { CurrentUser } from "../auth/current-user.decorator";
import { CollectionService } from "../cards/collection.service";
import {
  CollectionItemDto,
  CollectionPageDto,
  CollectionQueryDto,
} from "../cards/dto/card.dto";
import { ApiEndpoint, ApiTag, UuidParam } from "../common/swagger";
import { PackHistoryPageDto, PackWalletDto } from "../packs/dto/pack.dto";
import { PacksService } from "../packs/packs.service";
import type { AppLocale } from "../common/locale";
import { PageQueryDto } from "../common/pagination";
import { ApiLocalized, RequestLocale } from "../common/request-locale.decorator";
import { AdminUsersService } from "./admin-users.service";
import {
  AdminUserDetailDto,
  AdminUsersPageDto,
  AdminUsersQueryDto,
  CardRemovalDto,
  GrantPacksDto,
  SuspendUserDto,
  UnlockCardDto,
} from "./dto/admin-users.dto";

@ApiAdminController(ApiTag.AdminUsers, "v1/admin/users")
export class AdminUsersController {
  constructor(
    private readonly users: AdminUsersService,
    private readonly collection: CollectionService,
    private readonly packs: PacksService,
  ) {}

  @Get()
  @ApiEndpoint({
    summary: "List players",
    description: "The filter tabs' counts come with the page and follow the search.",
    response: "Players returned",
    type: AdminUsersPageDto,
    validation: true,
  })
  list(@Query() query: AdminUsersQueryDto): Promise<AdminUsersPageDto> {
    return this.users.list(query);
  }

  @Get(":id")
  @ApiEndpoint({
    summary: "Get a player",
    description: "Wallet, collection progress, recent openings and the audit trail.",
    response: "Player returned",
    type: AdminUserDetailDto,
    notFound: true,
  })
  @ApiLocalized()
  detail(
    @UuidParam("id", "Identifier of the player") id: string,
    @RequestLocale() locale: AppLocale,
  ): Promise<AdminUserDetailDto> {
    return this.users.detail(id, locale);
  }

  @Get(":id/cards")
  @ApiEndpoint({
    summary: "Browse a player's collection",
    description: "Same listing as `GET /v1/me/collection`, seen as that player.",
    response: "Collection page returned",
    type: CollectionPageDto,
    validation: true,
  })
  cards(
    @UuidParam("id", "Identifier of the player") id: string,
    @Query() query: CollectionQueryDto,
    @RequestLocale() locale: AppLocale,
  ): Promise<CollectionPageDto> {
    return this.collection.page(id, query, locale);
  }

  @Get(":id/packs/history")
  @ApiEndpoint({
    summary: "List a player's openings",
    response: "Openings returned",
    type: PackHistoryPageDto,
    validation: true,
  })
  history(
    @UuidParam("id", "Identifier of the player") id: string,
    @Query() query: PageQueryDto,
    @RequestLocale() locale: AppLocale,
  ): Promise<PackHistoryPageDto> {
    return this.packs.history(id, query, locale);
  }

  @Post(":id/packs")
  @HttpCode(HttpStatus.OK)
  @ApiEndpoint({
    summary: "Grant bonus packs",
    description:
      "Bonus packs sit on top of the timer's cap and are spent after the natural ones. A negative amount takes some back, never below zero.",
    response: "Wallet after the grant",
    type: PackWalletDto,
    validation: true,
    notFound: true,
  })
  grantPacks(
    @CurrentUser() actor: User,
    @UuidParam("id", "Identifier of the player") id: string,
    @Body() dto: GrantPacksDto,
  ): Promise<PackWalletDto> {
    return this.users.grantPacks(actor, id, dto.amount, dto.note);
  }

  @Post(":id/packs/refill")
  @HttpCode(HttpStatus.OK)
  @ApiEndpoint({
    summary: "Refill the timer packs to the cap",
    response: "Wallet after the refill",
    type: PackWalletDto,
    notFound: true,
  })
  refill(
    @CurrentUser() actor: User,
    @UuidParam("id", "Identifier of the player") id: string,
  ): Promise<PackWalletDto> {
    return this.users.refillPacks(actor, id);
  }

  @Post(":id/cards")
  @HttpCode(HttpStatus.OK)
  @ApiEndpoint({
    summary: "Unlock a card for a player",
    description: "Adds copies to the collection, disabled or missing cards included — shiny ones with `shiny: true`.",
    response: "Collection entry after the unlock",
    type: CollectionItemDto,
    validation: true,
    notFound: true,
  })
  @ApiLocalized()
  unlock(
    @CurrentUser() actor: User,
    @UuidParam("id", "Identifier of the player") id: string,
    @Body() dto: UnlockCardDto,
    @RequestLocale() locale: AppLocale,
  ): Promise<CollectionItemDto> {
    return this.users.unlockCard(
      actor,
      id,
      dto.cardId,
      dto.quantity ?? 1,
      dto.shiny ?? false,
      locale,
    );
  }

  @Delete(":id/cards/:cardId")
  @ApiEndpoint({
    summary: "Lock a card again",
    description: "Removes every copy of the card from the player's collection.",
    response: "Card removed",
    type: CardRemovalDto,
    notFound: true,
  })
  lock(
    @CurrentUser() actor: User,
    @UuidParam("id", "Identifier of the player") id: string,
    @UuidParam("cardId", "Identifier of the card") cardId: string,
  ): Promise<CardRemovalDto> {
    return this.users.lockCard(actor, id, cardId);
  }

  @Post(":id/suspend")
  @HttpCode(HttpStatus.OK)
  @ApiEndpoint({
    summary: "Suspend a player",
    description: "Every request from the player is refused with `ACCOUNT_SUSPENDED` until reactivated. The collection is kept.",
    response: "Player suspended",
    type: AdminUserDetailDto,
    validation: true,
    notFound: true,
    forbidden: "Admins cannot be suspended (`ADMIN_SUSPENSION_FORBIDDEN`).",
  })
  @ApiLocalized()
  suspend(
    @CurrentUser() actor: User,
    @UuidParam("id", "Identifier of the player") id: string,
    @Body() dto: SuspendUserDto,
    @RequestLocale() locale: AppLocale,
  ): Promise<AdminUserDetailDto> {
    return this.users.suspend(actor, id, dto.reason, locale);
  }

  @Post(":id/reactivate")
  @HttpCode(HttpStatus.OK)
  @ApiEndpoint({
    summary: "Lift a suspension",
    response: "Player reactivated",
    type: AdminUserDetailDto,
    notFound: true,
  })
  @ApiLocalized()
  reactivate(
    @CurrentUser() actor: User,
    @UuidParam("id", "Identifier of the player") id: string,
    @RequestLocale() locale: AppLocale,
  ): Promise<AdminUserDetailDto> {
    return this.users.reactivate(actor, id, locale);
  }
}
