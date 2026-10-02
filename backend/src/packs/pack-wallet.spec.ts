import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { settleWallet, spendPack, viewWallet } from "./pack-wallet";

const RULES = { intervalMinutes: 10, maxStored: 10 };
const T0 = new Date("2026-10-01T12:00:00Z");
const minutes = (count: number) => new Date(T0.getTime() + count * 60_000);

describe("settleWallet", () => {
  it("adds one pack per elapsed interval and keeps the remainder", () => {
    const settled = settleWallet(
      { packsStored: 2, packsAnchorAt: T0, bonusPacks: 0 },
      RULES,
      minutes(25),
    );
    assert.equal(settled.packsStored, 4);
    assert.deepEqual(settled.packsAnchorAt, minutes(20));
  });

  it("caps at the maximum and stops banking time", () => {
    const settled = settleWallet(
      { packsStored: 8, packsAnchorAt: T0, bonusPacks: 0 },
      RULES,
      minutes(500),
    );
    assert.equal(settled.packsStored, 10);
    assert.deepEqual(settled.packsAnchorAt, minutes(500));
  });

  it("keeps packs above a lowered cap", () => {
    const settled = settleWallet(
      { packsStored: 12, packsAnchorAt: T0, bonusPacks: 0 },
      RULES,
      minutes(30),
    );
    assert.equal(settled.packsStored, 12);
  });
});

describe("spendPack", () => {
  it("restarts a full interval after spending from a full wallet", () => {
    const result = spendPack(
      { packsStored: 10, packsAnchorAt: T0, bonusPacks: 0 },
      RULES,
      minutes(3),
    );
    assert.ok(result.spent);
    assert.equal(result.state.packsStored, 9);
    const view = viewWallet(result.state, RULES, minutes(3));
    assert.deepEqual(view.nextPackAt, minutes(13));
  });

  it("keeps the running timer when the wallet was not full", () => {
    const result = spendPack(
      { packsStored: 3, packsAnchorAt: T0, bonusPacks: 0 },
      RULES,
      minutes(4),
    );
    assert.ok(result.spent);
    assert.deepEqual(viewWallet(result.state, RULES, minutes(4)).nextPackAt, minutes(10));
  });

  it("spends natural packs before bonus packs", () => {
    const first = spendPack(
      { packsStored: 1, packsAnchorAt: T0, bonusPacks: 2 },
      RULES,
      minutes(1),
    );
    assert.ok(first.spent && first.source === "NATURAL");
    const second = spendPack(first.state, RULES, minutes(1));
    assert.ok(second.spent && second.source === "BONUS");
    assert.equal(second.state.bonusPacks, 1);
  });

  it("refuses when nothing is left", () => {
    const result = spendPack(
      { packsStored: 0, packsAnchorAt: T0, bonusPacks: 0 },
      RULES,
      minutes(9),
    );
    assert.equal(result.spent, false);
  });
});

describe("viewWallet", () => {
  it("reports when the wallet will be full", () => {
    const view = viewWallet(
      { packsStored: 7, packsAnchorAt: T0, bonusPacks: 1 },
      RULES,
      minutes(5),
    );
    assert.equal(view.available, 8);
    assert.deepEqual(view.nextPackAt, minutes(10));
    assert.deepEqual(view.fullAt, minutes(30));
  });
});
