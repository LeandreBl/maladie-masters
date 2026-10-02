import { HttpStatus, Injectable } from "@nestjs/common";
import { Prisma, Rarity } from "@prisma/client";
import { AppException } from "../common/app.exception";
import { ErrorCode } from "../common/error-code.enum";
import type { AppLocale } from "../common/locale";
import { pageWindow } from "../common/pagination";
import { PrismaService } from "../prisma/prisma.service";
import {
  CARD_INCLUDE,
  toCardDto,
  toCollectionItem,
  type LocalizedCard,
} from "./card-mapper";
import type {
  CardDetailDto,
  CollectionPageDto,
  CollectionQueryDto,
  CollectionSummaryDto,
  LeaderboardEntryDto,
} from "./dto/card.dto";
import { inIdOrder, nameSearch, pageIdsByName } from "./localized-order";
import { RARITIES, RARITY_SCORE } from "./rarity";

/** A card can drop: enabled, and still found in Wikidata. */
export const DROPPABLE: Prisma.CardWhereInput = {
  enabled: true,
  missingSince: null,
};

/** `CASE` mapping a rarity to its leaderboard points, for raw queries. */
const SCORE_SQL = Prisma.raw(
  `CASE c.rarity ${RARITIES.map(
    (rarity) => `WHEN '${rarity}' THEN ${RARITY_SCORE[rarity]}`,
  ).join(" ")} ELSE 0 END`,
);

/**
 * A player's view of the catalog. Shared by the player routes and by the admin
 * panel, which shows the same collection for any player.
 */
@Injectable()
export class CollectionService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * The catalog, with the player's copies attached.
   *
   * A card that cannot drop any more is only listed to the players who own it:
   * everyone else would see a card they have no way to get.
   */
  async page(
    userId: string,
    query: CollectionQueryDto,
    locale: AppLocale,
  ): Promise<CollectionPageDto> {
    const { page, pageSize, skip, take } = pageWindow(query);
    const owned =
      query.owned === "shiny"
        ? "shiny"
        : query.sort === "recent"
          ? "owned"
          : (query.owned ?? "all");

    const filters: Prisma.CardWhereInput[] = [
      { OR: [DROPPABLE, { owners: { some: { userId } } }] },
    ];
    if (query.search) {
      filters.push(nameSearch(query.search));
    }
    if (query.rarity) {
      filters.push({ rarity: query.rarity });
    }
    if (owned === "owned") {
      filters.push({ owners: { some: { userId } } });
    } else if (owned === "missing") {
      filters.push({ owners: { none: { userId } } });
    } else if (owned === "shiny") {
      filters.push({ owners: { some: { userId, shinyQuantity: { gt: 0 } } } });
    }
    const where: Prisma.CardWhereInput = { AND: filters };

    if (query.sort === "recent") {
      const [rows, total] = await this.prisma.$transaction([
        this.prisma.userCard.findMany({
          where: { userId, card: where },
          include: { card: { include: CARD_INCLUDE } },
          orderBy: [{ lastObtainedAt: "desc" }, { cardId: "asc" }],
          skip,
          take,
        }),
        this.prisma.userCard.count({ where: { userId, card: where } }),
      ]);

      return {
        items: rows.map((row) => toCollectionItem(row.card, locale, row)),
        total,
        page,
        pageSize,
      };
    }

    let cards: LocalizedCard[];
    let total: number;

    if (query.sort === "name") {
      const ordered = await pageIdsByName(this.prisma, where, locale, skip, take);
      cards = inIdOrder(ordered.ids, await this.findCards({ id: { in: ordered.ids } }));
      total = ordered.total;
    } else {
      const orderBy: Prisma.CardOrderByWithRelationInput[] =
        query.sort === "rarity"
          ? [{ rarity: "desc" }, { pageviews: "desc" }]
          : query.sort === "popularity"
            ? [{ pageviews: "desc" }]
            : [{ number: "asc" }];

      [cards, total] = await Promise.all([
        this.findCards(where, [...orderBy, { number: "asc" }], skip, take),
        this.prisma.card.count({ where }),
      ]);
    }

    const copies = await this.prisma.userCard.findMany({
      where: { userId, cardId: { in: cards.map((card) => card.id) } },
    });
    const byCard = new Map(copies.map((copy) => [copy.cardId, copy]));

    return {
      items: cards.map((card) =>
        toCollectionItem(card, locale, byCard.get(card.id)),
      ),
      total,
      page,
      pageSize,
    };
  }

  private findCards(
    where: Prisma.CardWhereInput,
    orderBy?: Prisma.CardOrderByWithRelationInput[],
    skip?: number,
    take?: number,
  ) {
    return this.prisma.card.findMany({
      where,
      include: CARD_INCLUDE,
      orderBy,
      skip,
      take,
    });
  }

  async detail(
    userId: string,
    cardId: string,
    locale: AppLocale,
  ): Promise<CardDetailDto> {
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

    const [copy, ownersCount] = await Promise.all([
      this.prisma.userCard.findUnique({
        where: { userId_cardId: { userId, cardId } },
      }),
      this.prisma.userCard.count({ where: { cardId } }),
    ]);

    // Same rule as the listing: an unobtainable card is private to its owners.
    if (!copy && (!card.enabled || card.missingSince)) {
      throw new AppException(
        ErrorCode.CARD_NOT_FOUND,
        HttpStatus.NOT_FOUND,
        "Card not found",
      );
    }

    const dto = toCardDto(card, locale);
    return {
      ...dto,
      extract:
        card.localizations.find((text) => text.locale === dto.lang)?.extract ??
        null,
      languages: card.localizations.map((text) => text.locale),
      icd10: card.icd10,
      quantity: copy?.quantity ?? 0,
      shinyQuantity: copy?.shinyQuantity ?? 0,
      firstObtainedAt: copy?.firstObtainedAt.toISOString() ?? null,
      ownersCount,
    };
  }

  async summary(userId: string): Promise<CollectionSummaryDto> {
    const [catalog, owned] = await Promise.all([
      this.prisma.card.groupBy({
        by: ["rarity"],
        where: DROPPABLE,
        _count: { _all: true },
      }),
      this.prisma.$queryRaw<
        Array<{
          rarity: Rarity;
          owned: number;
          ownedDroppable: number;
          copies: number;
          shiny: number;
          score: number;
        }>
      >`
        SELECT c.rarity,
               COUNT(*)::int AS "owned",
               (COUNT(*) FILTER (WHERE c.enabled AND c.missing_since IS NULL))::int AS "ownedDroppable",
               SUM(uc.quantity)::int AS "copies",
               (COUNT(*) FILTER (WHERE uc.shiny_quantity > 0))::int AS "shiny",
               SUM(${SCORE_SQL})::int AS "score"
        FROM user_cards uc
        JOIN cards c ON c.id = uc.card_id
        WHERE uc.user_id = ${userId}
        GROUP BY c.rarity
      `,
    ]);

    const catalogBy = new Map(catalog.map((row) => [row.rarity, row._count._all]));
    const ownedBy = new Map(owned.map((row) => [row.rarity, row]));

    const catalogSize = catalog.reduce((sum, row) => sum + row._count._all, 0);
    const ownedDroppable = owned.reduce((sum, row) => sum + row.ownedDroppable, 0);

    return {
      uniqueOwned: owned.reduce((sum, row) => sum + row.owned, 0),
      totalCopies: owned.reduce((sum, row) => sum + row.copies, 0),
      shinyOwned: owned.reduce((sum, row) => sum + row.shiny, 0),
      catalogSize,
      completionPct:
        catalogSize > 0
          ? Math.round((ownedDroppable / catalogSize) * 1000) / 10
          : 0,
      score: owned.reduce((sum, row) => sum + row.score, 0),
      byRarity: [...RARITIES].reverse().map((rarity) => ({
        rarity,
        owned: ownedBy.get(rarity)?.owned ?? 0,
        total: catalogBy.get(rarity) ?? 0,
      })),
    };
  }

  async leaderboard(limit = 20): Promise<LeaderboardEntryDto[]> {
    const rows = await this.prisma.$queryRaw<
      Array<{
        userId: string;
        displayName: string | null;
        photoUrl: string | null;
        uniqueOwned: number;
        score: number;
      }>
    >`
      SELECT u.id AS "userId",
             u.display_name AS "displayName",
             u.photo_url AS "photoUrl",
             COUNT(*)::int AS "uniqueOwned",
             SUM(${SCORE_SQL})::int AS "score"
      FROM user_cards uc
      JOIN cards c ON c.id = uc.card_id
      JOIN users u ON u.id = uc.user_id
      WHERE u.suspended_at IS NULL
      GROUP BY u.id
      ORDER BY "score" DESC, "uniqueOwned" DESC, u.created_at ASC
      LIMIT ${limit}
    `;

    return rows.map((row, index) => ({ rank: index + 1, ...row }));
  }
}
