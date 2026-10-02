import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Avatar } from "../components/ui/Avatar";
import { Card } from "../components/ui/Card";
import { Pagination } from "../components/ui/Pagination";
import { Seg } from "../components/ui/Seg";
import { Table } from "../components/ui/Table";
import { Tag } from "../components/ui/Tag";
import { useAdminResource } from "../hooks/use-admin-resource";
import { onEvents } from "../lib/live";
import { useLocale, useT } from "../i18n";
import { adminApi, type AdminUserRow, type UserFilter, type UserSort } from "../lib/api";
import { csvFilename, downloadCsv } from "../lib/csv";
import { playerInitials, playerName } from "../lib/display";
import { formatDate, formatNumber, formatRelative } from "../lib/format";

const PAGE_SIZE = 25;

/**
 * The player list. The filter tabs carry their own counts, served with the
 * page, so the number on a tab and the rows behind it can never disagree.
 */
export function UsersView({
  search,
  onExportReady,
}: {
  search: string;
  onExportReady: (exporter: (() => void) | null) => void;
}) {
  const t = useT();
  const { intlLocale } = useLocale();
  const navigate = useNavigate();

  const [filter, setFilter] = useState<UserFilter>("all");
  const [sort, setSort] = useState<UserSort>("lastSeen");
  const [page, setPage] = useState(1);
  const [applied, setApplied] = useState("");

  // The search fires once typing settles, and any change resets to page 1.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setApplied(search.trim());
      setPage(1);
    }, 350);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => setPage(1), [filter, sort]);

  const { data, loading, failed, reload } = useAdminResource(
    (user) =>
      adminApi.users(user, {
        page,
        pageSize: PAGE_SIZE,
        filter,
        sort,
        search: applied || undefined,
      }),
    [page, filter, sort, applied],
    { live: onEvents("player.joined", "pack.opened", "audit.recorded") },
  );

  const rows = useMemo(() => data?.items ?? [], [data]);

  const exportRows = useMemo(
    () => () =>
      downloadCsv(csvFilename("players"), rows, [
        { header: t.users.thPlayer, value: (row) => playerName(row) },
        { header: "Email", value: (row) => row.email },
        { header: t.users.thCards, value: (row) => row.uniqueCards },
        { header: t.users.thPacksOpened, value: (row) => row.packsOpened },
        { header: t.users.thPacksAvailable, value: (row) => row.packsAvailable },
        { header: t.users.thLastSeen, value: (row) => row.lastSeenAt ?? "" },
        { header: t.users.thJoined, value: (row) => row.createdAt },
      ]),
    [rows, t],
  );

  useEffect(() => {
    onExportReady(rows.length > 0 ? exportRows : null);
    return () => onExportReady(null);
  }, [rows.length, exportRows, onExportReady]);

  const countOf = (value: number | undefined) => value ?? (loading ? null : undefined);

  return (
    <div className="p-[24px_28px_40px]">
      <div className="mb-[18px] flex flex-wrap items-center gap-[10px]">
        <Seg
          ariaLabel={t.users.filterLabel}
          wrap
          value={filter}
          onChange={setFilter}
          options={[
            { value: "all" as const, label: t.users.filterAll, count: countOf(data?.counts.all) },
            { value: "active7d" as const, label: t.users.filterActive, count: countOf(data?.counts.active7d) },
            { value: "admins" as const, label: t.users.filterAdmins, count: countOf(data?.counts.admins) },
            { value: "suspended" as const, label: t.users.filterSuspended, count: countOf(data?.counts.suspended) },
          ]}
        />
        <Seg
          ariaLabel={t.users.sortLabel}
          value={sort}
          onChange={setSort}
          options={[
            { value: "lastSeen" as const, label: t.users.sortLastSeen },
            { value: "createdAt" as const, label: t.users.sortCreatedAt },
            { value: "cards" as const, label: t.users.sortCards },
            { value: "packs" as const, label: t.users.sortPacks },
          ]}
        />
      </div>

      <Card className="gap-0 p-[4px_16px_10px]">
        <Table
          rows={rows}
          rowKey={(row) => row.id}
          loading={loading}
          failed={failed}
          onRetry={() => void reload()}
          skeletonRows={10}
          onRowClick={(row) => navigate(`/admin/users/${row.id}`)}
          columns={[
            { header: t.users.thPlayer, render: (row) => <PlayerCell row={row} /> },
            {
              header: t.users.thStatus,
              render: (row) =>
                row.suspendedAt ? (
                  <Tag tone="accent">{t.users.suspended}</Tag>
                ) : (
                  <Tag tone="outline">{t.users.active}</Tag>
                ),
            },
            {
              header: t.users.thLocale,
              render: (row) => <Tag tone="outline">{row.locale.toUpperCase()}</Tag>,
            },
            {
              header: t.users.thCards,
              align: "right",
              className: "num text-sm",
              render: (row) => formatNumber(row.uniqueCards, intlLocale),
            },
            {
              header: t.users.thPacksOpened,
              align: "right",
              className: "num text-sm",
              render: (row) => formatNumber(row.packsOpened, intlLocale),
            },
            {
              header: t.users.thPacksAvailable,
              align: "right",
              className: "num text-sm",
              render: (row) => formatNumber(row.packsAvailable, intlLocale),
            },
            {
              header: t.users.thLastSeen,
              render: (row) => (
                <span className="text-muted">
                  {row.lastSeenAt ? formatRelative(row.lastSeenAt, intlLocale) : t.common.never}
                </span>
              ),
            },
            {
              header: t.users.thJoined,
              align: "right",
              render: (row) => <span className="text-muted">{formatDate(row.createdAt, intlLocale)}</span>,
            },
            { header: "", align: "right", render: () => <span className="text-muted">→</span> },
          ]}
          footer={
            data && data.total > 0 ? (
              <Pagination
                page={data.page}
                totalPages={Math.ceil(data.total / data.pageSize)}
                total={data.total}
                shown={rows.length}
                disabled={loading}
                onPage={setPage}
              />
            ) : null
          }
        />
      </Card>
    </div>
  );
}

function PlayerCell({ row }: { row: AdminUserRow }) {
  const t = useT();
  return (
    <div className="flex items-center gap-[10px]">
      <Avatar initials={playerInitials(row)} photoUrl={row.photoUrl} size={28} />
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="truncate font-medium">{playerName(row)}</span>
          {row.role === "ADMIN" ? <Tag tone="sage">{t.users.admin}</Tag> : null}
        </div>
        <div className="truncate text-xs text-muted">{row.email}</div>
      </div>
    </div>
  );
}
