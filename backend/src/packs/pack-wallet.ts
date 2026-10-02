/**
 * The pack timer, as pure functions.
 *
 * Nothing ticks in the background: a wallet stores how many packs it held at
 * `anchorAt`, and whatever accrued since is derived from the clock whenever the
 * wallet is read. The stored value is only rewritten when a pack is spent or
 * granted, after settling it.
 */
export interface WalletState {
  packsStored: number;
  packsAnchorAt: Date;
  bonusPacks: number;
}

export interface WalletRules {
  intervalMinutes: number;
  maxStored: number;
}

export interface WalletView {
  /** Natural plus bonus: what the player can open right now. */
  available: number;
  natural: number;
  bonus: number;
  maxStored: number;
  intervalMinutes: number;
  /** When the next natural pack arrives; null while the wallet is full. */
  nextPackAt: Date | null;
  /** When the natural packs reach the cap; null while already there. */
  fullAt: Date | null;
}

/**
 * Brings the stored count up to date with the clock.
 *
 * The anchor advances by whole intervals only, so the time already spent
 * towards the next pack is kept. A full wallet does not bank time: its anchor
 * moves to `now`, and the first pack after spending one takes a full interval.
 * A wallet above the cap — the cap was lowered — keeps its extra packs.
 */
export function settleWallet(
  state: WalletState,
  rules: WalletRules,
  now: Date,
): WalletState {
  const interval = Math.max(1, rules.intervalMinutes) * 60_000;
  const max = Math.max(0, rules.maxStored);

  if (state.packsStored >= max) {
    return { ...state, packsAnchorAt: now };
  }

  const elapsed = Math.max(0, now.getTime() - state.packsAnchorAt.getTime());
  const gained = Math.floor(elapsed / interval);
  const packsStored = Math.min(max, state.packsStored + gained);
  const packsAnchorAt =
    packsStored >= max
      ? now
      : new Date(state.packsAnchorAt.getTime() + gained * interval);

  return { ...state, packsStored, packsAnchorAt };
}

export function viewWallet(
  state: WalletState,
  rules: WalletRules,
  now: Date,
): WalletView {
  const settled = settleWallet(state, rules, now);
  const interval = Math.max(1, rules.intervalMinutes) * 60_000;
  const full = settled.packsStored >= rules.maxStored;
  const anchor = settled.packsAnchorAt.getTime();

  return {
    available: settled.packsStored + settled.bonusPacks,
    natural: settled.packsStored,
    bonus: settled.bonusPacks,
    maxStored: rules.maxStored,
    intervalMinutes: rules.intervalMinutes,
    nextPackAt: full ? null : new Date(anchor + interval),
    fullAt: full
      ? null
      : new Date(anchor + (rules.maxStored - settled.packsStored) * interval),
  };
}

export type SpendResult =
  | { spent: false; state: WalletState }
  | { spent: true; source: "NATURAL" | "BONUS"; state: WalletState };

/**
 * Takes one pack: a natural one first, so a full wallet starts refilling as
 * soon as possible, and a bonus one only when the timer has none to give.
 */
export function spendPack(
  state: WalletState,
  rules: WalletRules,
  now: Date,
): SpendResult {
  const settled = settleWallet(state, rules, now);

  if (settled.packsStored > 0) {
    return {
      spent: true,
      source: "NATURAL",
      state: { ...settled, packsStored: settled.packsStored - 1 },
    };
  }

  if (settled.bonusPacks > 0) {
    return {
      spent: true,
      source: "BONUS",
      state: { ...settled, bonusPacks: settled.bonusPacks - 1 },
    };
  }

  return { spent: false, state: settled };
}
