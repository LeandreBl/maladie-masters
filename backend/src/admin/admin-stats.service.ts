import { Injectable } from "@nestjs/common";
import { Rarity, SyncRunStatus, UserRole } from "@prisma/client";
import { CARD_INCLUDE, toCardDto } from "../cards/card-mapper";
import { LOCALES, type AppLocale } from "../common/locale";
import { DROPPABLE } from "../cards/collection.service";
import { expectedDropShares, RARITIES } from "../cards/rarity";
import { PrismaService } from "../prisma/prisma.service";
import { GameSettingsService } from "../settings/game-settings.service";
import { DiseaseSyncService } from "../sync/disease-sync.service";
import { toSyncRunDto } from "../sync/sync-run.mapper";
import { nextScheduledRun } from "../sync/sync-schedule";
import type {
  DropStatsDto,
  StatsOverviewDto,
  StatsSeriesDto,
  TopCardDto,
} from "./dto/admin-stats.dto";

const DAY_MS = 24 * 60 * 60_000;
const RARITIES_DESC = [...RARITIES].reverse();

@Injectable()
export class AdminStatsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: GameSettingsService,
    private readonly sync: DiseaseSyncService,
  ) {}

  async overview(): Promise<StatsOverviewDto> {
    const now = Date.now();
    const dayAgo = new Date(now - DAY_MS);
    const weekAgo = new Date(now - 7 * DAY_MS);
    const triggeredBy = { triggeredBy: { select: { email: true } } };

    const [
      usersTotal,
      active24h,
      active7d,
      new7d,
      suspended,
      admins,
      opened24h,
      opened7d,
      openedTotal,
      bonus,
      catalog,
      droppable,
      disabled,
      missing,
      copies,
      collectors,
      uniquePairs,
      lastRun,
      lastSuccess,
      settings,
      usersByLocale,
      cardsByLocale,
      shiniesTotal,
      shinies7d,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { lastSeenAt: { gte: dayAgo } } }),
      this.prisma.user.count({ where: { lastSeenAt: { gte: weekAgo } } }),
      this.prisma.user.count({ where: { createdAt: { gte: weekAgo } } }),
      this.prisma.user.count({ where: { suspendedAt: { not: null } } }),
      this.prisma.user.count({ where: { role: UserRole.ADMIN } }),
      this.prisma.packOpening.count({ where: { createdAt: { gte: dayAgo } } }),
      this.prisma.packOpening.count({ where: { createdAt: { gte: weekAgo } } }),
      this.prisma.packOpening.count(),
      this.prisma.user.aggregate({ _sum: { bonusPacks: true } }),
      this.prisma.card.groupBy({ by: ["rarity"], _count: { _all: true } }),
      this.prisma.card.groupBy({
        by: ["rarity"],
        where: DROPPABLE,
        _count: { _all: true },
      }),
      this.prisma.card.count({ where: { enabled: false } }),
      this.prisma.card.count({ where: { missingSince: { not: null } } }),
      this.prisma.userCard.aggregate({ _sum: { quantity: true } }),
      this.prisma.user.count({ where: { cards: { some: {} } } }),
      this.prisma.userCard.count(),
      this.prisma.diseaseSyncRun.findFirst({
        orderBy: { startedAt: "desc" },
        include: triggeredBy,
      }),
      this.prisma.diseaseSyncRun.findFirst({
        where: { status: SyncRunStatus.SUCCEEDED },
        orderBy: { startedAt: "desc" },
        include: triggeredBy,
      }),
      this.settings.get(),
      this.prisma.user.groupBy({ by: ["locale"], _count: { _all: true } }),
      this.prisma.cardLocalization.groupBy({
        by: ["locale"],
        where: { card: DROPPABLE },
        _count: { _all: true },
      }),
      this.prisma.packOpeningCard.count({ where: { isShiny: true } }),
      this.prisma.packOpeningCard.count({
        where: { isShiny: true, opening: { createdAt: { gte: weekAgo } } },
      }),
    ]);

    const countByLocale = (
      rows: Array<{ locale: AppLocale; _count: { _all: number } }>,
    ) =>
      LOCALES.map((locale) => ({
        locale,
        count: rows.find((row) => row.locale === locale)?._count._all ?? 0,
      }));

    const catalogBy = new Map(catalog.map((row) => [row.rarity, row._count._all]));
    const droppableBy = new Map(droppable.map((row) => [row.rarity, row._count._all]));
    const next = nextScheduledRun(settings, lastRun);

    return {
      generatedAt: new Date(now).toISOString(),
      users: {
        total: usersTotal,
        active24h,
        active7d,
        new7d,
        suspended,
        admins,
        byLocale: countByLocale(usersByLocale),
      },
      packs: {
        opened24h,
        opened7d,
        openedTotal,
        bonusOutstanding: bonus._sum.bonusPacks ?? 0,
        shiniesTotal,
        shinies7d,
      },
      cards: {
        total: catalog.reduce((sum, row) => sum + row._count._all, 0),
        droppable: droppable.reduce((sum, row) => sum + row._count._all, 0),
        disabled,
        missing,
        byLocale: countByLocale(cardsByLocale),
        byRarity: RARITIES_DESC.map((rarity) => ({
          rarity,
          total: catalogBy.get(rarity) ?? 0,
          droppable: droppableBy.get(rarity) ?? 0,
        })),
      },
      collection: {
        copies: copies._sum.quantity ?? 0,
        collectors,
        avgUniquePerCollector:
          collectors > 0 ? Math.round((uniquePairs / collectors) * 10) / 10 : 0,
      },
      sync: {
        running: this.sync.isRunning() || lastRun?.status === SyncRunStatus.RUNNING,
        lastRun: lastRun ? toSyncRunDto(lastRun) : null,
        lastSuccess: lastSuccess ? toSyncRunDto(lastSuccess) : null,
        nextScheduledAt: next
          ? new Date(Math.max(next.getTime(), now)).toISOString()
          : null,
      },
    };
  }

  /** One point per UTC day, oldest first, today included. */
  async series(days: number): Promise<StatsSeriesDto> {
    const rows = await this.prisma.$queryRaw<
      Array<{ date: string; signups: number; packsOpened: number; activePlayers: number }>
    >`
      WITH days AS (
        SELECT generate_series(
          date_trunc('day', now() AT TIME ZONE 'UTC') - ((${days}::int - 1) * interval '1 day'),
          date_trunc('day', now() AT TIME ZONE 'UTC'),
          interval '1 day'
        ) AS day
      ),
      signups AS (
        SELECT date_trunc('day', created_at) AS day, COUNT(*)::int AS n
        FROM users
        WHERE created_at >= (SELECT MIN(day) FROM days)
        GROUP BY 1
      ),
      openings AS (
        SELECT date_trunc('day', created_at) AS day,
               COUNT(*)::int AS n,
               COUNT(DISTINCT user_id)::int AS players
        FROM pack_openings
        WHERE created_at >= (SELECT MIN(day) FROM days)
        GROUP BY 1
      )
      SELECT to_char(d.day, 'YYYY-MM-DD') AS "date",
             COALESCE(s.n, 0)::int AS "signups",
             COALESCE(o.n, 0)::int AS "packsOpened",
             COALESCE(o.players, 0)::int AS "activePlayers"
      FROM days d
      LEFT JOIN signups s ON s.day = d.day
      LEFT JOIN openings o ON o.day = d.day
      ORDER BY d.day
    `;

    return { days, points: rows };
  }

  async drops(days: number): Promise<DropStatsDto> {
    const since = new Date(Date.now() - days * DAY_MS);
    const [rows, settings] = await Promise.all([
      this.prisma.packOpeningCard.groupBy({
        by: ["rarity"],
        where: { opening: { createdAt: { gte: since } } },
        _count: { _all: true },
      }),
      this.settings.get(),
    ]);

    const counts = new Map<Rarity, number>(
      rows.map((row) => [row.rarity, row._count._all]),
    );
    const total = rows.reduce((sum, row) => sum + row._count._all, 0);
    const expected = expectedDropShares(this.settings.packSlots(settings));

    return {
      days,
      total,
      byRarity: RARITIES_DESC.map((rarity) => {
        const count = counts.get(rarity) ?? 0;
        return {
          rarity,
          count,
          pct: total > 0 ? Math.round((count / total) * 1000) / 10 : 0,
          expectedPct: Math.round(expected[rarity] * 10) / 10,
        };
      }),
    };
  }

  /** The cards in the most collections. */
  async topCards(limit: number, locale: AppLocale): Promise<TopCardDto[]> {
    const rows = await this.prisma.userCard.groupBy({
      by: ["cardId"],
      _count: { _all: true },
      _sum: { quantity: true },
      orderBy: { _count: { cardId: "desc" } },
      take: limit,
    });
    const cards = await this.prisma.card.findMany({
      where: { id: { in: rows.map((row) => row.cardId) } },
      include: CARD_INCLUDE,
    });
    const byId = new Map(cards.map((card) => [card.id, card]));

    return rows.flatMap((row) => {
      const card = byId.get(row.cardId);
      return card
        ? [
            {
              card: toCardDto(card, locale),
              owners: row._count._all,
              copies: row._sum.quantity ?? 0,
            },
          ]
        : [];
    });
  }
}
