import type { Card } from "../api/types";
import { cardNumber, formatCompact } from "../lib/format";
import { useI18n } from "../i18n/I18nProvider";

/**
 * One card. Everything is sized in `em` from `width` (font-size = width / 15),
 * so the same card works at 128 px in the history and 330 px in the reveal.
 */
export function CardFace({
  card,
  width,
  quantity,
  isNew,
  shiny,
  holo,
}: {
  card: Card;
  width: number;
  /** 0 renders the card as a silhouette: not collected yet. */
  quantity?: number;
  isNew?: boolean;
  /** A shiny copy: drawn one time in 10,000, any rarity. */
  shiny?: boolean;
  /** The moving sheen; on by default for an owned legendary. */
  holo?: boolean;
}) {
  const { t, locale } = useI18n();
  const hidden = quantity === 0;
  const isShiny = Boolean(shiny) && !hidden;
  const rarity = card.rarity.toLowerCase();
  const top = card.rarity === "EPIC" || card.rarity === "LEGENDARY";
  const showHolo = !hidden && (holo ?? card.rarity === "LEGENDARY");

  return (
    <div
      className={`mm-card r-${rarity}${hidden ? " is-hidden" : ""}${isShiny ? " is-shiny" : ""}`}
      style={{ width, fontSize: width / 15 }}
    >
      {top ? <div className="mm-card-inner" /> : null}
      <div className="mm-card-top">
        <span className="mm-card-num">{cardNumber(card.number)}</span>
        <span className="mm-card-gem" />
      </div>
      <div className="mm-art">
        {card.imageUrl && !hidden ? (
          <img className="mm-art-img" src={card.imageUrl} alt="" loading="lazy" />
        ) : (
          // About 40 % of the diseases have no picture on Wikimedia.
          <div className="mm-art-fill" />
        )}
        {hidden ? <span className="mm-art-q">?</span> : null}
        {!hidden && isNew ? <span className="mm-badge mm-badge--new">{t.card.new}</span> : null}
        {isShiny ? <span className="mm-badge mm-badge--shiny">✦ {t.card.shiny}</span> : null}
        {!hidden && quantity && quantity > 1 ? <span className="mm-badge mm-badge--qty">×{quantity}</span> : null}
      </div>
      <div className="mm-card-name" lang={hidden ? undefined : card.lang}>
        {hidden ? t.card.hidden : card.name}
        {/* The disease has no article in the player's language. */}
        {!hidden && card.lang !== locale ? <span className="mm-card-lang">{card.lang.toUpperCase()}</span> : null}
      </div>
      {!hidden && card.description ? (
        <div className="mm-card-desc" lang={card.lang}>
          {card.description}
        </div>
      ) : null}
      <div className="mm-card-foot">
        <span className="mm-card-rarity">{t.rarity[card.rarity]}</span>
        {!hidden ? (
          <span className="mm-card-views">
            {formatCompact(card.pageviews, locale)} {t.card.views}
          </span>
        ) : null}
      </div>
      {isShiny ? (
        <>
          <div className="mm-card-tint" />
          <div className="mm-card-frame" />
        </>
      ) : null}
      {showHolo ? <div className="mm-card-holo" /> : null}
    </div>
  );
}

/** A card that opens its detail. */
export function CardTile({ onClick, ...face }: Parameters<typeof CardFace>[0] & { onClick?: () => void }) {
  return (
    <button type="button" className="card-btn" onClick={onClick}>
      <CardFace {...face} />
    </button>
  );
}

/** A placeholder while a page loads: striped art, at half opacity. */
export function CardSkeleton({ width }: { width: number }) {
  return (
    <div className="mm-card is-skeleton" style={{ width, fontSize: width / 15 }} aria-hidden>
      <div className="mm-card-top">
        <span className="skel-line" style={{ width: "3em" }} />
      </div>
      <div className="mm-art">
        <div className="mm-art-fill" />
      </div>
      <div className="skel-line" style={{ width: "80%" }} />
      <div className="skel-line" style={{ width: "55%" }} />
    </div>
  );
}
