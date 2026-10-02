import { useEffect, useState } from "react";
import { api } from "../api/client";
import {
  RARITIES_DESC,
  type CollectionItem,
  type CollectionSort,
  type OwnedFilter,
  type Page,
  type Rarity,
} from "../api/types";
import { useMe, useUser } from "../auth/AuthProvider";
import { CardModal } from "../components/CardModal";
import { CardSkeleton, CardTile } from "../components/CardTile";
import { Pager } from "../components/Pager";
import { useI18n } from "../i18n/I18nProvider";
import { useMediaQuery } from "../lib/hooks";
import { useRealtimeEvent } from "../realtime/RealtimeProvider";

const PAGE_SIZE = 48;
const OWNED_FILTERS: OwnedFilter[] = ["owned", "missing", "all", "shiny"];
const SORTS: CollectionSort[] = ["number", "name", "rarity", "popularity", "recent"];

export function CollectionPage() {
  const user = useUser();
  const me = useMe();
  const { t } = useI18n();
  const [owned, setOwned] = useState<OwnedFilter>("owned");
  const [rarity, setRarity] = useState<Rarity | "">("");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<CollectionSort>("number");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Page<CollectionItem> | null>(null);
  const [openCard, setOpenCard] = useState<string | null>(null);
  // Bumped when an admin adds or removes a card, to re-read the page.
  const [version, setVersion] = useState(0);
  // Two columns still fit on a phone.
  const cardWidth = useMediaQuery("(max-width: 640px)") ? 156 : 176;

  useRealtimeEvent((message) => {
    if (["card.granted", "card.removed", "realtime.resync"].includes(message.type)) {
      setVersion((current) => current + 1);
    }
  });

  useEffect(() => setPage(1), [owned, rarity, search, sort]);

  // `me.locale` in the dependencies: the names come back in the account's
  // language, so changing it re-reads the page.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      void api
        .collection(user, { page, pageSize: PAGE_SIZE, owned, rarity: rarity || undefined, search, sort })
        .then(setData);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [user, page, owned, rarity, search, sort, me.locale, version]);

  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
  const { collection } = me;
  const filters: Array<{ key: Rarity | ""; label: string; owned: number; total: number }> = [
    { key: "", label: t.collection.allRarities, owned: collection.uniqueOwned, total: collection.catalogSize },
    ...RARITIES_DESC.map((value) => {
      const row = collection.byRarity.find((entry) => entry.rarity === value);
      return { key: value, label: t.rarity[value], owned: row?.owned ?? 0, total: row?.total ?? 0 };
    }),
  ];

  return (
    <main className="page" style={{ ["--cw" as string]: `${cardWidth}px` }}>
      <div className="page-head">
        <h1 className="h1">{t.nav.collection}</h1>
        <span className="muted">
          {t.packs.summary(collection.uniqueOwned, collection.catalogSize, collection.completionPct, collection.score)}
        </span>
      </div>

      <div className="rarity-filters">
        {filters.map((filter) => (
          <button
            key={filter.key || "all"}
            type="button"
            className={`rarity-filter r-${filter.key ? filter.key.toLowerCase() : "all"}${rarity === filter.key ? " on" : ""}`}
            aria-pressed={rarity === filter.key}
            onClick={() => setRarity(filter.key)}
          >
            <span className="rarity-filter-label">
              <span className="diamond" />
              {filter.label}
            </span>
            <span className="mono">
              {filter.owned} / {filter.total}
            </span>
            <span className="bar">
              <span style={{ width: `${Math.max(1.5, filter.total ? (filter.owned / filter.total) * 100 : 0)}%` }} />
            </span>
          </button>
        ))}
      </div>

      <div className="panel toolbar">
        <div className="tabs" role="group">
          {OWNED_FILTERS.map((value) => (
            <button
              key={value}
              type="button"
              className={owned === value ? "on" : undefined}
              aria-pressed={owned === value}
              onClick={() => setOwned(value)}
            >
              {value === "shiny" ? `✦ ${t.collection.shiny}` : t.collection[value]}
            </button>
          ))}
        </div>
        <input
          className="input"
          type="search"
          placeholder={t.collection.search}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <label>
          {t.collection.sortBy}
          <select className="input" value={sort} onChange={(event) => setSort(event.target.value as CollectionSort)}>
            {SORTS.map((value) => (
              <option key={value} value={value}>
                {t.collection.sorts[value]}
              </option>
            ))}
          </select>
        </label>
        <span className="mono count">{t.collection.count(data ? String(data.total) : "…")}</span>
      </div>

      <div className="card-grid">
        {data
          ? data.items.map((item) => (
              <CardTile
                key={item.card.id}
                card={item.card}
                width={cardWidth}
                quantity={item.quantity}
                shiny={item.shinyQuantity > 0}
                onClick={() => setOpenCard(item.card.id)}
              />
            ))
          : Array.from({ length: 12 }, (_, i) => <CardSkeleton key={i} width={cardWidth} />)}
      </div>
      {data && data.items.length === 0 ? <p className="empty">{t.collection.count("0")}</p> : null}

      <Pager page={page} pages={pages} onPage={setPage} />

      {openCard ? <CardModal cardId={openCard} onClose={() => setOpenCard(null)} /> : null}
    </main>
  );
}
