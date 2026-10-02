import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  byRarityAscending,
  cardsPerPack,
  DEFAULT_PACK_SLOTS,
  dropOdds,
  expandSlots,
  expectedDropShares,
  nearestAvailable,
  packHitOdds,
  rollShiny,
  rarityCutoffs,
  rarityForRank,
  rollRarity,
  type RarityName,
} from "./rarity";

const SHARES = { legendary: 1, epic: 4, rare: 10, uncommon: 25 };
const WEIGHTS = { COMMON: 60, UNCOMMON: 25, RARE: 10, EPIC: 4, LEGENDARY: 1 };
const ALL = new Set<RarityName>(["COMMON", "UNCOMMON", "RARE", "EPIC", "LEGENDARY"]);

describe("rarityCutoffs", () => {
  it("splits the ranking by cumulative share", () => {
    assert.deepEqual(rarityCutoffs(5000, SHARES), {
      LEGENDARY: 50,
      EPIC: 250,
      RARE: 750,
      UNCOMMON: 2000,
    });
  });

  it("keeps at least one card for every non-zero share", () => {
    const cutoffs = rarityCutoffs(10, SHARES);
    assert.equal(cutoffs.LEGENDARY, 1);
    assert.equal(rarityForRank(1, cutoffs), "LEGENDARY");
    assert.equal(rarityForRank(2, cutoffs), "EPIC");
  });

  it("gives everything to COMMON when every share is zero", () => {
    const cutoffs = rarityCutoffs(100, { legendary: 0, epic: 0, rare: 0, uncommon: 0 });
    assert.equal(rarityForRank(1, cutoffs), "COMMON");
  });
});

describe("rollRarity", () => {
  it("follows the weights", () => {
    assert.equal(rollRarity(WEIGHTS, ALL, () => 0), "COMMON");
    assert.equal(rollRarity(WEIGHTS, ALL, () => 0.999), "LEGENDARY");
  });

  it("honours the minimum for the guaranteed slot", () => {
    assert.equal(rollRarity(WEIGHTS, ALL, () => 0, "RARE"), "RARE");
  });

  it("skips rarities that have no card", () => {
    const onlyCommon = new Set<RarityName>(["COMMON"]);
    assert.equal(rollRarity(WEIGHTS, onlyCommon, () => 0.999), "COMMON");
    assert.equal(rollRarity(WEIGHTS, onlyCommon, () => 0.5, "RARE"), null);
  });
});

describe("dropOdds", () => {
  it("normalises the weights to percentages", () => {
    const odds = dropOdds({ ...WEIGHTS, COMMON: 160 });
    assert.equal(Math.round(odds.COMMON), 80);
  });
});

describe("default booster", () => {
  it("holds five cards", () => {
    assert.equal(cardsPerPack(DEFAULT_PACK_SLOTS), 5);
    assert.equal(expandSlots(DEFAULT_PACK_SLOTS).length, 5);
  });

  it("only gives epics and legendaries from the rare slot", () => {
    const hits = packHitOdds(DEFAULT_PACK_SLOTS);
    // About one legendary every 60 packs, one epic every 7.
    assert.ok(Math.abs(100 / hits.LEGENDARY - 59) < 2);
    assert.ok(Math.abs(100 / hits.EPIC - 7.1) < 0.5);
    // The rare slot always gives RARE or better: a plain RARE when it does not
    // upgrade, plus the uncommon slot's own upgrades.
    assert.equal(Math.round(hits.RARE), 86);
  });

  it("splits the drops like a booster", () => {
    const shares = expectedDropShares(DEFAULT_PACK_SLOTS);
    const total = Object.values(shares).reduce((sum, value) => sum + value, 0);
    assert.equal(Math.round(total), 100);
    assert.ok(shares.COMMON > 50);
    assert.ok(shares.LEGENDARY < 0.5);
  });
});

describe("nearestAvailable", () => {
  it("steps down before stepping up", () => {
    const set = new Set<RarityName>(["UNCOMMON", "EPIC"]);
    assert.equal(nearestAvailable("RARE", set), "UNCOMMON");
    assert.equal(nearestAvailable("COMMON", set), "UNCOMMON");
    assert.equal(nearestAvailable("LEGENDARY", set), "EPIC");
    assert.equal(nearestAvailable("RARE", new Set()), null);
  });
});

describe("byRarityAscending", () => {
  it("puts the rarest last and keeps ties in draw order", () => {
    const sorted = byRarityAscending([
      { rarity: "EPIC" as const, id: 1 },
      { rarity: "COMMON" as const, id: 2 },
      { rarity: "COMMON" as const, id: 3 },
      { rarity: "UNCOMMON" as const, id: 4 },
    ]);
    assert.deepEqual(sorted.map((card) => card.id), [2, 3, 4, 1]);
  });
});

describe("rollShiny", () => {
  it("hits below one in N", () => {
    assert.equal(rollShiny(() => 0.00009, 10_000), true);
    assert.equal(rollShiny(() => 0.0001, 10_000), false);
    assert.equal(rollShiny(() => 0.5, 1), true);
  });

  it("is close to one in N over many draws", () => {
    let seed = 42;
    const random = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
    let hits = 0;
    for (let draw = 0; draw < 200_000; draw += 1) if (rollShiny(random, 1000)) hits += 1;
    assert.ok(hits > 160 && hits < 240, `${hits} shinies in 200k draws`);
  });
});
