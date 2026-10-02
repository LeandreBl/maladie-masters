import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { CardThumb, RarityDot, RarityTag } from "../components/RarityTag";
import { AreaChart, AreaLegend } from "../components/ui/AreaChart";
import { Avatar } from "../components/ui/Avatar";
import { BarChart } from "../components/ui/BarChart";
import { Card, Panel } from "../components/ui/Card";
import { Meter } from "../components/ui/Meter";
import { Seg } from "../components/ui/Seg";
import {
  Skeleton,
  SkeletonChart,
  SkeletonList,
  SkeletonPanel,
  SkeletonRegion,
  SkeletonStat,
} from "../components/ui/Skeleton";
import { Sparkline } from "../components/ui/Sparkline";
import { StatCard } from "../components/ui/StatCard";
import { Tag } from "../components/ui/Tag";
import { useAdminResource } from "../hooks/use-admin-resource";
import { useLocale, useT } from "../i18n";
import { adminApi, type StatsOverview, type StatsSeries } from "../lib/api";
import { onEvents } from "../lib/live";
import { initialsOf, formatDayKey, formatNumber, formatRelative } from "../lib/format";

type Range = 7 | 30 | 90;

/**
 * The overview: four headline figures, daily activity, the catalog's shape,
 * the observed drop rates against the expected ones, the most collected cards
 * and collectors, and where the Wikipedia import stands.
 */
export function DashboardView() {
  const t = useT();
  const [range, setRange] = useState<Range>(30);

  // Live: the figures follow the players as they sign up and open packs.
  const overview = useAdminResource((user) => adminApi.overview(user), [], {
    live: onEvents("player.joined", "pack.opened", "audit.recorded", "sync.progress", "settings.updated"),
  });
  const series = useAdminResource((user) => adminApi.series(user, range), [range], {
    live: onEvents("player.joined", "pack.opened"),
  });
  const drops = useAdminResource((user) => adminApi.drops(user, range), [range], {
    live: onEvents("pack.opened", "settings.updated"),
  });
  const topCards = useAdminResource((user) => adminApi.topCards(user, 8), [], {
    live: onEvents("pack.opened", "audit.recorded"),
  });
  const topCollectors = useAdminResource((user) => adminApi.topCollectors(user, 8), [], {
    live: onEvents("pack.opened", "audit.recorded"),
  });

  if (!overview.data) {
    return overview.failed ? (
      <div className="p-[24px_28px_40px]">
        <Card className="p-6 text-sm text-muted">
          <span className="flex flex-wrap items-center gap-3">
            {t.common.loadError}
            <button type="button" className="btn btn-secondary" onClick={() => void overview.reload()}>
              {t.common.retry}
            </button>
          </span>
        </Card>
      </div>
    ) : (
      <DashboardSkeleton />
    );
  }

  const data = overview.data;

  return (
    <div className="p-[24px_28px_40px]">
      {data.cards.total === 0 ? (
        <Card className="mb-5 flex-row flex-wrap items-center gap-3 p-4 text-sm">
          {t.dashboard.empty}
          <Link className="btn btn-primary ml-auto" to="/admin/sync">
            {t.dashboard.openSync}
          </Link>
        </Card>
      ) : null}

      <Metrics data={data} series={series.data} />

      <div className="mb-5 flex flex-wrap items-center gap-3">
        <Seg
          ariaLabel={t.dashboard.activityTitle}
          value={range}
          onChange={setRange}
          options={[
            { value: 7 as const, label: t.dashboard.range7 },
            { value: 30 as const, label: t.dashboard.range30 },
            { value: 90 as const, label: t.dashboard.range90 },
          ]}
        />
      </div>

      <div className="panel-grid mb-5">
        <Panel
          title={t.dashboard.activityTitle}
          eyebrow={t.dashboard.activityEyebrow}
          action={
            <AreaLegend current={t.dashboard.legendPacks} previous={t.dashboard.legendPlayers} />
          }
        >
          {series.data ? <ActivityChart series={series.data} /> : <SkeletonChart height={220} />}
        </Panel>

        <Panel title={t.dashboard.dropsTitle} eyebrow={drops.data ? t.dashboard.dropsEyebrow(String(drops.data.total)) : undefined}>
          {drops.data ? (
            drops.data.total === 0 ? (
              <p className="mb-0 text-sm text-muted">{t.dashboard.dropsEmpty}</p>
            ) : (
              <div className="grid gap-3">
                {drops.data.byRarity.map((row) => (
                  <div key={row.rarity}>
                    <div className="mb-1 flex items-center gap-2 text-[13px]">
                      <RarityDot rarity={row.rarity} />
                      <span>{t.rarity[row.rarity]}</span>
                      <span className="ml-auto text-muted">
                        {t.dashboard.dropsExpected} {row.expectedPct.toLocaleString()} %
                      </span>
                      <span className="num w-[64px] text-right text-[15px]">
                        {row.pct.toLocaleString()} %
                      </span>
                    </div>
                    <div className="meter">
                      <span
                        style={{
                          width: `${Math.min(100, row.pct)}%`,
                          background: `var(--rarity-${row.rarity.toLowerCase()}-fg)`,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : (
            <SkeletonList rows={5} />
          )}
        </Panel>
      </div>

      <div className="panel-grid mb-5">
        <RarityCatalogPanel data={data} />
        <LanguagesPanel data={data} />
        <SyncPanel data={data} />
      </div>

      <div className="panel-grid">
        <Panel title={t.dashboard.topCardsTitle}>
          {topCards.data ? (
            <TopCardsList rows={topCards.data} />
          ) : (
            <SkeletonList rows={6} />
          )}
        </Panel>
        <Panel title={t.dashboard.topCollectorsTitle}>
          {topCollectors.data ? (
            <TopCollectorsList rows={topCollectors.data} />
          ) : (
            <SkeletonList rows={6} />
          )}
        </Panel>
      </div>
    </div>
  );
}

function Metrics({ data, series }: { data: StatsOverview; series: StatsSeries | null }) {
  const t = useT();
  const { intlLocale } = useLocale();
  const n = (value: number) => formatNumber(value, intlLocale);

  return (
    <div className="auto-grid mb-6">
      <StatCard
        kicker={t.dashboard.players}
        value={n(data.users.total)}
        delta={data.users.new7d > 0 ? t.dashboard.newPlayers(n(data.users.new7d)) : undefined}
        meta={t.dashboard.playersMeta(n(data.users.active7d), n(data.users.total))}
      >
        {series ? <Sparkline values={series.points.map((point) => point.activePlayers)} /> : null}
      </StatCard>

      <StatCard
        kicker={t.dashboard.packs}
        value={n(data.packs.opened24h)}
        meta={t.dashboard.packsMeta(n(data.packs.opened7d), n(data.packs.openedTotal))}
      >
        {series ? <Sparkline values={series.points.map((point) => point.packsOpened)} /> : null}
      </StatCard>

      <StatCard
        kicker={t.dashboard.catalog}
        value={n(data.cards.droppable)}
        meta={t.dashboard.catalogMeta(n(data.cards.total), n(data.cards.missing))}
      />

      <StatCard
        kicker={`✦ ${t.dashboard.shinies}`}
        value={n(data.packs.shiniesTotal)}
        meta={t.dashboard.shiniesMeta(n(data.packs.shinies7d), n(data.packs.shiniesTotal))}
      />

      <StatCard
        kicker={t.dashboard.collectors}
        value={n(data.collection.collectors)}
        delta={t.dashboard.copies(n(data.collection.copies))}
        deltaTone="sage"
        meta={
          <>
            {t.dashboard.collectorsMeta(data.collection.avgUniquePerCollector.toLocaleString(intlLocale))}
            {data.packs.bonusOutstanding > 0
              ? ` · ${t.dashboard.bonusOutstanding(n(data.packs.bonusOutstanding))}`
              : null}
          </>
        }
      />
    </div>
  );
}

/**
 * Packs opened as the filled line, active players as the dashed one. They
 * share a scale: the dashed line is a count of people, the solid one of packs,
 * and both are small integers per day.
 */
function ActivityChart({ series }: { series: StatsSeries }) {
  const { intlLocale } = useLocale();
  const points = series.points.map((point) => ({
    date: point.date,
    value: point.packsOpened,
    previous: point.activePlayers,
  }));
  const ticks = [0, Math.floor(points.length / 2), points.length - 1]
    .filter((index, position, all) => all.indexOf(index) === position && points[index])
    .map((index) => formatDayKey(points[index]!.date, intlLocale));

  return points.length > 1 ? (
    <AreaChart points={points} ticks={ticks} />
  ) : (
    <BarChart values={points.map((point) => point.value)} />
  );
}

function RarityCatalogPanel({ data }: { data: StatsOverview }) {
  const t = useT();
  const { intlLocale } = useLocale();
  const max = Math.max(1, ...data.cards.byRarity.map((row) => row.droppable));

  return (
    <Panel title={t.dashboard.rarityTitle} eyebrow={t.dashboard.rarityEyebrow}>
      <div className="grid gap-3">
        {data.cards.byRarity.map((row, index) => (
          <Meter
            key={row.rarity}
            label={t.rarity[row.rarity] ?? row.rarity}
            value={formatNumber(row.droppable, intlLocale)}
            sharePct={(row.droppable / max) * 100}
            depth={(index % 3) as 0 | 1 | 2}
          />
        ))}
      </div>
    </Panel>
  );
}

/**
 * How much of the catalog each language covers — the rest of its cards fall
 * back to English — and how many players read in it.
 */
function LanguagesPanel({ data }: { data: StatsOverview }) {
  const t = useT();
  const { intlLocale } = useLocale();
  const n = (value: number) => formatNumber(value, intlLocale);

  return (
    <Panel title={t.dashboard.languagesTitle} eyebrow={t.dashboard.languagesEyebrow}>
      <div className="grid gap-3">
        {data.cards.byLocale.map((row, index) => (
          <div key={row.locale}>
            <Meter
              label={t.common.languageNames[row.locale] ?? row.locale}
              value={t.dashboard.cardsInLanguage(n(row.count), n(data.cards.droppable))}
              sharePct={data.cards.droppable > 0 ? (row.count / data.cards.droppable) * 100 : 0}
              depth={(index % 3) as 0 | 1 | 2}
            />
            <div className="mt-1 text-xs text-muted">
              {t.dashboard.playersInLanguage(
                n(data.users.byLocale.find((entry) => entry.locale === row.locale)?.count ?? 0),
              )}
            </div>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function SyncPanel({ data }: { data: StatsOverview }) {
  const t = useT();
  const { intlLocale } = useLocale();
  const { sync } = data;
  const last = sync.lastSuccess;

  return (
    <Panel
      title={t.dashboard.syncTitle}
      action={
        <Link className="text-[13px] text-accent-700 hover:text-accent" to="/admin/sync">
          {t.dashboard.openSync} →
        </Link>
      }
    >
      <div className="grid gap-4">
        {sync.running ? <Tag tone="accent">{t.dashboard.syncRunning}</Tag> : null}
        <div>
          <div className="eyebrow text-muted">{t.dashboard.syncLast}</div>
          {last ? (
            <>
              <div className="num mt-[3px] text-2xl">
                {last.finishedAt ? formatRelative(last.finishedAt, intlLocale) : "—"}
              </div>
              <div className="text-xs text-muted">
                {t.sync.counters(
                  formatNumber(last.fetched, intlLocale),
                  formatNumber(last.created, intlLocale),
                  formatNumber(last.updated, intlLocale),
                  formatNumber(last.missing, intlLocale),
                  formatNumber(last.restored, intlLocale),
                )}
              </div>
            </>
          ) : (
            <div className="mt-[3px] text-sm text-muted">{t.dashboard.syncNever}</div>
          )}
        </div>
        <div>
          <div className="eyebrow text-muted">{t.dashboard.syncNext}</div>
          <div className="mt-[3px] text-sm">
            {sync.nextScheduledAt
              ? formatRelative(sync.nextScheduledAt, intlLocale)
              : t.dashboard.syncOff}
          </div>
        </div>
      </div>
    </Panel>
  );
}

function TopCardsList({ rows }: { rows: Awaited<ReturnType<typeof adminApi.topCards>> }) {
  const t = useT();
  const { intlLocale } = useLocale();
  if (rows.length === 0) return <p className="mb-0 text-sm text-muted">{t.common.noResults}</p>;

  return (
    <div className="grid gap-[10px]">
      {rows.map((row) => (
        <div key={row.card.id} className="flex items-center gap-3">
          <CardThumb src={row.card.imageUrl} size={32} />
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium">{row.card.name}</div>
            <div className="text-xs text-muted">
              {t.dashboard.owners(formatNumber(row.owners, intlLocale))}
            </div>
          </div>
          <RarityTag rarity={row.card.rarity} />
        </div>
      ))}
    </div>
  );
}

function TopCollectorsList({
  rows,
}: {
  rows: Awaited<ReturnType<typeof adminApi.topCollectors>>;
}) {
  const t = useT();
  const { intlLocale } = useLocale();
  const navigate = useNavigate();
  if (rows.length === 0) return <p className="mb-0 text-sm text-muted">{t.common.noResults}</p>;

  return (
    <div className="grid gap-[10px]">
      {rows.map((row) => (
        <button
          key={row.userId}
          type="button"
          className="flex items-center gap-3 text-left"
          onClick={() => navigate(`/admin/users/${row.userId}`)}
        >
          <span className="num w-5 text-muted">{row.rank}</span>
          <Avatar initials={initialsOf(row.displayName, "?")} photoUrl={row.photoUrl} size={28} />
          <span className="min-w-0 flex-1 truncate text-sm font-medium">
            {row.displayName ?? "—"}
          </span>
          <span className="text-xs text-muted">
            {t.dashboard.distinct(formatNumber(row.uniqueOwned, intlLocale))}
          </span>
          <span className="num w-[84px] text-right text-[15px]">
            {t.dashboard.points(formatNumber(row.score, intlLocale))}
          </span>
        </button>
      ))}
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <SkeletonRegion className="p-[24px_28px_40px]">
      <div className="auto-grid mb-6">
        {Array.from({ length: 4 }, (_, index) => (
          <Card key={index}>
            <SkeletonStat />
            {index < 2 ? <Skeleton className="h-[28px] w-full rounded-md" /> : null}
          </Card>
        ))}
      </div>
      <div className="panel-grid mb-5">
        <SkeletonPanel>
          <SkeletonChart height={220} />
        </SkeletonPanel>
        <SkeletonPanel>
          <SkeletonList rows={5} />
        </SkeletonPanel>
      </div>
    </SkeletonRegion>
  );
}
