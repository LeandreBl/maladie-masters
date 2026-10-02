import { HttpStatus, Injectable } from "@nestjs/common";
import { Prisma, UserRole, type User } from "@prisma/client";
import { CollectionService } from "../cards/collection.service";
import { AppException } from "../common/app.exception";
import { ErrorCode } from "../common/error-code.enum";
import { pageWindow } from "../common/pagination";
import { AuditAction, AuditService } from "../audit/audit.service";
import { PacksService } from "../packs/packs.service";
import type { PackWalletDto } from "../packs/dto/pack.dto";
import { PrismaService } from "../prisma/prisma.service";
import { RealtimeService } from "../realtime/realtime.service";
import { GameSettingsService } from "../settings/game-settings.service";
import { CARD_INCLUDE, cardLabel, toCollectionItem } from "../cards/card-mapper";
import type { AppLocale } from "../common/locale";
import type { CollectionItemDto } from "../cards/dto/card.dto";
import type {
  AdminUserDetailDto,
  AdminUserRowDto,
  AdminUsersPageDto,
  AdminUsersQueryDto,
  CardRemovalDto,
} from "./dto/admin-users.dto";

const WEEK_MS = 7 * 24 * 60 * 60_000;

type UserWithCounts = User & {
  _count: { cards: number; packOpenings: number };
};

@Injectable()
export class AdminUsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly packs: PacksService,
    private readonly collection: CollectionService,
    private readonly settings: GameSettingsService,
    private readonly audit: AuditService,
    private readonly realtime: RealtimeService,
  ) {}

  async list(query: AdminUsersQueryDto): Promise<AdminUsersPageDto> {
    const { page, pageSize, skip, take } = pageWindow(query);
    const weekAgo = new Date(Date.now() - WEEK_MS);

    const filters: Record<NonNullable<AdminUsersQueryDto["filter"]>, Prisma.UserWhereInput> = {
      all: {},
      admins: { role: UserRole.ADMIN },
      suspended: { suspendedAt: { not: null } },
      active7d: { lastSeenAt: { gte: weekAgo } },
    };
    const search: Prisma.UserWhereInput = query.search
      ? {
          OR: [
            { email: { contains: query.search, mode: "insensitive" } },
            { displayName: { contains: query.search, mode: "insensitive" } },
          ],
        }
      : {};
    const where: Prisma.UserWhereInput = {
      AND: [search, filters[query.filter ?? "all"]],
    };

    const orderBy: Prisma.UserOrderByWithRelationInput[] =
      query.sort === "createdAt"
        ? [{ createdAt: "desc" }]
        : query.sort === "cards"
          ? [{ cards: { _count: "desc" } }]
          : query.sort === "packs"
            ? [{ packOpenings: { _count: "desc" } }]
            : [{ lastSeenAt: { sort: "desc", nulls: "last" } }];

    const [users, total, all, admins, suspended, active7d, settings] =
      await Promise.all([
        this.prisma.user.findMany({
          where,
          include: { _count: { select: { cards: true, packOpenings: true } } },
          orderBy: [...orderBy, { email: "asc" }],
          skip,
          take,
        }),
        this.prisma.user.count({ where }),
        this.prisma.user.count({ where: { AND: [search, filters.all] } }),
        this.prisma.user.count({ where: { AND: [search, filters.admins] } }),
        this.prisma.user.count({ where: { AND: [search, filters.suspended] } }),
        this.prisma.user.count({ where: { AND: [search, filters.active7d] } }),
        this.settings.get(),
      ]);

    const now = new Date();
    return {
      items: users.map((user) =>
        this.toRow(user, this.packs.toWalletDto(user, settings, now)),
      ),
      counts: { all, admins, suspended, active7d },
      total,
      page,
      pageSize,
    };
  }

  async detail(userId: string, locale: AppLocale): Promise<AdminUserDetailDto> {
    const user = await this.findWithCounts(userId);
    const weekAgo = new Date(Date.now() - WEEK_MS);

    const [wallet, collection, opened7d, lastOpening, history, audit] =
      await Promise.all([
        this.packs.wallet(userId),
        this.collection.summary(userId),
        this.prisma.packOpening.count({
          where: { userId, createdAt: { gte: weekAgo } },
        }),
        this.prisma.packOpening.findFirst({
          where: { userId },
          orderBy: { createdAt: "desc" },
          select: { createdAt: true },
        }),
        this.packs.history(userId, { page: 1, pageSize: 10 }, locale),
        this.audit.page({ page: 1, pageSize: 20 }, userId),
      ]);

    return {
      ...this.toRow(user, wallet),
      suspendedReason: user.suspendedReason,
      wallet,
      collection,
      stats: {
        packsOpened: user._count.packOpenings,
        packsOpened7d: opened7d,
        lastOpenedAt: lastOpening?.createdAt.toISOString() ?? null,
      },
      recentOpenings: history.items,
      audit: audit.items,
    };
  }

  async grantPacks(
    actor: User,
    userId: string,
    amount: number,
    note?: string,
  ): Promise<PackWalletDto> {
    await this.findWithCounts(userId);
    const wallet = await this.packs.grantBonus(userId, amount);
    await this.audit.record(
      actor.id,
      AuditAction.PacksGranted,
      { amount, note: note ?? null, bonusAfter: wallet.bonus },
      userId,
    );
    this.realtime.toUser(userId, {
      type: "packs.granted",
      data: { amount, note: note ?? null, wallet },
    });
    return wallet;
  }

  async refillPacks(actor: User, userId: string): Promise<PackWalletDto> {
    await this.findWithCounts(userId);
    const wallet = await this.packs.refill(userId);
    await this.audit.record(
      actor.id,
      AuditAction.PacksRefilled,
      { natural: wallet.natural },
      userId,
    );
    this.realtime.toUser(userId, { type: "packs.refilled", data: { wallet } });
    return wallet;
  }

  async unlockCard(
    actor: User,
    userId: string,
    cardId: string,
    quantity: number,
    shiny: boolean,
    locale: AppLocale,
  ): Promise<CollectionItemDto> {
    await this.findWithCounts(userId);
    const card = await this.prisma.card.findUnique({
      where: { id: cardId },
      include: CARD_INCLUDE,
    });
    if (!card) {
      throw new AppException(
        ErrorCode.CARD_NOT_FOUND,
        HttpStatus.NOT_FOUND,
        "Card not found",
      );
    }

    const now = new Date();
    const copy = await this.prisma.userCard.upsert({
      where: { userId_cardId: { userId, cardId } },
      create: {
        userId,
        cardId,
        quantity,
        shinyQuantity: shiny ? quantity : 0,
        firstObtainedAt: now,
        lastObtainedAt: now,
      },
      update: {
        quantity: { increment: quantity },
        ...(shiny ? { shinyQuantity: { increment: quantity } } : {}),
        lastObtainedAt: now,
      },
    });

    await this.audit.record(
      actor.id,
      AuditAction.CardUnlocked,
      { cardId, cardName: cardLabel(card), rarity: card.rarity, quantity, shiny },
      userId,
    );
    this.realtime.toUser(userId, {
      type: "card.granted",
      data: { cardId, quantity, shiny },
    });
    return toCollectionItem(card, locale, copy);
  }

  /** Takes every copy of a card out of a collection. */
  async lockCard(
    actor: User,
    userId: string,
    cardId: string,
  ): Promise<CardRemovalDto> {
    await this.findWithCounts(userId);
    const copy = await this.prisma.userCard.findUnique({
      where: { userId_cardId: { userId, cardId } },
      include: { card: { include: CARD_INCLUDE } },
    });
    if (!copy) {
      throw new AppException(
        ErrorCode.CARD_NOT_OWNED,
        HttpStatus.NOT_FOUND,
        "This player does not own this card",
      );
    }

    await this.prisma.userCard.delete({
      where: { userId_cardId: { userId, cardId } },
    });
    await this.audit.record(
      actor.id,
      AuditAction.CardLocked,
      { cardId, cardName: cardLabel(copy.card), quantity: copy.quantity },
      userId,
    );
    this.realtime.toUser(userId, { type: "card.removed", data: { cardId } });
    return { cardId, removed: true };
  }

  async suspend(
    actor: User,
    userId: string,
    reason: string,
    locale: AppLocale,
  ): Promise<AdminUserDetailDto> {
    const user = await this.findWithCounts(userId);
    // Suspension is checked on every request: suspending an admin — oneself
    // included — would lock them out of the panel that lifts it.
    if (user.role === UserRole.ADMIN) {
      throw new AppException(
        ErrorCode.ADMIN_SUSPENSION_FORBIDDEN,
        HttpStatus.FORBIDDEN,
        "Admins cannot be suspended; revoke the admin grant first",
      );
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { suspendedAt: new Date(), suspendedReason: reason },
    });
    await this.audit.record(actor.id, AuditAction.UserSuspended, { reason }, userId);
    // The API refuses the player from the next request on; the open sockets
    // are cut too, and their reconnection is refused at the ticket.
    this.realtime.disconnect(userId);
    return this.detail(userId, locale);
  }

  async reactivate(
    actor: User,
    userId: string,
    locale: AppLocale,
  ): Promise<AdminUserDetailDto> {
    await this.findWithCounts(userId);
    await this.prisma.user.update({
      where: { id: userId },
      data: { suspendedAt: null, suspendedReason: null },
    });
    await this.audit.record(actor.id, AuditAction.UserReactivated, {}, userId);
    return this.detail(userId, locale);
  }

  private async findWithCounts(userId: string): Promise<UserWithCounts> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { _count: { select: { cards: true, packOpenings: true } } },
    });
    if (!user) {
      throw new AppException(
        ErrorCode.USER_NOT_FOUND,
        HttpStatus.NOT_FOUND,
        "User not found",
      );
    }
    return user;
  }

  private toRow(user: UserWithCounts, wallet: PackWalletDto): AdminUserRowDto {
    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      photoUrl: user.photoUrl,
      role: user.role,
      locale: user.locale,
      suspendedAt: user.suspendedAt?.toISOString() ?? null,
      lastSeenAt: user.lastSeenAt?.toISOString() ?? null,
      createdAt: user.createdAt.toISOString(),
      uniqueCards: user._count.cards,
      packsOpened: user._count.packOpenings,
      packsAvailable: wallet.available,
    };
  }
}
