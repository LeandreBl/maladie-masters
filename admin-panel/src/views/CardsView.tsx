import { useEffect, useMemo, useState } from "react";
import { FallbackHint, LanguageTags } from "../components/LanguageTags";
import { CardThumb, RarityTag } from "../components/RarityTag";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Pagination } from "../components/ui/Pagination";
import { Seg } from "../components/ui/Seg";
import { Table } from "../components/ui/Table";
import { Tag } from "../components/ui/Tag";
import { CardDialog } from "../dialogs/CardDialog";
import { useAdminAction, useAdminResource } from "../hooks/use-admin-resource";
import { onEvents, onSyncBoundary } from "../lib/live";
import { useLocale, useT } from "../i18n";
import {
  adminApi,
  RARITIES_DESC,
  type AdminCard,
  type CardSort,
  type CardStatus,
  type Rarity,
} from "../lib/api";
import { formatNumber } from "../lib/format";

const PAGE_SIZE = 30;

/** The catalog: every card the Wikipedia import created. */
export function CardsView({ search }: { search: string }) {
  const t = useT();
  const { intlLocale } = useLocale();
  const { run, busy } = useAdminAction();

  const [status, setStatus] = useState<CardStatus>("all");
  const [sort, setSort] = useState<CardSort>("popularity");
  const [rarity, setRarity] = useState<Rarity | "all">("all");
  const [page, setPage] = useState(1);
  const [applied, setApplied] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setApplied(search.trim());
      setPage(1);
    }, 350);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => setPage(1), [status, sort, rarity]);

  const { data, loading, failed, reload } = useAdminResource(
    (user) =>
      adminApi.cards(user, {
        page,
        pageSize: PAGE_SIZE,
        status,
        sort,
        rarity: rarity === "all" ? undefined : rarity,
        search: applied || undefined,
      }),
    [page, status, sort, rarity, applied],
    // Not on pack openings: they only move the owner counts, and would reload
    // the table under the operator's cursor all day long.
    {
      live: (message) =>
        onSyncBoundary(message) || onEvents("audit.recorded", "settings.updated")(message),
    },
  );

  const rows = useMemo(() => data?.items ?? [], [data]);
  const countOf = (value: number | undefined) => value ?? (loading ? null : undefined);

  return (
    <div className="p-[24px_28px_40px]">
      <div className="mb-[18px] flex flex-wrap items-center gap-[10px]">
        <Seg
          ariaLabel={t.cards.statusLabel}
          wrap
          value={status}
          onChange={setStatus}
          options={[
            { value: "all" as const, label: t.cards.statusAll, count: countOf(data?.counts.all) },
            { value: "enabled" as const, label: t.cards.statusEnabled, count: countOf(data?.counts.enabled) },
            { value: "disabled" as const, label: t.cards.statusDisabled, count: countOf(data?.counts.disabled) },
            { value: "missing" as const, label: t.cards.statusMissing, count: countOf(data?.counts.missing) },
            { value: "overridden" as const, label: t.cards.statusOverridden, count: countOf(data?.counts.overridden) },
          ]}
        />
        <select
          className="input w-auto"
          value={rarity}
          aria-label={t.cards.thRarity}
          onChange={(event) => setRarity(event.target.value as Rarity | "all")}
        >
          <option value="all">{t.common.allRarities}</option>
          {RARITIES_DESC.map((value) => (
            <option key={value} value={value}>
              {t.rarity[value]}
            </option>
          ))}
        </select>
        <Seg
          ariaLabel={t.cards.sortLabel}
          value={sort}
          onChange={setSort}
          options={[
            { value: "popularity" as const, label: t.cards.sortPopularity },
            { value: "number" as const, label: t.cards.sortNumber },
            { value: "name" as const, label: t.cards.sortName },
            { value: "owners" as const, label: t.cards.sortOwners },
            { value: "recent" as const, label: t.cards.sortRecent },
          ]}
        />
        <Button
          className="ml-auto"
          loading={busy}
          onClick={() =>
            void run((user) => adminApi.recomputeRarities(user), {
              success: (result) => t.cards.recomputed(result.changed, result.ranked),
              onDone: () => reload({ silent: true }),
            })
          }
        >
          {t.cards.recompute}
        </Button>
      </div>

      <Card className="gap-0 p-[4px_16px_10px]">
        <Table
          rows={rows}
          rowKey={(row) => row.id}
          loading={loading}
          failed={failed}
          onRetry={() => void reload()}
          skeletonRows={12}
          emptyLabel={t.cards.empty}
          onRowClick={(row) => setOpenId(row.id)}
          columns={[
            {
              header: t.cards.thCard,
              render: (row) => <CardCell card={row} />,
            },
            {
              header: t.cards.thRarity,
              render: (row) => (
                <span className="flex items-center gap-2">
                  <RarityTag rarity={row.rarity} />
                  {row.rarityOverride ? <Tag tone="outline">{t.cards.pinned}</Tag> : null}
                </span>
              ),
            },
            {
              header: t.cards.thViews,
              align: "right",
              className: "num text-sm",
              render: (row) => formatNumber(row.pageviews, intlLocale),
            },
            {
              header: t.cards.thRank,
              align: "right",
              className: "num text-sm",
              render: (row) => (row.popularityRank ? `#${row.popularityRank}` : "—"),
            },
            {
              header: t.cards.thLanguages,
              render: (row) => <LanguageTags languages={row.languages} />,
            },
            {
              header: t.cards.thOwners,
              align: "right",
              className: "num text-sm",
              render: (row) => formatNumber(row.owners, intlLocale),
            },
            {
              header: t.cards.thStatus,
              render: (row) => <CardStatusTag card={row} />,
            },
          ]}
          footer={
            data && data.total > 0 ? (
              <Pagination
                page={data.page}
                totalPages={Math.ceil(data.total / data.pageSize)}
                total={data.total}
                disabled={loading}
                onPage={setPage}
              />
            ) : null
          }
        />
      </Card>

      {openId ? (
        <CardDialog
          cardId={openId}
          onClose={() => setOpenId(null)}
          onChanged={() => void reload({ silent: true })}
        />
      ) : null}
    </div>
  );
}

function CardCell({ card }: { card: AdminCard }) {
  return (
    <div className="flex items-center gap-3">
      <CardThumb src={card.imageUrl} />
      <div className="min-w-0">
        <div className="truncate font-medium">
          <span className="text-muted">#{card.number}</span> {card.name}{" "}
          <FallbackHint lang={card.lang} />
        </div>
        <div className="truncate text-xs text-muted">{card.description ?? card.wikidataId}</div>
      </div>
    </div>
  );
}

export function CardStatusTag({ card }: { card: AdminCard }) {
  const t = useT();
  if (card.missingSince) return <Tag tone="accent">{t.cards.missing}</Tag>;
  if (!card.enabled) return <Tag tone="neutral">{t.cards.disabled}</Tag>;
  return <Tag tone="sage">{t.cards.enabled}</Tag>;
}
