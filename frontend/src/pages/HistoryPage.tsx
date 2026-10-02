import { useEffect, useState } from "react";
import { api } from "../api/client";
import type { PackOpening, Page } from "../api/types";
import { useMe, useUser } from "../auth/AuthProvider";
import { CardModal } from "../components/CardModal";
import { CardSkeleton, CardTile } from "../components/CardTile";
import { Pager } from "../components/Pager";
import { sortForReveal } from "../components/PackReveal";
import { useI18n } from "../i18n/I18nProvider";
import { intlLocale } from "../lib/format";

/** Every pack opened, the latest first, with the five cards it gave. */
export function HistoryPage() {
  const user = useUser();
  const me = useMe();
  const { t, locale } = useI18n();
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Page<PackOpening> | null>(null);
  const [openCard, setOpenCard] = useState<string | null>(null);

  // The names come back in the account's language.
  useEffect(() => {
    void api.history(user, page).then(setData);
  }, [user, page, me.locale]);

  const dates = new Intl.DateTimeFormat(intlLocale(locale), { dateStyle: "medium", timeStyle: "short" });
  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <main className="page">
      <h1 className="h1">{t.nav.history}</h1>
      <div className="history">
        {data
          ? data.items.map((opening) => (
              <div key={opening.id} className="panel history-row">
                <div className="history-meta">
                  <strong>{dates.format(new Date(opening.openedAt))}</strong>
                  <span className={opening.source === "BONUS" ? "source-pill bonus" : "source-pill"}>
                    {t.history.source[opening.source]}
                  </span>
                  <span className="muted">
                    {t.packs.newCount(opening.cards.filter((entry) => entry.isNew).length, opening.cards.length)}
                  </span>
                </div>
                <div className="history-cards">
                  {sortForReveal(opening.cards).map((entry) => (
                    <CardTile
                      key={entry.slot}
                      card={entry.card}
                      width={128}
                      isNew={entry.isNew}
                      shiny={entry.isShiny}
                      onClick={() => setOpenCard(entry.card.id)}
                    />
                  ))}
                </div>
              </div>
            ))
          : Array.from({ length: 3 }, (_, i) => (
              <div key={i} className="panel history-row">
                <div className="history-meta muted">{t.loading}</div>
                <div className="history-cards">
                  {Array.from({ length: 5 }, (_, j) => (
                    <CardSkeleton key={j} width={128} />
                  ))}
                </div>
              </div>
            ))}
      </div>
      {data && data.total > data.pageSize ? <Pager page={page} pages={pages} onPage={setPage} /> : null}
      {openCard ? <CardModal cardId={openCard} onClose={() => setOpenCard(null)} /> : null}
    </main>
  );
}
