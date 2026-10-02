import { HttpStatus, Injectable } from "@nestjs/common";
import type { GameSettings, Prisma } from "@prisma/client";
import { AppException } from "../common/app.exception";
import { ErrorCode } from "../common/error-code.enum";
import { PrismaService } from "../prisma/prisma.service";
import {
  cardsPerPack,
  DEFAULT_PACK_SLOTS,
  RARITIES,
  type PackSlot,
  type RarityShares,
} from "../cards/rarity";
import type { WalletRules } from "../packs/pack-wallet";

const SETTINGS_ID = "global";

/**
 * How long a read is served from memory. Every authenticated request and every
 * pack opening reads the rules; an admin edit goes through `update`, which
 * refreshes the cache at once, so the window only matters across instances.
 */
const CACHE_TTL_MS = 10_000;

export const MAX_CARDS_PER_PACK = 15;

@Injectable()
export class GameSettingsService {
  private cached: { value: GameSettings; at: number } | null = null;

  constructor(private readonly prisma: PrismaService) {}

  async get(): Promise<GameSettings> {
    if (this.cached && Date.now() - this.cached.at < CACHE_TTL_MS) {
      return this.cached.value;
    }

    const value = await this.prisma.gameSettings.upsert({
      where: { id: SETTINGS_ID },
      update: {},
      create: {
        id: SETTINGS_ID,
        packSlots: DEFAULT_PACK_SLOTS as unknown as Prisma.InputJsonArray,
      },
    });
    this.cached = { value, at: Date.now() };
    return value;
  }

  async update(data: Prisma.GameSettingsUpdateInput): Promise<GameSettings> {
    const current = await this.get();
    const next = { ...current, ...data } as GameSettings;
    this.assertCoherent(next);

    const value = await this.prisma.gameSettings.update({
      where: { id: SETTINGS_ID },
      data,
    });
    this.cached = { value, at: Date.now() };
    return value;
  }

  walletRules(settings: GameSettings): WalletRules {
    return {
      intervalMinutes: settings.packIntervalMinutes,
      maxStored: settings.packMaxStored,
    };
  }

  /**
   * The booster layout. The column is JSON, so it is read defensively: a
   * missing weight counts as zero, and an unusable layout falls back to the
   * default rather than handing out empty packs.
   */
  packSlots(settings: GameSettings): PackSlot[] {
    const raw = Array.isArray(settings.packSlots) ? settings.packSlots : [];
    const slots = raw.flatMap((entry) => {
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) return [];
      const { count, weights } = entry as { count?: unknown; weights?: unknown };
      if (!Number.isInteger(count) || (count as number) < 1) return [];
      const table = (weights ?? {}) as Record<string, unknown>;
      return [
        {
          count: count as number,
          weights: Object.fromEntries(
            RARITIES.map((rarity) => {
              const value = Number(table[rarity]);
              return [rarity, Number.isFinite(value) && value > 0 ? value : 0];
            }),
          ) as PackSlot["weights"],
        },
      ];
    });
    return slots.length > 0 ? slots : DEFAULT_PACK_SLOTS;
  }

  rarityShares(settings: GameSettings): RarityShares {
    return {
      legendary: settings.shareLegendary,
      epic: settings.shareEpic,
      rare: settings.shareRare,
      uncommon: settings.shareUncommon,
    };
  }

  /**
   * Rules that each field's own validation cannot see: they span several
   * fields.
   */
  private assertCoherent(settings: GameSettings): void {
    const shares = this.rarityShares(settings);
    const shareTotal =
      shares.legendary + shares.epic + shares.rare + shares.uncommon;
    if (shareTotal > 100) {
      throw new AppException(
        ErrorCode.INVALID_SETTINGS,
        HttpStatus.BAD_REQUEST,
        `Rarity shares add up to ${shareTotal}%, above 100%`,
      );
    }

    const slots = settings.packSlots as unknown as PackSlot[];
    const cards = cardsPerPack(slots);
    if (cards < 1 || cards > MAX_CARDS_PER_PACK) {
      throw new AppException(
        ErrorCode.INVALID_SETTINGS,
        HttpStatus.BAD_REQUEST,
        `A pack must hold between 1 and ${MAX_CARDS_PER_PACK} cards, not ${cards}`,
      );
    }
    const empty = slots.findIndex((slot) =>
      Object.values(slot.weights).every((weight) => weight <= 0),
    );
    if (empty !== -1) {
      throw new AppException(
        ErrorCode.INVALID_SETTINGS,
        HttpStatus.BAD_REQUEST,
        `Slot ${empty + 1} has no rarity with a weight above zero`,
      );
    }
  }
}
