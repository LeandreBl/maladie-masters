/**
 * Rarity rules, kept free of Nest and Prisma so they can be tested alone.
 *
 * The names mirror the Prisma `Rarity` enum, whose generated type is the same
 * string union: a value from here can be written to the database as is.
 */
export const RARITIES = [
  "COMMON",
  "UNCOMMON",
  "RARE",
  "EPIC",
  "LEGENDARY",
] as const;

export type RarityName = (typeof RARITIES)[number];

/** Share of the catalog, in percent, each rarity takes. COMMON gets the rest. */
export interface RarityShares {
  legendary: number;
  epic: number;
  rare: number;
  uncommon: number;
}

export type RarityWeights = Record<RarityName, number>;

/** Points a unique card is worth on the leaderboard. */
export const RARITY_SCORE: Record<RarityName, number> = {
  COMMON: 1,
  UNCOMMON: 3,
  RARE: 10,
  EPIC: 30,
  LEGENDARY: 100,
};

export function rarityIndex(rarity: RarityName): number {
  return RARITIES.indexOf(rarity);
}

/**
 * How many cards, from the top of the popularity ranking, fall in each rarity
 * or above: `{ LEGENDARY: 50, EPIC: 250, ... }` reads "the 50 most viewed are
 * legendary, the next 200 epic".
 *
 * A rarity with a non-zero share always gets at least one card, so a small
 * catalog still has a legendary to chase.
 */
export function rarityCutoffs(
  total: number,
  shares: RarityShares,
): Record<Exclude<RarityName, "COMMON">, number> {
  const steps: Array<[Exclude<RarityName, "COMMON">, number]> = [
    ["LEGENDARY", shares.legendary],
    ["EPIC", shares.epic],
    ["RARE", shares.rare],
    ["UNCOMMON", shares.uncommon],
  ];

  const cutoffs = {} as Record<Exclude<RarityName, "COMMON">, number>;
  let cumulativeShare = 0;
  let previous = 0;

  for (const [rarity, share] of steps) {
    cumulativeShare += Math.max(0, share);
    let cutoff = Math.round((total * cumulativeShare) / 100);
    if (share > 0 && cutoff <= previous) {
      cutoff = previous + 1;
    }
    cutoff = Math.min(total, Math.max(previous, cutoff));
    cutoffs[rarity] = cutoff;
    previous = cutoff;
  }

  return cutoffs;
}

/** The rarity of the card ranked `rank` (1 = most viewed). */
export function rarityForRank(
  rank: number,
  cutoffs: Record<Exclude<RarityName, "COMMON">, number>,
): RarityName {
  if (rank <= cutoffs.LEGENDARY) return "LEGENDARY";
  if (rank <= cutoffs.EPIC) return "EPIC";
  if (rank <= cutoffs.RARE) return "RARE";
  if (rank <= cutoffs.UNCOMMON) return "UNCOMMON";
  return "COMMON";
}

/**
 * Draws the rarity of one pack slot.
 *
 * Only rarities that have a card to give are in the draw — a pack never comes
 * up empty because every epic is disabled — and `minimum` drops the ones below
 * it, for the guaranteed slot. The weights of what is left are renormalised.
 * Returns null when nothing qualifies.
 */
export function rollRarity(
  weights: RarityWeights,
  available: ReadonlySet<RarityName>,
  random: () => number,
  minimum: RarityName = "COMMON",
): RarityName | null {
  const floor = rarityIndex(minimum);
  const candidates = RARITIES.filter(
    (rarity) =>
      rarityIndex(rarity) >= floor &&
      available.has(rarity) &&
      weights[rarity] > 0,
  );

  if (candidates.length === 0) {
    // Every eligible weight is zero but cards exist: fall back to a uniform
    // draw rather than refusing to open the pack.
    const fallback = RARITIES.filter(
      (rarity) => rarityIndex(rarity) >= floor && available.has(rarity),
    );
    if (fallback.length === 0) return null;
    return fallback[Math.floor(random() * fallback.length)] ?? null;
  }

  const total = candidates.reduce((sum, rarity) => sum + weights[rarity], 0);
  let ticket = random() * total;
  for (const rarity of candidates) {
    ticket -= weights[rarity];
    if (ticket < 0) return rarity;
  }

  return candidates[candidates.length - 1] ?? null;
}

/**
 * The available rarity closest to `wanted`, the lower one first on a tie: a
 * commons slot whose commons all ran out gives an uncommon, never a jackpot.
 */
export function nearestAvailable(
  wanted: RarityName,
  available: ReadonlySet<RarityName>,
): RarityName | null {
  const index = rarityIndex(wanted);
  for (let distance = 0; distance < RARITIES.length; distance += 1) {
    const lower = RARITIES[index - distance];
    if (lower && available.has(lower)) return lower;
    const higher = RARITIES[index + distance];
    if (higher && available.has(higher)) return higher;
  }
  return null;
}

/** The odds, in percent, `rollRarity` gives each rarity from `weights`. */
export function dropOdds(
  weights: RarityWeights,
): Record<RarityName, number> {
  const total = RARITIES.reduce(
    (sum, rarity) => sum + Math.max(0, weights[rarity]),
    0,
  );
  return Object.fromEntries(
    RARITIES.map((rarity) => [
      rarity,
      total > 0 ? (Math.max(0, weights[rarity]) / total) * 100 : 0,
    ]),
  ) as Record<RarityName, number>;
}

/**
 * One kind of slot in a pack, like the boosters of the big TCGs: `count`
 * slots of this kind, each drawing its rarity from `weights`.
 */
export interface PackSlot {
  count: number;
  weights: RarityWeights;
}

/**
 * The default booster, modelled on Magic and Pokémon: commons fill most of
 * the pack, one slot is reserved for uncommons, and a single "rare slot" is
 * the only place the top rarities can come from.
 *
 * - common slots: a common, or 1 time in 20 an uncommon;
 * - uncommon slot: an uncommon, or 1 time in 10 a rare;
 * - rare slot: a rare, an epic about 1 pack in 7 (Magic's mythic rate), a
 *   legendary about 1 pack in 60 (a Pokémon secret rare).
 */
export const DEFAULT_PACK_SLOTS: PackSlot[] = [
  { count: 3, weights: { COMMON: 95, UNCOMMON: 5, RARE: 0, EPIC: 0, LEGENDARY: 0 } },
  { count: 1, weights: { COMMON: 0, UNCOMMON: 90, RARE: 10, EPIC: 0, LEGENDARY: 0 } },
  { count: 1, weights: { COMMON: 0, UNCOMMON: 0, RARE: 84.3, EPIC: 14, LEGENDARY: 1.7 } },
];

export function cardsPerPack(slots: PackSlot[]): number {
  return slots.reduce((sum, slot) => sum + Math.max(0, slot.count), 0);
}

/**
 * The pack's slots one by one, in draw order: the cheapest slots first, the
 * rare slot last.
 */
export function expandSlots(slots: PackSlot[]): RarityWeights[] {
  return slots.flatMap((slot) =>
    Array.from({ length: Math.max(0, slot.count) }, () => slot.weights),
  );
}

/**
 * The share of each rarity among all dropped cards, in percent. Assumes every
 * rarity has a card to give.
 */
export function expectedDropShares(
  slots: PackSlot[],
): Record<RarityName, number> {
  const total = cardsPerPack(slots);
  const shares = Object.fromEntries(RARITIES.map((rarity) => [rarity, 0])) as Record<
    RarityName,
    number
  >;
  if (total === 0) return shares;

  for (const slot of slots) {
    const odds = dropOdds(slot.weights);
    for (const rarity of RARITIES) {
      shares[rarity] += (slot.count * odds[rarity]) / total;
    }
  }
  return shares;
}

/**
 * The chance, in percent, that a pack holds at least one card of each
 * rarity — what players actually feel: "a legendary every N packs".
 */
export function packHitOdds(slots: PackSlot[]): Record<RarityName, number> {
  return Object.fromEntries(
    RARITIES.map((rarity) => {
      let none = 1;
      for (const slot of slots) {
        const odds = dropOdds(slot.weights)[rarity] / 100;
        none *= (1 - odds) ** Math.max(0, slot.count);
      }
      return [rarity, (1 - none) * 100];
    }),
  ) as Record<RarityName, number>;
}

/** Sorts cards from the most common to the rarest, keeping the draw order within a rarity. */
export function byRarityAscending<T extends { rarity: RarityName }>(cards: T[]): T[] {
  return cards
    .map((card, index) => ({ card, index }))
    .sort(
      (a, b) =>
        rarityIndex(a.card.rarity) - rarityIndex(b.card.rarity) || a.index - b.index,
    )
    .map(({ card }) => card);
}

/** Default shiny odds: one card drawn in 10,000, whatever its rarity. */
export const DEFAULT_SHINY_ONE_IN = 10_000;

/**
 * Whether a drawn card comes out shiny. Rolled for every card on its own,
 * after its rarity: a shiny common is as likely as a shiny legendary.
 */
export function rollShiny(random: () => number, oneIn: number): boolean {
  return oneIn >= 1 && random() < 1 / oneIn;
}
