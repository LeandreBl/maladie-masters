import { useMemo, useRef, useState } from "react";
import { ApiError, api } from "../api/client";
import { RARITIES_DESC, type PackOpening } from "../api/types";
import { useAuth, useMe, useUser } from "../auth/AuthProvider";
import { CardModal } from "../components/CardModal";
import { CardTile } from "../components/CardTile";
import { PackReveal, sortForReveal } from "../components/PackReveal";
import { useI18n } from "../i18n/I18nProvider";
import { clock } from "../lib/format";
import { prefersReducedMotion, useTimeToNextPack } from "../lib/hooks";

/** Home: the pack, the wallet, the last pack's cards and the collection progress. */
export function PacksPage() {
  const user = useUser();
  const me = useMe();
  const { refresh, setWallet } = useAuth();
  const { t } = useI18n();
  const [opening, setOpening] = useState<PackOpening | null>(null);
  const [last, setLast] = useState<PackOpening | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openCard, setOpenCard] = useState<string | null>(null);
  const pack = useRef<HTMLButtonElement>(null);
  const tear = useRef<Animation | null>(null);

  const wallet = me.packs;
  const left = useTimeToNextPack(wallet);
  const interval = wallet.intervalMinutes * 60_000;
  const lastCards = useMemo(() => (last ? sortForReveal(last.cards) : []), [last]);

  /** Draws a pack. Only the wallet is updated now: the collection counters would give the cards away. */
  async function draw(): Promise<PackOpening | null> {
    setBusy(true);
    setError(null);
    try {
      const next = await api.openPack(user);
      if (next.wallet) setWallet(next.wallet);
      return next;
    } catch (caught) {
      setError(caught instanceof ApiError ? (caught.code && t.errors[caught.code]) || caught.message : String(caught));
      return null;
    } finally {
      setBusy(false);
    }
  }

  /** The pack wobbles and tears open while the draw is on its way. */
  function playTear(): Promise<void> {
    if (!pack.current || prefersReducedMotion()) return Promise.resolve();
    tear.current = pack.current.animate(
      [
        { transform: "none" },
        { transform: "rotate(-4deg) scale(1.04)" },
        { transform: "rotate(4deg) scale(1.06)" },
        { transform: "rotate(-2deg) scale(1.1)" },
        { transform: "translateY(-30px) scale(1.25)", opacity: 0 },
      ],
      { duration: 380, easing: "ease-in", fill: "forwards" },
    );
    return tear.current.finished.then(
      () => undefined,
      () => undefined,
    );
  }

  function resetTear() {
    tear.current?.cancel();
    tear.current = null;
  }

  async function open() {
    if (busy || opening || wallet.available === 0) return;
    const [next] = await Promise.all([draw(), playTear()]);
    if (next) setOpening(next);
    else resetTear();
  }

  /** From the summary: straight into the next pack, without the tear. */
  async function again() {
    const next = await draw();
    if (next) setOpening(next);
  }

  function close() {
    setOpening(null);
    setError(null);
    resetTear();
  }

  const ghosts = Math.min(wallet.available, 3);

  return (
    <main className="page page--packs">
      <section className="packs-hero">
        <div className="panel pack-stage">
          <button
            ref={pack}
            type="button"
            className="pack"
            // Not disabled while busy: the pack would dim in the middle of its tear.
            disabled={wallet.available === 0}
            aria-label={t.packs.open}
            onClick={() => void open()}
          >
            {ghosts > 2 ? <span className="pack-ghost pack-ghost--3" /> : null}
            {ghosts > 1 ? <span className="pack-ghost pack-ghost--2" /> : null}
            <span className="pack-body">
              <span className="pack-crimp" />
              <span className="pack-face">
                <span className="seal">MM</span>
                <strong>{t.appName}</strong>
              </span>
              <span className="pack-band" />
            </span>
          </button>
        </div>

        <div className="panel wallet">
          <div>
            <h2 className="wallet-title">{t.packs.available(wallet.available)}</h2>
            <p className="wallet-sub">
              {t.packs.timer(wallet.natural, wallet.maxStored)}
              {wallet.bonus > 0 ? t.packs.bonus(wallet.bonus) : ""}
            </p>
          </div>
          <div className="pips" style={{ gridTemplateColumns: `repeat(${wallet.maxStored}, minmax(0, 1fr))` }}>
            {Array.from({ length: wallet.maxStored }, (_, i) => (
              <span key={i} className={i < wallet.natural ? "on" : undefined} />
            ))}
          </div>
          <div className="next-box">
            {left !== null ? (
              <>
                <div className="row">
                  <span>{t.packs.nextIn}</span>
                  <span className="clock">{clock(left)}</span>
                </div>
                <div className="bar">
                  <span style={{ width: `${Math.min(100, Math.max(0, ((interval - left) / interval) * 100))}%` }} />
                </div>
              </>
            ) : (
              <p className="muted">{t.packs.full(wallet.intervalMinutes)}</p>
            )}
          </div>
          <button
            type="button"
            className="btn btn-accent btn-cta"
            disabled={wallet.available === 0 || busy}
            onClick={() => void open()}
          >
            {busy && !opening ? t.packs.opening : last ? t.packs.openAnother : t.packs.open}
          </button>
          {error && !opening ? <p className="error">{error}</p> : null}
        </div>
      </section>

      {last ? (
        <section className="section">
          <h3 className="h3">{t.packs.last}</h3>
          <div className="card-row">
            {lastCards.map((entry) => (
              <CardTile
                key={entry.slot}
                card={entry.card}
                width={176}
                isNew={entry.isNew}
                shiny={entry.isShiny}
                onClick={() => setOpenCard(entry.card.id)}
              />
            ))}
          </div>
        </section>
      ) : null}

      <section className="section">
        <div className="section-head">
          <h3 className="h3">{t.packs.progress}</h3>
          <span className="muted">
            {t.packs.summary(
              me.collection.uniqueOwned,
              me.collection.catalogSize,
              me.collection.completionPct,
              me.collection.score,
            )}
            {me.collection.shinyOwned > 0 ? <> · ✦ {t.packs.shinyCount(me.collection.shinyOwned)}</> : null}
          </span>
        </div>
        <div className="tiles">
          {RARITIES_DESC.map((rarity) => {
            const row = me.collection.byRarity.find((entry) => entry.rarity === rarity);
            const owned = row?.owned ?? 0;
            const total = row?.total ?? 0;
            return (
              <div key={rarity} className={`panel tile r-${rarity.toLowerCase()}`}>
                <div className="tile-label">
                  <span className="diamond" />
                  {t.rarity[rarity]}
                </div>
                <div className="mono">
                  {owned} / {total}
                </div>
                <div className="bar">
                  <span style={{ width: `${Math.max(1.5, total ? (owned / total) * 100 : 0)}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {opening ? (
        <PackReveal
          key={opening.id}
          opening={opening}
          available={wallet.available}
          paused={openCard !== null}
          busy={busy}
          error={error}
          onCardClick={setOpenCard}
          onDone={() => {
            setLast(opening);
            void refresh();
          }}
          onAgain={() => void again()}
          onClose={close}
        />
      ) : null}

      {openCard ? <CardModal cardId={openCard} onClose={() => setOpenCard(null)} /> : null}
    </main>
  );
}
