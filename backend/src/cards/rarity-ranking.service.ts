import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { GameSettingsService } from "../settings/game-settings.service";
import { rarityCutoffs, rarityForRank, type RarityName } from "./rarity";

export interface RankingResult {
  ranked: number;
  /** Cards whose rarity in effect changed. */
  changed: number;
}

/**
 * Turns the popularity ranking into rarities: the most viewed diseases are
 * the rarest cards.
 *
 * Only cards still found in Wikidata are ranked. A missing card keeps the
 * rarity it last had — players own it — but loses its rank.
 */
@Injectable()
export class RarityRankingService {
  private readonly logger = new Logger(RarityRankingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: GameSettingsService,
  ) {}

  async recompute(): Promise<RankingResult> {
    const settings = await this.settings.get();
    const cards = await this.prisma.card.findMany({
      where: { missingSince: null },
      select: { id: true, rarity: true, rarityOverride: true },
      // Ties broken by collector number, so a re-run gives the same ranking.
      orderBy: [{ pageviews: "desc" }, { number: "asc" }],
    });

    const cutoffs = rarityCutoffs(
      cards.length,
      this.settings.rarityShares(settings),
    );

    const ids: string[] = [];
    const ranks: number[] = [];
    const rarities: RarityName[] = [];
    let changed = 0;

    cards.forEach((card, index) => {
      const rank = index + 1;
      const rarity = rarityForRank(rank, cutoffs);
      ids.push(card.id);
      ranks.push(rank);
      rarities.push(rarity);
      if ((card.rarityOverride ?? rarity) !== card.rarity) {
        changed += 1;
      }
    });

    await this.prisma.$transaction([
      this.prisma.$executeRaw`
        UPDATE cards AS c
        SET popularity_rank = v.rank,
            popularity_rarity = v.rarity::"Rarity",
            rarity = COALESCE(c.rarity_override, v.rarity::"Rarity"),
            updated_at = now()
        FROM unnest(${ids}::text[], ${ranks}::int[], ${rarities}::text[]) AS v(id, rank, rarity)
        WHERE c.id = v.id
      `,
      this.prisma.$executeRaw`
        UPDATE cards SET popularity_rank = NULL
        WHERE missing_since IS NOT NULL AND popularity_rank IS NOT NULL
      `,
    ]);

    this.logger.log(
      `Rarities recomputed over ${cards.length} cards (${changed} changed)`,
    );
    return { ranked: cards.length, changed };
  }
}
