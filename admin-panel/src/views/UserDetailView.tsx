import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { CardThumb, RarityTag, rarityColors } from "../components/RarityTag";
import { Avatar } from "../components/ui/Avatar";
import { Button } from "../components/ui/Button";
import { Card, Panel } from "../components/ui/Card";
import { ConfirmDialog } from "../components/ui/Dialog";
import { Meter } from "../components/ui/Meter";
import { Pagination } from "../components/ui/Pagination";
import { Seg } from "../components/ui/Seg";
import { SkeletonList, SkeletonPanel, SkeletonRegion } from "../components/ui/Skeleton";
import { MiniStatCard } from "../components/ui/StatCard";
import { Table } from "../components/ui/Table";
import { Tag } from "../components/ui/Tag";
import {
  GrantPacksDialog,
  SuspendDialog,
  UnlockCardDialog,
} from "../dialogs/PlayerDialogs";
import { useAdminAction, useAdminResource } from "../hooks/use-admin-resource";
import { onPlayer } from "../lib/live";
import { useAuditLabel, useLocale, useT } from "../i18n";
import { useSetPageHeading } from "../layouts/page-heading";
import { adminApi, type AdminUserDetail, type CollectionItem, type Rarity, RARITIES_DESC } from "../lib/api";
import { playerInitials, playerName } from "../lib/display";
import { formatDate, formatDateTime, formatNumber, formatRelative } from "../lib/format";

type Dialog = "grant" | "refill" | "unlock" | "suspend" | "reactivate" | null;

export function UserDetailView() {
  const { userId = "" } = useParams();
  const t = useT();
  const { intlLocale } = useLocale();
  const [dialog, setDialog] = useState<Dialog>(null);
  const [cardsVersion, setCardsVersion] = useState(0);
  const { run, busy } = useAdminAction();

  const { data, failed, reload } = useAdminResource(
    (user) => adminApi.userDetail(user, userId),
    [userId],
    { live: onPlayer(userId) },
  );

  useSetPageHeading(data ? { crumb: t.crumbs.userDetail, title: playerName(data) } : null);

  const refresh = () => {
    void reload({ silent: true });
    setCardsVersion((version) => version + 1);
  };

  if (!data) {
    return (
      <div className="p-[24px_28px_40px]">
        {failed ? (
          <Card className="p-6 text-sm text-muted">
            <span className="flex items-center gap-3">
              {t.common.loadError}
              <Button onClick={() => void reload()}>{t.common.retry}</Button>
            </span>
          </Card>
        ) : (
          <SkeletonRegion>
            <SkeletonPanel>
              <SkeletonList rows={6} />
            </SkeletonPanel>
          </SkeletonRegion>
        )}
      </div>
    );
  }

  const n = (value: number) => formatNumber(value, intlLocale);

  return (
    <div className="p-[24px_28px_40px]">
      <Link to="/admin/users" className="mb-4 inline-block text-[13px] text-accent-700 hover:text-accent">
        {t.userDetail.back}
      </Link>

      {data.suspendedAt ? (
        <Card className="mb-4 p-3 text-sm" style={{ background: "var(--color-accent-200)", color: "var(--color-accent-900)" }}>
          {t.userDetail.suspendedBanner(data.suspendedReason ?? "—")}
        </Card>
      ) : null}

      <Card className="mb-5 flex-row flex-wrap items-center gap-4 p-[18px_20px]">
        <Avatar initials={playerInitials(data)} photoUrl={data.photoUrl} size={56} />
        <div className="min-w-[200px] flex-1">
          <div className="flex items-center gap-2">
            <h4 className="m-0">{playerName(data)}</h4>
            {data.role === "ADMIN" ? <Tag tone="sage">{t.users.admin}</Tag> : null}
          </div>
          <div className="text-sm text-muted">{data.email}</div>
          <div className="mt-1 text-xs text-muted">
            {t.userDetail.joined} {formatDate(data.createdAt, intlLocale)} · {t.userDetail.lastSeen}{" "}
            {data.lastSeenAt ? formatRelative(data.lastSeenAt, intlLocale) : t.common.never} ·{" "}
            {t.userDetail.locale} {t.common.languageNames[data.locale] ?? data.locale}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="primary" onClick={() => setDialog("grant")}>
            {t.userDetail.grantPacks}
          </Button>
          <Button onClick={() => setDialog("refill")}>{t.userDetail.refill}</Button>
          <Button onClick={() => setDialog("unlock")}>{t.userDetail.unlockCard}</Button>
          {data.suspendedAt ? (
            <Button onClick={() => setDialog("reactivate")}>{t.userDetail.reactivate}</Button>
          ) : data.role !== "ADMIN" ? (
            <Button variant="danger" onClick={() => setDialog("suspend")}>
              {t.userDetail.suspend}
            </Button>
          ) : null}
        </div>
      </Card>

      <div className="auto-grid mb-5">
        <MiniStatCard
          kicker={t.userDetail.available}
          value={n(data.wallet.available)}
          meta={
            data.wallet.nextPackAt
              ? t.userDetail.nextPack(formatRelative(data.wallet.nextPackAt, intlLocale))
              : t.userDetail.walletFull
          }
        />
        <MiniStatCard
          kicker={t.userDetail.natural}
          value={`${n(data.wallet.natural)} / ${n(data.wallet.maxStored)}`}
          meta={`${t.userDetail.bonus} ${n(data.wallet.bonus)}`}
        />
        <MiniStatCard
          kicker={t.userDetail.completion}
          value={`${data.collection.completionPct.toLocaleString(intlLocale)} %`}
          meta={`${n(data.collection.uniqueOwned)} / ${n(data.collection.catalogSize)}`}
        />
        <MiniStatCard
          kicker={t.userDetail.score}
          value={n(data.collection.score)}
          meta={`${n(data.collection.totalCopies)} ${t.userDetail.copies.toLowerCase()}`}
        />
        <MiniStatCard
          kicker={t.userDetail.packsOpened}
          value={n(data.stats.packsOpened)}
          meta={
            data.stats.lastOpenedAt
              ? `${t.userDetail.packsOpened7d(n(data.stats.packsOpened7d))} · ${t.userDetail.lastOpened(formatRelative(data.stats.lastOpenedAt, intlLocale))}`
              : t.userDetail.packsOpened7d(n(data.stats.packsOpened7d))
          }
        />
      </div>

      <div className="panel-grid mb-5">
        <Panel title={t.userDetail.collectionTitle}>
          <div className="grid gap-3">
            {data.collection.byRarity.map((row, index) => (
              <Meter
                key={row.rarity}
                label={t.rarity[row.rarity] ?? row.rarity}
                value={`${n(row.owned)} / ${n(row.total)}`}
                sharePct={row.total > 0 ? (row.owned / row.total) * 100 : 0}
                depth={(index % 3) as 0 | 1 | 2}
              />
            ))}
          </div>
        </Panel>
        <RecentOpenings data={data} />
      </div>

      <PlayerCards userId={userId} version={cardsVersion} onChanged={refresh} />

      <Panel title={t.userDetail.auditTitle} className="mt-5">
        <AuditList entries={data.audit} />
      </Panel>

      {dialog === "grant" ? (
        <GrantPacksDialog userId={userId} onClose={() => setDialog(null)} onDone={refresh} />
      ) : null}
      {dialog === "unlock" ? (
        <UnlockCardDialog userId={userId} onClose={() => setDialog(null)} onDone={refresh} />
      ) : null}
      {dialog === "suspend" ? (
        <SuspendDialog userId={userId} onClose={() => setDialog(null)} onDone={refresh} />
      ) : null}
      {dialog === "refill" ? (
        <ConfirmDialog
          title={t.dialogs.refillTitle}
          message={t.dialogs.refillBody(data.wallet.maxStored)}
          confirmLabel={t.common.confirm}
          busy={busy}
          onCancel={() => setDialog(null)}
          onConfirm={() =>
            void run((user) => adminApi.refillPacks(user, userId), {
              success: t.dialogs.refilled,
              onDone: () => {
                refresh();
                setDialog(null);
              },
            })
          }
        />
      ) : null}
      {dialog === "reactivate" ? (
        <ConfirmDialog
          title={t.userDetail.reactivate}
          message={t.userDetail.suspendedBanner(data.suspendedReason ?? "—")}
          confirmLabel={t.userDetail.reactivate}
          busy={busy}
          onCancel={() => setDialog(null)}
          onConfirm={() =>
            void run((user) => adminApi.reactivate(user, userId), {
              success: t.dialogs.reactivated,
              onDone: () => {
                refresh();
                setDialog(null);
              },
            })
          }
        />
      ) : null}
    </div>
  );
}

function RecentOpenings({ data }: { data: AdminUserDetail }) {
  const t = useT();
  const { intlLocale } = useLocale();

  return (
    <Panel title={t.userDetail.recentTitle}>
      {data.recentOpenings.length === 0 ? (
        <p className="mb-0 text-sm text-muted">{t.userDetail.noOpenings}</p>
      ) : (
        <div className="grid gap-3">
          {data.recentOpenings.map((opening) => (
            <div key={opening.id} className="border-b border-divider pb-2 last:border-0">
              <div className="mb-1 flex items-center gap-2 text-xs text-muted">
                <span>{formatDateTime(opening.openedAt, intlLocale)}</span>
                <Tag tone={opening.source === "BONUS" ? "sage" : "outline"}>
                  {t.userDetail.source[opening.source]}
                </Tag>
              </div>
              <div className="flex flex-wrap gap-1">
                {opening.cards.map((entry) => (
                  <span
                    key={entry.slot}
                    className="rarity-tag max-w-[220px]"
                    style={rarityColors(entry.rarity)}
                    title={`${t.rarity[entry.rarity]} · ${entry.card.name}`}
                  >
                    <span className="truncate">
                      {entry.isShiny ? "✦ " : null}
                      {entry.card.name}
                    </span>
                    {entry.isNew ? <strong>{t.userDetail.newCard}</strong> : null}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}

function PlayerCards({
  userId,
  version,
  onChanged,
}: {
  userId: string;
  version: number;
  onChanged: () => void;
}) {
  const t = useT();
  const { intlLocale } = useLocale();
  const { run, busy } = useAdminAction();
  const [owned, setOwned] = useState<"all" | "owned" | "missing">("owned");
  const [rarity, setRarity] = useState<Rarity | "all">("all");
  const [page, setPage] = useState(1);
  const [removing, setRemoving] = useState<CollectionItem | null>(null);

  useEffect(() => setPage(1), [owned, rarity]);

  const { data, loading, failed, reload } = useAdminResource(
    (user) =>
      adminApi.userCards(user, userId, {
        page,
        pageSize: 20,
        owned,
        rarity: rarity === "all" ? undefined : rarity,
        sort: owned === "owned" ? "recent" : "rarity",
      }),
    [userId, page, owned, rarity, version],
    { live: onPlayer(userId) },
  );

  return (
    <Panel
      title={t.userDetail.cardsTitle}
      action={
        <div className="flex flex-wrap gap-2">
          <Seg
            value={owned}
            onChange={setOwned}
            options={[
              { value: "owned" as const, label: t.userDetail.ownedOwned },
              { value: "missing" as const, label: t.userDetail.ownedMissing },
              { value: "all" as const, label: t.userDetail.ownedAll },
            ]}
          />
          <select
            className="input"
            value={rarity}
            onChange={(event) => setRarity(event.target.value as Rarity | "all")}
          >
            <option value="all">{t.common.allRarities}</option>
            {RARITIES_DESC.map((value) => (
              <option key={value} value={value}>
                {t.rarity[value]}
              </option>
            ))}
          </select>
        </div>
      }
    >
      <Table
        rows={data?.items ?? []}
        rowKey={(row) => row.card.id}
        loading={loading}
        failed={failed}
        onRetry={() => void reload()}
        columns={[
          {
            header: t.cards.thCard,
            render: (row) => (
              <div className="flex items-center gap-3">
                <CardThumb src={row.card.imageUrl} size={30} />
                <span className="min-w-0 truncate">
                  <span className="text-muted">#{row.card.number}</span> {row.card.name}
                </span>
              </div>
            ),
          },
          { header: t.cards.thRarity, render: (row) => <RarityTag rarity={row.card.rarity} /> },
          {
            header: "",
            align: "right",
            render: (row) =>
              row.quantity > 0 ? (
                <span className="num text-sm">
                  {t.userDetail.quantity(row.quantity)}
                  {row.shinyQuantity > 0 ? (
                    <span className="ml-1 text-xs text-accent-700">✦ {t.userDetail.shinyQuantity(row.shinyQuantity)}</span>
                  ) : null}
                </span>
              ) : (
                <span className="text-xs text-muted">{t.userDetail.notOwned}</span>
              ),
          },
          {
            header: "",
            align: "right",
            render: (row) =>
              row.quantity > 0 ? (
                <Button className="btn-sm" onClick={() => setRemoving(row)}>
                  {t.userDetail.lock}
                </Button>
              ) : (
                <Button
                  className="btn-sm"
                  disabled={busy}
                  onClick={() =>
                    void run((user) => adminApi.unlockCard(user, userId, row.card.id), {
                      success: t.dialogs.unlocked(row.card.name),
                      onDone: onChanged,
                    })
                  }
                >
                  {t.userDetail.give}
                </Button>
              ),
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
              summary={`${formatNumber(data.total, intlLocale)} · ${data.page} / ${Math.max(1, Math.ceil(data.total / data.pageSize))}`}
            />
          ) : null
        }
      />

      {removing ? (
        <ConfirmDialog
          danger
          title={t.dialogs.lockTitle}
          message={t.dialogs.lockBody(removing.card.name, removing.quantity)}
          confirmLabel={t.userDetail.lock}
          busy={busy}
          onCancel={() => setRemoving(null)}
          onConfirm={() =>
            void run((user) => adminApi.lockCard(user, userId, removing.card.id), {
              success: t.dialogs.locked(removing.card.name),
              onDone: () => {
                setRemoving(null);
                onChanged();
              },
            })
          }
        />
      ) : null}
    </Panel>
  );
}

export function AuditList({ entries }: { entries: AdminUserDetail["audit"] }) {
  const t = useT();
  const { intlLocale } = useLocale();
  const label = useAuditLabel();

  if (entries.length === 0) {
    return <p className="mb-0 text-sm text-muted">{t.userDetail.noAudit}</p>;
  }

  return (
    <div className="grid gap-2">
      {entries.map((entry) => (
        <div key={entry.id} className="flex flex-wrap items-baseline gap-x-3 text-sm">
          <span className="w-[150px] flex-none text-xs text-muted">
            {formatDateTime(entry.createdAt, intlLocale)}
          </span>
          <span className="font-medium">{label(entry.action)}</span>
          <span className="text-xs text-muted">{describeMetadata(entry.metadata)}</span>
          <span className="ml-auto text-xs text-muted">{entry.actor?.email ?? "—"}</span>
        </div>
      ))}
    </div>
  );
}

/** A one-line, human reading of an audit entry's metadata. */
export function describeMetadata(metadata: Record<string, unknown>): string {
  return Object.entries(metadata)
    .filter(([key, value]) => value !== null && value !== undefined && !key.endsWith("Id"))
    .map(([key, value]) => `${key}: ${typeof value === "object" ? JSON.stringify(value) : String(value)}`)
    .join(" · ");
}
