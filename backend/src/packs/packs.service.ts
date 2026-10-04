import { HttpStatus, Injectable, Logger } from "@nestjs/common";
import type {
  GameSettings,
  PackOpening,
  PackOpeningCard,
  Prisma,
} from "@prisma/client";
import { randomInt } from "node:crypto";
import { CARD_INCLUDE, toCardDto, type LocalizedCard } from "../cards/card-mapper";
import { DROPPABLE } from "../cards/collection.service";
import {
  byRarityAscending,
  expandSlots,
  nearestAvailable,
  RARITIES,
  rollRarity,
  rollShiny,
  type RarityName,
} from "../cards/rarity";
import { AppException } from "../common/app.exception";
import { ErrorCode } from "../common/error-code.enum";
import type { AppLocale } from "../common/locale";
import { DiscordAnnouncerService } from "../discord/discord-announcer.service";
import { FamiliesService } from "../families/families.service";
import { pageWindow, type PageQueryDto } from "../common/pagination";
import { PrismaService } from "../prisma/prisma.service";
import { RealtimeService } from "../realtime/realtime.service";
import { GameSettingsService } from "../settings/game-settings.service";
import type {
  PackHistoryPageDto,
  PackOpeningDto,
  PackWalletDto,
} from "./dto/pack.dto";
import { settleWallet, spendPack, viewWallet, type WalletState } from "./pack-wallet";

/** Attempts at drawing a card not already in the same pack before giving up. */
const DUPLICATE_REROLLS = 4;

/** A uniform float in [0, 1) from the CSPRNG: drops are worth something. */
function secureRandom(): number {
  return randomInt(0, 2 ** 48 - 1) / 2 ** 48;
}

type OpeningWithCards = PackOpening & {
  cards: Array<PackOpeningCard & { card: LocalizedCard }>;
};

@Injectable()
export class PacksService {
  private readonly logger = new Logger(PacksService.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: GameSettingsService,
    private readonly realtime: RealtimeService,
    private readonly discord: DiscordAnnouncerService,
    private readonly families: FamiliesService,
  ) {}

  async wallet(userId: string): Promise<PackWalletDto> {
    const [user, settings] = await Promise.all([
      this.prisma.user.findUniqueOrThrow({ where: { id: userId } }),
      this.settings.get(),
    ]);
    return this.toWalletDto(user, settings, new Date());
  }

  toWalletDto(
    state: WalletState,
    settings: GameSettings,
    now: Date,
  ): PackWalletDto {
    const view = viewWallet(state, this.settings.walletRules(settings), now);
    return {
      available: view.available,
      natural: view.natural,
      bonus: view.bonus,
      maxStored: view.maxStored,
      intervalMinutes: view.intervalMinutes,
      nextPackAt: view.nextPackAt?.toISOString() ?? null,
      fullAt: view.fullAt?.toISOString() ?? null,
      serverTime: now.toISOString(),
    };
  }

  /**
   * Opens one pack.
   *
   * The player's row is locked for the whole draw: two concurrent requests
   * would otherwise both read one pack left and both open it.
   */
  async open(userId: string, locale: AppLocale): Promise<PackOpeningDto> {
    const settings = await this.settings.get();
    const rules = this.settings.walletRules(settings);

    const { opening, wallet } = await this.prisma.$transaction(
      async (tx) => {
        await tx.$queryRaw`SELECT id FROM users WHERE id = ${userId} FOR UPDATE`;
        const user = await tx.user.findUniqueOrThrow({ where: { id: userId } });

        const now = new Date();
        const spend = spendPack(user, rules, now);
        if (!spend.spent) {
          const view = viewWallet(user, rules, now);
          throw new AppException(
            ErrorCode.NO_PACK_AVAILABLE,
            HttpStatus.CONFLICT,
            view.nextPackAt
              ? `No pack available. Next one at ${view.nextPackAt.toISOString()}`
              : "No pack available",
          );
        }

        const drawn = await this.draw(tx, settings);
        const opening = await this.record(
          tx,
          userId,
          spend.source,
          drawn.map((card) => ({ card, shiny: rollShiny(secureRandom, settings.shinyOneIn) })),
          now,
        );

        await tx.user.update({
          where: { id: userId },
          data: {
            packsStored: spend.state.packsStored,
            packsAnchorAt: spend.state.packsAnchorAt,
            bonusPacks: spend.state.bonusPacks,
            lastSeenAt: now,
          },
        });

        return {
          opening,
          wallet: this.toWalletDto(spend.state, settings, now),
        };
      },
      { timeout: 15_000 },
    );

    // After the commit: a rolled-back pack must not be announced.
    this.discord.announceLegendaries(
      userId,
      opening.cards.filter((entry) => entry.rarity === "LEGENDARY"),
    );

    // Admins only: the player's own front already has the result, and a
    // profile refresh pushed to it would give the cards away mid-reveal.
    this.realtime.toAdmins({
      type: "pack.opened",
      data: {
        userId,
        best: opening.cards.reduce<RarityName>(
          (best, card) =>
            RARITIES.indexOf(card.rarity) > RARITIES.indexOf(best) ? card.rarity : best,
          RARITIES[0],
        ),
        shiny: opening.cards.filter((card) => card.isShiny).length,
      },
    });

    // Only a first copy can complete a family. A failure here must not cost
    // the player the pack they already opened.
    const completedFamilies = await this.families
      .completedWith(
        userId,
        opening.cards.filter((entry) => entry.isNew).map((entry) => entry.cardId),
        locale,
      )
      .catch((error) => {
        this.logger.warn(`Completed families not computed: ${String(error)}`);
        return [];
      });

    return { ...this.toOpeningDto(opening, locale), wallet, completedFamilies };
  }

  async history(
    userId: string,
    query: PageQueryDto,
    locale: AppLocale,
  ): Promise<PackHistoryPageDto> {
    const { page, pageSize, skip, take } = pageWindow(query);
    const [openings, total] = await this.prisma.$transaction([
      this.prisma.packOpening.findMany({
        where: { userId },
        include: {
          cards: { include: { card: { include: CARD_INCLUDE } }, orderBy: { slot: "asc" } },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take,
      }),
      this.prisma.packOpening.count({ where: { userId } }),
    ]);

    return {
      items: openings.map((opening) => this.toOpeningDto(opening, locale)),
      total,
      page,
      pageSize,
    };
  }

  /** Sets the natural packs to the cap, for the admin panel. */
  async refill(userId: string): Promise<PackWalletDto> {
    const settings = await this.settings.get();
    const now = new Date();
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { packsStored: settings.packMaxStored, packsAnchorAt: now },
    });
    return this.toWalletDto(user, settings, now);
  }

  /**
   * Adds (or, with a negative amount, takes back) bonus packs. The natural
   * count is settled at the same time so the timer is not disturbed.
   */
  async grantBonus(userId: string, amount: number): Promise<PackWalletDto> {
    const settings = await this.settings.get();
    const rules = this.settings.walletRules(settings);

    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM users WHERE id = ${userId} FOR UPDATE`;
      const user = await tx.user.findUniqueOrThrow({ where: { id: userId } });
      const now = new Date();
      const settled = settleWallet(user, rules, now);
      const bonusPacks = Math.max(0, settled.bonusPacks + amount);

      const updated = await tx.user.update({
        where: { id: userId },
        data: {
          packsStored: settled.packsStored,
          packsAnchorAt: settled.packsAnchorAt,
          bonusPacks,
        },
      });
      return this.toWalletDto(updated, settings, now);
    });
  }

  /**
   * Picks the pack's cards, slot by slot as a booster is filled: each slot
   * draws a rarity from its own weights, then a card of that rarity at random.
   * Only rarities that still have a droppable card take part in a slot's draw.
   *
   * The cards come back from the most common to the rarest, which is also the
   * order they are stored and revealed in: the best card is the last one.
   */
  private async draw(
    tx: Prisma.TransactionClient,
    settings: GameSettings,
  ): Promise<LocalizedCard[]> {
    const counts = await tx.card.groupBy({
      by: ["rarity"],
      where: DROPPABLE,
      _count: { _all: true },
    });
    const available = new Map<RarityName, number>(
      counts
        .filter((row) => row._count._all > 0)
        .map((row) => [row.rarity, row._count._all]),
    );
    if (available.size === 0) {
      throw new AppException(
        ErrorCode.EMPTY_CATALOG,
        HttpStatus.SERVICE_UNAVAILABLE,
        "The card catalog is empty: run the Wikipedia sync first",
      );
    }

    const rarities = new Set(available.keys());
    const picked: LocalizedCard[] = [];

    for (const weights of expandSlots(this.settings.packSlots(settings))) {
      // A slot whose rarities have no card left gives the closest rarity
      // that has one, rather than leaving the pack a card short.
      const wanted = rollRarity(weights, new Set(RARITIES), secureRandom);
      const rarity =
        rollRarity(weights, rarities, secureRandom) ??
        (wanted ? nearestAvailable(wanted, rarities) : null);
      if (!rarity) break;

      const count = available.get(rarity) ?? 0;
      let card: LocalizedCard | null = null;
      for (let attempt = 0; attempt <= DUPLICATE_REROLLS; attempt += 1) {
        card = await tx.card.findFirst({
          where: { ...DROPPABLE, rarity },
          include: CARD_INCLUDE,
          orderBy: { number: "asc" },
          skip: randomInt(0, count),
        });
        if (!card || !picked.some((other) => other.id === card?.id)) break;
      }
      if (card) picked.push(card);
    }

    return byRarityAscending(picked);
  }

  /** Stores the opening and adds the cards to the collection. */
  private async record(
    tx: Prisma.TransactionClient,
    userId: string,
    source: "NATURAL" | "BONUS",
    drawn: Array<{ card: LocalizedCard; shiny: boolean }>,
    now: Date,
  ): Promise<OpeningWithCards> {
    const existing = await tx.userCard.findMany({
      where: { userId, cardId: { in: drawn.map(({ card }) => card.id) } },
      select: { cardId: true },
    });
    const owned = new Set(existing.map((row) => row.cardId));
    const isNew: boolean[] = [];

    for (const { card, shiny } of drawn) {
      isNew.push(!owned.has(card.id));
      owned.add(card.id);
      await tx.userCard.upsert({
        where: { userId_cardId: { userId, cardId: card.id } },
        create: {
          userId,
          cardId: card.id,
          quantity: 1,
          shinyQuantity: shiny ? 1 : 0,
          firstObtainedAt: now,
          lastObtainedAt: now,
        },
        update: {
          quantity: { increment: 1 },
          ...(shiny ? { shinyQuantity: { increment: 1 } } : {}),
          lastObtainedAt: now,
        },
      });
    }
    if (drawn.some(({ shiny }) => shiny)) {
      this.logger.log(`Shiny drawn by ${userId}`);
    }

    return tx.packOpening.create({
      data: {
        userId,
        source,
        createdAt: now,
        cards: {
          create: drawn.map(({ card, shiny }, slot) => ({
            cardId: card.id,
            slot,
            rarity: card.rarity,
            isNew: isNew[slot] ?? false,
            isShiny: shiny,
          })),
        },
      },
      include: {
          cards: { include: { card: { include: CARD_INCLUDE } }, orderBy: { slot: "asc" } },
        },
    });
  }

  toOpeningDto(opening: OpeningWithCards, locale: AppLocale): PackOpeningDto {
    return {
      id: opening.id,
      source: opening.source,
      openedAt: opening.createdAt.toISOString(),
      cards: opening.cards.map((entry) => ({
        slot: entry.slot,
        rarity: entry.rarity,
        isNew: entry.isNew,
        isShiny: entry.isShiny,
        card: toCardDto(entry.card, locale),
      })),
    };
  }
}
