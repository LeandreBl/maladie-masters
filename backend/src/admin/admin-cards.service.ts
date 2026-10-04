import { HttpStatus, Injectable } from "@nestjs/common";
import { Prisma, type User } from "@prisma/client";
import {
  CARD_INCLUDE,
  cardLabel,
  toCardDto,
  type LocalizedCard,
} from "../cards/card-mapper";
import { inIdOrder, nameSearch, pageIdsByName } from "../cards/localized-order";
import { fallbackChain, type AppLocale } from "../common/locale";
import { RarityRankingService, type RankingResult } from "../cards/rarity-ranking.service";
import { AppException } from "../common/app.exception";
import { ErrorCode } from "../common/error-code.enum";
import { pageWindow } from "../common/pagination";
import { familyName } from "../families/families.service";
import { AuditAction, AuditService } from "../audit/audit.service";
import { PrismaService } from "../prisma/prisma.service";
import type {
  AdminCardDetailDto,
  AdminCardDto,
  AdminCardsPageDto,
  AdminCardsQueryDto,
  UpdateAdminCardDto,
} from "./dto/admin-cards.dto";

const WEEK_MS = 7 * 24 * 60 * 60_000;

type CardWithOwners = LocalizedCard & { _count: { owners: number } };

const ADMIN_CARD_INCLUDE = {
  ...CARD_INCLUDE,
  _count: { select: { owners: true } },
} as const satisfies Prisma.CardInclude;

@Injectable()
export class AdminCardsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ranking: RarityRankingService,
    private readonly audit: AuditService,
  ) {}

  async list(
    query: AdminCardsQueryDto,
    locale: AppLocale,
  ): Promise<AdminCardsPageDto> {
    const { page, pageSize, skip, take } = pageWindow(query);

    const statuses: Record<NonNullable<AdminCardsQueryDto["status"]>, Prisma.CardWhereInput> = {
      all: {},
      enabled: { enabled: true, missingSince: null },
      disabled: { enabled: false },
      missing: { missingSince: { not: null } },
      overridden: { rarityOverride: { not: null } },
    };

    const base: Prisma.CardWhereInput[] = [];
    if (query.search) {
      base.push({
        OR: [
          nameSearch(query.search),
          {
            localizations: {
              some: { pageTitle: { contains: query.search, mode: "insensitive" } },
            },
          },
          { wikidataId: { equals: query.search.toUpperCase() } },
        ],
      });
    }
    if (query.rarity) base.push({ rarity: query.rarity });
    const where: Prisma.CardWhereInput = {
      AND: [...base, statuses[query.status ?? "all"]],
    };
    const countFor = (status: keyof typeof statuses) =>
      this.prisma.card.count({ where: { AND: [...base, statuses[status]] } });

    const orderBy: Prisma.CardOrderByWithRelationInput[] =
      query.sort === "number"
        ? [{ number: "asc" }]
        : query.sort === "owners"
          ? [{ owners: { _count: "desc" } }]
          : query.sort === "recent"
            ? [{ createdAt: "desc" }]
            : [{ pageviews: "desc" }];

    const loadPage = async (): Promise<{ cards: CardWithOwners[]; total: number }> => {
      if (query.sort === "name") {
        const ordered = await pageIdsByName(this.prisma, where, locale, skip, take);
        const cards = await this.prisma.card.findMany({
          where: { id: { in: ordered.ids } },
          include: ADMIN_CARD_INCLUDE,
        });
        return { cards: inIdOrder(ordered.ids, cards), total: ordered.total };
      }
      const [cards, total] = await Promise.all([
        this.prisma.card.findMany({
          where,
          include: ADMIN_CARD_INCLUDE,
          orderBy: [...orderBy, { number: "asc" }],
          skip,
          take,
        }),
        this.prisma.card.count({ where }),
      ]);
      return { cards, total };
    };

    const [{ cards, total }, all, enabled, disabled, missing, overridden] =
      await Promise.all([
        loadPage(),
        countFor("all"),
        countFor("enabled"),
        countFor("disabled"),
        countFor("missing"),
        countFor("overridden"),
      ]);

    return {
      items: cards.map((card) => this.toAdminCard(card, locale)),
      counts: { all, enabled, disabled, missing, overridden },
      total,
      page,
      pageSize,
    };
  }

  async detail(cardId: string, locale: AppLocale): Promise<AdminCardDetailDto> {
    const card = await this.find(cardId);
    const weekAgo = new Date(Date.now() - WEEK_MS);

    const [copies, drops, drops7d, families] = await Promise.all([
      this.prisma.userCard.aggregate({
        where: { cardId },
        _sum: { quantity: true },
      }),
      this.prisma.packOpeningCard.count({ where: { cardId } }),
      this.prisma.packOpeningCard.count({
        where: { cardId, opening: { createdAt: { gte: weekAgo } } },
      }),
      this.prisma.cardFamilyMember.findMany({
        where: { cardId },
        include: { family: true },
        orderBy: { family: { position: "asc" } },
      }),
    ]);

    const base = this.toAdminCard(card, locale);
    const order = fallbackChain(locale);
    return {
      ...base,
      extract:
        card.localizations.find((text) => text.locale === base.lang)?.extract ??
        null,
      localizations: [...card.localizations]
        .sort((a, b) => order.indexOf(a.locale) - order.indexOf(b.locale))
        .map((text) => ({
          locale: text.locale,
          name: text.name,
          pageTitle: text.pageTitle,
          wikipediaUrl: text.wikipediaUrl,
          description: text.description,
          extract: text.extract,
          pageviews: text.pageviews,
        })),
      icd10: card.icd10,
      copies: copies._sum.quantity ?? 0,
      drops,
      drops7d,
      lastSyncedAt: card.lastSyncedAt.toISOString(),
      families: families.map(({ family }) => ({
        id: family.id,
        name: familyName(family, locale),
        icon: family.icon,
        bonusPoints: family.bonusPoints,
        enabled: family.enabled,
      })),
    };
  }

  async update(
    actor: User,
    cardId: string,
    dto: UpdateAdminCardDto,
    locale: AppLocale,
  ): Promise<AdminCardDetailDto> {
    const card = await this.find(cardId);
    const data: Prisma.CardUpdateInput = {};

    if (dto.enabled !== undefined) {
      data.enabled = dto.enabled;
    }
    if (dto.rarityOverride !== undefined) {
      data.rarityOverride = dto.rarityOverride;
      data.rarity = dto.rarityOverride ?? card.popularityRarity;
    }

    if (Object.keys(data).length > 0) {
      await this.prisma.card.update({ where: { id: cardId }, data });
      await this.audit.record(actor.id, AuditAction.CardUpdated, {
        cardId,
        cardName: cardLabel(card),
        ...(dto.enabled !== undefined ? { enabled: dto.enabled } : {}),
        ...(dto.rarityOverride !== undefined
          ? { rarityOverride: dto.rarityOverride }
          : {}),
      });
    }

    return this.detail(cardId, locale);
  }

  async recompute(actor: User): Promise<RankingResult> {
    const result = await this.ranking.recompute();
    await this.audit.record(actor.id, AuditAction.RaritiesRecomputed, {
      ranked: result.ranked,
      changed: result.changed,
    });
    return result;
  }

  private async find(cardId: string): Promise<CardWithOwners> {
    const card = await this.prisma.card.findUnique({
      where: { id: cardId },
      include: ADMIN_CARD_INCLUDE,
    });
    if (!card) {
      throw new AppException(
        ErrorCode.CARD_NOT_FOUND,
        HttpStatus.NOT_FOUND,
        "Card not found",
      );
    }
    return card;
  }

  private toAdminCard(card: CardWithOwners, locale: AppLocale): AdminCardDto {
    const order = fallbackChain(locale);
    return {
      ...toCardDto(card, locale),
      wikidataId: card.wikidataId,
      languages: card.localizations
        .map((text) => text.locale)
        .sort((a, b) => order.indexOf(a) - order.indexOf(b)),
      popularityRarity: card.popularityRarity,
      rarityOverride: card.rarityOverride,
      enabled: card.enabled,
      missingSince: card.missingSince?.toISOString() ?? null,
      owners: card._count.owners,
      createdAt: card.createdAt.toISOString(),
    };
  }
}
