import { useEffect, useLayoutEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import { RARITIES_DESC, type PackOpening, type Rarity } from "../api/types";
import { useI18n } from "../i18n/I18nProvider";
import { prefersReducedMotion, useMediaQuery } from "../lib/hooks";
import { playCharge, playFlip, playLand, playPackDrop, setSoundEnabled, stopAll, useSoundEnabled } from "../lib/sound";
import { CardTile } from "./CardTile";

type Entry = PackOpening["cards"][number];

/** Effect colours: the reveal runs on a dark backdrop whatever the theme. */
const HEX: Record<Rarity, string> = {
  COMMON: "#a39b8f",
  UNCOMMON: "#86a95f",
  RARE: "#5f95d6",
  EPIC: "#b07ee0",
  LEGENDARY: "#f0b429",
};
const SHINY_HEX = "#ff7ab6";
const RAINBOW = ["#ff7ab6", "#ffd36e", "#7dffb0", "#7ab8ff"];
/** The base flip; rarer cards take a multiple of it. */
const FLIP_MS = 300;

/**
 * From the most common to the rarest, so the best card is always the last to
 * turn. The backend already sends them in that order; sorting here keeps the
 * suspense intact whatever the response order.
 */
export function sortForReveal(cards: Entry[]): Entry[] {
  return cards
    .map((entry, index) => ({ entry, index }))
    .sort(
      (a, b) =>
        RARITIES_DESC.indexOf(b.entry.rarity) - RARITIES_DESC.indexOf(a.entry.rarity) || a.index - b.index,
    )
    .map(({ entry }) => entry);
}

/**
 * The reveal of a pack, card by card, over the whole screen.
 *
 * The backend opens the whole pack in one call and the response already holds
 * every card: the suspense is purely a matter of presentation. The player
 * flips them one at a time by tapping the stack (or with Space / Enter). An
 * epic, a legendary or a shiny first charges up, with the input locked, then
 * lands with rays, rings, particles and a flash. The last card stays up, alone
 * and centred, until the player clicks outside it — players screenshot their
 * best card — and only then comes the summary, which a click outside closes.
 * There is no skipping ahead: every card is turned by hand.
 *
 * Every effect is an imperative Web Animations call on a ref, so a React
 * re-render never restarts one.
 */
export function PackReveal({
  opening,
  available,
  paused,
  busy,
  error,
  onCardClick,
  onDone,
  onAgain,
  onClose,
}: {
  opening: PackOpening;
  /** Packs left: the summary offers the next one when there is any. */
  available: number;
  /** A card's detail is open on top: the keyboard must not flip. */
  paused: boolean;
  /** The next pack is being drawn. */
  busy: boolean;
  error: string | null;
  onCardClick: (cardId: string) => void;
  /** Called once every card is up: the profile can be refreshed then. */
  onDone: () => void;
  onAgain: () => void;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const cards = useMemo(() => sortForReveal(opening.cards), [opening.cards]);
  const [revealed, setRevealed] = useState(0);
  const [phase, setPhase] = useState<"reveal" | "summary">("reveal");
  // The last card has landed: the summary can be asked for. Not earlier, so
  // the tap that turned it cannot also send it away.
  const [ready, setReady] = useState(false);
  const narrow = useMediaQuery("(max-width: 420px)");
  const cardWidth = narrow ? 260 : 330;
  const reduced = useMemo(prefersReducedMotion, []);
  const sound = useSoundEnabled();

  const dim = useRef<HTMLDivElement>(null);
  const rays = useRef<HTMLDivElement>(null);
  const glow = useRef<HTMLDivElement>(null);
  const ring1 = useRef<HTMLDivElement>(null);
  const ring2 = useRef<HTMLDivElement>(null);
  const cardEl = useRef<HTMLDivElement>(null);
  const stamp = useRef<HTMLDivElement>(null);
  const fx = useRef<HTMLDivElement>(null);
  const stackGlow = useRef<HTMLDivElement>(null);
  const stack = useRef<HTMLButtonElement>(null);
  const flash = useRef<HTMLDivElement>(null);
  const summary = useRef<HTMLDivElement>(null);

  // The input is locked while a card charges up.
  const locked = useRef(false);
  const revealedRef = useRef(0);
  const timers = useRef<number[]>([]);

  const later = (run: () => void, ms: number) => {
    timers.current.push(window.setTimeout(run, ms));
  };
  const clearTimers = () => {
    timers.current.forEach((timer) => window.clearTimeout(timer));
    timers.current = [];
  };

  function resetFx() {
    for (const layer of [dim, rays, glow, ring1, ring2, stamp, stackGlow, flash]) {
      layer.current?.getAnimations().forEach((animation) => animation.cancel());
    }
    if (stackGlow.current) stackGlow.current.style.filter = "none";
    if (fx.current) fx.current.replaceChildren();
  }

  function toSummary() {
    clearTimers();
    locked.current = false;
    resetFx();
    revealedRef.current = cards.length;
    setPhase("summary");
  }

  /** Particles thrown out of the card's centre. */
  function burst(count: number, hex: string, spread: number) {
    const host = fx.current;
    if (!host) return;
    for (let i = 0; i < count; i++) {
      const dot = document.createElement("div");
      const size = 3 + Math.random() * 7;
      const angle = Math.random() * Math.PI * 2;
      const distance = spread * (0.45 + Math.random() * 0.55);
      dot.style.cssText = `position:absolute;left:0;top:0;width:${size}px;height:${size}px;border-radius:${Math.random() < 0.5 ? "50%" : "1px"};background:${i % 4 === 0 ? "#fff" : hex};box-shadow:0 0 12px ${hex}`;
      host.appendChild(dot);
      dot.animate(
        [
          { transform: "translate(-50%,-50%) scale(1)", opacity: 1 },
          {
            transform: `translate(${Math.cos(angle) * distance}px, ${Math.sin(angle) * distance}px) scale(0) rotate(${Math.random() * 360}deg)`,
            opacity: 0,
          },
        ],
        { duration: 700 + Math.random() * 600, easing: "cubic-bezier(.1,.75,.3,1)" },
      ).onfinish = () => dot.remove();
    }
  }

  /** Sparks drifting up-left from the stack while a card charges. */
  function sparks(count: number, hex: string, duration: number) {
    const host = fx.current;
    if (!host) return;
    for (let i = 0; i < count; i++) {
      const dot = document.createElement("div");
      const x = 260 + Math.random() * 120;
      const y = (Math.random() - 0.5) * 200;
      dot.style.cssText = `position:absolute;left:${x}px;top:${y}px;width:4px;height:4px;border-radius:50%;background:${hex};box-shadow:0 0 10px ${hex}`;
      host.appendChild(dot);
      dot.animate(
        [
          { opacity: 0, transform: "translate(0,0)" },
          { opacity: 1 },
          { opacity: 0, transform: `translate(${-60 - Math.random() * 80}px, ${-80 - Math.random() * 120}px)` },
        ],
        {
          duration: duration * (0.6 + Math.random() * 0.4),
          delay: Math.random() * duration * 0.4,
          easing: "ease-out",
          fill: "both",
        },
      ).onfinish = () => dot.remove();
    }
  }

  function ring(el: HTMLDivElement | null, hex: string, scale: number, duration: number, delay: number) {
    if (!el) return;
    el.style.borderColor = hex;
    el.style.boxShadow = `0 0 30px ${hex}, inset 0 0 30px ${hex}`;
    el.animate(
      [
        { opacity: 0.95, transform: "scale(.4)" },
        { opacity: 0, transform: `scale(${scale})` },
      ],
      { duration, delay, easing: "cubic-bezier(.15,.7,.3,1)", fill: "both" },
    );
  }

  /** The build-up before an epic, a legendary or a shiny. Returns its length. */
  function charge(kind: Rarity | "SHINY"): number {
    const shiny = kind === "SHINY";
    const legendary = kind === "LEGENDARY" || shiny;
    const duration = shiny ? 1550 : legendary ? 1150 : 560;
    playCharge(kind, duration);
    const hex = shiny ? SHINY_HEX : HEX[kind];
    const amplitude = shiny ? 11 : legendary ? 9 : 5;
    const steps = legendary ? 18 : 10;

    const shake: Keyframe[] = [];
    for (let i = 0; i <= steps; i++) {
      const a = amplitude * (i / steps) * (i % 2 ? 1 : -1);
      shake.push({ transform: `translate(${a}px, ${-a * 0.4}px) rotate(${a * 0.4}deg) scale(${1 + (0.06 * i) / steps})` });
    }
    stack.current?.animate(shake, { duration, easing: "ease-in" });

    const sg = stackGlow.current;
    if (sg) {
      sg.style.background = shiny
        ? "conic-gradient(from 0deg, #ff7ab6, #ffd36e, #7dffb0, #7ab8ff, #c47aff, #ff7ab6)"
        : `radial-gradient(circle, ${hex} 0%, transparent 65%)`;
      sg.style.filter = shiny ? "blur(30px)" : "none";
      if (shiny) sg.animate([{ rotate: "0deg" }, { rotate: "360deg" }], { duration: 1200, iterations: Infinity });
      sg.animate(
        [
          { opacity: 0, transform: "scale(.6)" },
          { opacity: legendary ? 1 : 0.8, transform: "scale(1.35)" },
        ],
        { duration, easing: "ease-in", fill: "forwards" },
      );
    }
    dim.current?.animate([{ opacity: 0 }, { opacity: legendary ? 0.85 : 0.5 }], { duration, fill: "forwards" });

    if (legendary && rays.current) {
      rays.current.style.background = shiny
        ? "repeating-conic-gradient(from 0deg, #ff7ab655 0deg 5deg, transparent 5deg 15deg, #7ab8ff55 15deg 20deg, transparent 20deg 30deg, #ffd36e55 30deg 35deg, transparent 35deg 45deg)"
        : `repeating-conic-gradient(from 0deg, ${hex}55 0deg 5deg, transparent 5deg 15deg)`;
      rays.current.animate(
        [
          { opacity: 0, transform: "scale(.5) rotate(0deg)" },
          { opacity: 0.35, transform: "scale(.9) rotate(40deg)" },
        ],
        { duration, easing: "ease-in", fill: "forwards" },
      );
      sparks(shiny ? 22 : 10, shiny ? "#ffffff" : hex, duration);
    }
    return duration;
  }

  /** The card just turned lands, with its rarity's flourish. */
  function land(entry: Entry, last: boolean) {
    resetFx();
    const shiny = entry.isShiny;
    const rarity = entry.rarity;
    const legendary = rarity === "LEGENDARY" || shiny;
    const epic = rarity === "EPIC";
    const rare = rarity === "RARE";
    const big = legendary || epic;
    const hex = shiny ? SHINY_HEX : HEX[rarity];
    const duration = shiny
      ? FLIP_MS * 2.2
      : legendary
        ? FLIP_MS * 1.9
        : epic
          ? FLIP_MS * 1.5
          : rare
            ? FLIP_MS * 1.15
            : FLIP_MS;
    const readyIn = shiny ? 3000 : legendary ? 2600 : epic ? 2000 : 1100;
    const markReady = () => setReady(true);

    playFlip();
    playLand(rarity, shiny);

    if (reduced) {
      cardEl.current?.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 150 });
      if (last) later(markReady, readyIn);
      return;
    }

    cardEl.current?.animate(
      big
        ? [
            { transform: "translateX(300px) rotateY(-90deg) scale(.55)", opacity: 0.5 },
            { transform: "translateX(0) rotateY(12deg) scale(1.18)", opacity: 1, offset: 0.6 },
            { transform: "none" },
          ]
        : [
            { transform: "translateX(300px) rotateY(-90deg) scale(.55)", opacity: 0.6 },
            { transform: "none", opacity: 1 },
          ],
      { duration, easing: "cubic-bezier(.2,.8,.2,1)" },
    );
    dim.current?.animate([{ opacity: big ? (legendary ? 0.85 : 0.5) : 0 }, { opacity: big ? 0.35 : 0 }], {
      duration: 700,
      fill: "forwards",
    });

    if (rare || big) {
      if (glow.current) {
        glow.current.style.background = `radial-gradient(circle, ${hex}${legendary ? "aa" : "77"} 0%, transparent 62%)`;
        glow.current.animate(
          [
            { opacity: 0, transform: "scale(.6)" },
            { opacity: 1, transform: "scale(1.15)", offset: 0.35 },
            { opacity: legendary ? 0.8 : 0.5, transform: "scale(1)" },
          ],
          { duration: duration + 500, fill: "forwards", easing: "ease-out" },
        );
      }
      ring(ring1.current, hex, legendary ? 4.5 : epic ? 3.2 : 2, legendary ? 900 : 700, big ? duration * 0.45 : 0);
      burst(legendary ? 46 : epic ? 22 : 8, hex, legendary ? 520 : epic ? 360 : 220);
    }

    if (big) {
      flash.current?.animate([{ opacity: legendary ? 0.95 : 0.55 }, { opacity: 0 }], {
        duration: legendary ? 520 : 320,
        easing: "ease-out",
      });
      const label = stamp.current;
      if (label) {
        label.textContent = shiny ? `✦ ${t.card.shinyDrawn} ✦` : t.rarity[rarity];
        label.style.color = shiny ? "#fff" : hex;
        label.style.textShadow = shiny ? "0 0 18px #ff7ab6, 0 0 36px #7ab8ff" : `0 0 24px ${hex}`;
        label.animate(
          [
            { opacity: 0, transform: "scale(1.8)", letterSpacing: "0.6em" },
            { opacity: 1, transform: "scale(1)", letterSpacing: "0.22em" },
          ],
          { duration: 420, delay: duration * 0.5, easing: "cubic-bezier(.2,.9,.2,1.2)", fill: "both" },
        );
      }
    }

    if (shiny) {
      // Above a legendary: rainbow bursts, a blue ring and a second, pink flash.
      RAINBOW.forEach((colour, k) => later(() => burst(12, colour, 460), duration * 0.4 + k * 60));
      ring(ring1.current, "#7ab8ff", 5.5, 1100, duration * 0.45);
      later(
        () =>
          flash.current?.animate(
            [
              { opacity: 0.8, background: "#ffd6ec" },
              { opacity: 0, background: "#ffd6ec" },
            ],
            { duration: 600, easing: "ease-out" },
          ),
        280,
      );
    }

    if (legendary) {
      ring(ring2.current, "#fff", 3.2, 1100, duration * 0.55);
      later(() => burst(26, "#ffe08a", 420), duration * 0.5);
      // The rays keep turning for as long as the card is shown.
      rays.current?.animate(
        [
          { opacity: 0.6, transform: "scale(1) rotate(0deg)" },
          { opacity: 0.6, transform: "scale(1) rotate(360deg)" },
        ],
        { duration: 16_000, iterations: Infinity },
      );
    }

    if (last) later(markReady, readyIn);
  }

  function flip() {
    if (phase !== "reveal" || locked.current) return;
    const index = revealedRef.current;
    if (index >= cards.length) {
      if (ready) toSummary();
      return;
    }
    const entry = cards[index];
    const advance = () => {
      revealedRef.current = index + 1;
      setRevealed(index + 1);
    };
    const charged = entry.isShiny || entry.rarity === "EPIC" || entry.rarity === "LEGENDARY";
    if (charged && !reduced) {
      locked.current = true;
      later(
        () => {
          locked.current = false;
          advance();
        },
        charge(entry.isShiny ? "SHINY" : entry.rarity),
      );
    } else {
      advance();
    }
  }

  /** A click on the backdrop: on to the summary, then out. Cards and buttons
   * keep their own clicks. */
  function onBackdropClick(event: MouseEvent) {
    if (paused) return;
    if ((event.target as Element).closest(".mm-card, button, a")) return;
    if (phase === "summary") onClose();
    else if (ready) toSummary();
  }

  // The window listener always calls the latest `flip`.
  const flipRef = useRef(flip);
  flipRef.current = flip;

  // The new card is in the DOM: play its landing.
  useLayoutEffect(() => {
    if (phase !== "reveal" || revealed === 0) return;
    land(cards[revealed - 1], revealed === cards.length);
    // `land` only reads refs and the entry it is given.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [revealed]);

  // The stack drops in; the page under the overlay stops scrolling.
  useLayoutEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    stack.current?.focus({ preventScroll: true });
    playPackDrop();
    if (!reduced) {
      stack.current?.animate(
        [
          { transform: "translateY(-120px) scale(1.15) rotate(-6deg)", opacity: 0 },
          { transform: "none", opacity: 1 },
        ],
        { duration: 340, easing: "cubic-bezier(.2,.9,.25,1.15)" },
      );
    }
    return () => {
      document.body.style.overflow = previous;
      clearTimers();
      stopAll();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (phase !== "reveal" || paused) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === " " || event.key === "Enter") {
        event.preventDefault();
        flipRef.current();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase, paused]);

  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;
  useLayoutEffect(() => {
    if (phase !== "summary") return;
    onDoneRef.current();
    if (reduced || !summary.current) return;
    [...summary.current.children].forEach((el, i) =>
      el.animate(
        [
          { opacity: 0, transform: "translateY(40px) scale(.9)" },
          { opacity: 1, transform: "none" },
        ],
        { duration: 320, delay: i * 60, easing: "cubic-bezier(.2,.8,.2,1)", fill: "backwards" },
      ),
    );
  }, [phase, reduced]);

  const current = revealed > 0 ? cards[revealed - 1] : null;
  const remaining = cards.length - revealed;

  return (
    <div className="reveal" role="dialog" aria-modal="true" aria-label={t.packs.open} onClick={onBackdropClick}>
      <div ref={dim} className="fx-layer reveal-dim" />
      <div className="reveal-top">
        <span className="logo">{t.appName}</span>
        <div className="reveal-tools">
          <button
            type="button"
            className="reveal-sound"
            aria-pressed={sound}
            aria-label={sound ? t.packs.soundOff : t.packs.soundOn}
            title={sound ? t.packs.soundOff : t.packs.soundOn}
            onClick={() => setSoundEnabled(!sound)}
          >
            {sound ? "🔊" : "🔇"}
          </button>
        </div>
      </div>

      {phase === "reveal" ? (
        <div className="reveal-stage">
          <div className="reveal-row">
            <div className="reveal-slot" style={{ width: cardWidth, height: cardWidth * 1.4 }}>
              <div ref={rays} className="fx-layer reveal-rays" />
              <div ref={glow} className="fx-layer reveal-glow" />
              <div ref={ring1} className="fx-layer reveal-ring" />
              <div ref={ring2} className="fx-layer reveal-ring reveal-ring--2" />
              {current ? null : <div className="reveal-slot-empty" />}
              <div ref={cardEl} className="reveal-card">
                {current ? (
                  <CardTile
                    key={current.slot}
                    card={current.card}
                    width={cardWidth}
                    isNew={current.isNew}
                    shiny={current.isShiny}
                    onClick={() => onCardClick(current.card.id)}
                  />
                ) : null}
              </div>
              <div ref={stamp} className="fx-layer reveal-stamp" aria-hidden />
              <div ref={fx} className="fx-layer reveal-fx" />
            </div>

            {/* Gone with the last card, so that card stands alone in the centre. */}
            {remaining > 0 ? (
              <div className="reveal-side">
                <div className="reveal-pile">
                  <div ref={stackGlow} className="fx-layer reveal-sglow" />
                  <button
                    ref={stack}
                    type="button"
                    className="reveal-stack"
                    aria-label={t.packs.tapToReveal}
                    onClick={flip}
                  >
                    {Array.from({ length: remaining }, (_, i) => (
                      <span
                        key={i}
                        className="card-back"
                        style={{ transform: `translate(${i * 3}px, ${-i * 3}px) rotate(${(i - 2) * 0.8}deg)` }}
                      >
                        <span>MM</span>
                      </span>
                    ))}
                  </button>
                </div>
                <p className="reveal-hint">
                  {t.packs.tapToReveal} · {t.packs.remaining(remaining)}
                </p>
              </div>
            ) : null}
          </div>

          <div className="reveal-dots">
            {cards.map((entry, i) => (
              <span key={entry.slot} className={i < revealed ? `on r-${entry.rarity.toLowerCase()}` : undefined} />
            ))}
          </div>
        </div>
      ) : (
        <div className="reveal-summary">
          <div className="reveal-summary-head">
            <h2>
              {t.packs.newCount(
                cards.filter((entry) => entry.isNew).length,
                cards.length,
              )}
            </h2>
            {cards.some((entry) => entry.isShiny) ? (
              <span className="shiny-pill">
                ✦ {t.packs.shinyCount(cards.filter((entry) => entry.isShiny).length)}
              </span>
            ) : null}
            {/* Only in the summary: shown during the reveal, it would give away which cards are coming. */}
            {opening.completedFamilies?.map((family) => (
              <span key={family.id} className="family-done-pill">
                {family.icon ?? "◆"} {t.packs.familyCompleted(family.name, family.bonusPoints)}
              </span>
            ))}
          </div>
          <div ref={summary} className="reveal-summary-cards">
            {cards.map((entry) => (
              <CardTile
                key={entry.slot}
                card={entry.card}
                width={narrow ? 150 : 200}
                isNew={entry.isNew}
                shiny={entry.isShiny}
                onClick={() => onCardClick(entry.card.id)}
              />
            ))}
          </div>
          <div className="reveal-actions">
            {available > 0 ? (
              <button type="button" className="btn btn-accent" disabled={busy} onClick={onAgain}>
                {busy ? t.packs.opening : t.packs.openAnother}
              </button>
            ) : null}
            <button type="button" className="btn btn-on-dark" onClick={onClose}>
              {t.close}
            </button>
          </div>
          {error ? <p className="error">{error}</p> : null}
        </div>
      )}

      <div ref={flash} className="fx-layer reveal-flash" />
    </div>
  );
}
