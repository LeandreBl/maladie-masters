import { useEffect, useRef, useState } from "react";
import { api } from "../api/client";
import type { CardDetail } from "../api/types";
import { useAuth, useUser } from "../auth/AuthProvider";
import { DICTIONARIES } from "../i18n/dictionaries";
import { useI18n } from "../i18n/I18nProvider";
import { cardNumber } from "../lib/format";
import { prefersReducedMotion } from "../lib/hooks";
import { CardFace, CardSkeleton } from "./CardTile";

export function CardModal({ cardId, onClose }: { cardId: string; onClose: () => void }) {
  const user = useUser();
  const { me } = useAuth();
  const { t, locale } = useI18n();
  const [card, setCard] = useState<CardDetail | null>(null);
  const panel = useRef<HTMLDivElement>(null);

  // Re-read when the account language changes: the text comes from the backend.
  useEffect(() => {
    void api.card(user, cardId).then(setCard);
  }, [user, cardId, me?.locale]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    if (prefersReducedMotion()) return;
    panel.current?.animate([{ opacity: 0, transform: "translateY(12px) scale(.97)" }, { opacity: 1, transform: "none" }], {
      duration: 200,
      easing: "cubic-bezier(.2,.8,.2,1)",
    });
  }, []);

  const owned = card ? card.quantity > 0 : false;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        ref={panel}
        className="modal"
        role="dialog"
        aria-modal="true"
        lang={card?.lang}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal-card">
          {card ? (
            <CardFace card={card} width={300} quantity={card.quantity} shiny={card.shinyQuantity > 0} />
          ) : (
            <CardSkeleton width={300} />
          )}
        </div>
        {!card ? (
          <p className="muted">{t.loading}</p>
        ) : (
          <div className={`modal-info r-${card.rarity.toLowerCase()}`}>
            <div className="modal-meta">
              <span className="mono">{cardNumber(card.number)}</span>
              <span className="rarity-pill">
                <span className="diamond" />
                {t.rarity[card.rarity]}
              </span>
            </div>
            <h2>{card.name}</h2>
            {card.description ? <p className="modal-desc">{card.description}</p> : null}
            {owned && card.extract ? <p>{card.extract}</p> : null}
            {card.lang !== locale ? (
              <p className="modal-note" lang={locale}>
                {t.card.shownIn(DICTIONARIES[card.lang].languageName)}
              </p>
            ) : null}
            {!owned ? <p style={{ fontWeight: 700 }}>{t.card.notOwned}</p> : null}
            <p lang={locale}>{t.card.owned(card.quantity, card.ownersCount, String(card.popularityRank ?? "—"))}</p>
            {card.shinyQuantity > 0 ? <p style={{ fontWeight: 700 }}>✦ {t.card.shinyOwned(card.shinyQuantity)}</p> : null}
            {card.icd10.length > 0 ? (
              <p>
                <span className="muted">{t.card.icd10} :</span> <span className="mono">{card.icd10.join(", ")}</span>
              </p>
            ) : null}
            {card.families.length > 0 ? (
              <div className="modal-families" lang={locale}>
                <span className="muted">{t.card.families} :</span>
                {card.families.map((family) => (
                  <span key={family.id} className="chip">
                    {family.icon ? `${family.icon} ` : ""}
                    {family.name}
                  </span>
                ))}
              </div>
            ) : null}
            <div className="modal-actions" lang={locale}>
              <a href={card.wikipediaUrl} target="_blank" rel="noreferrer">
                {t.card.readOnWikipedia}
              </a>
              <button type="button" className="btn btn-soft" onClick={onClose}>
                {t.close}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
