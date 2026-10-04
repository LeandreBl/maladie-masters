import { useNavigate } from "react-router-dom";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Table } from "../components/ui/Table";
import { Tag } from "../components/ui/Tag";
import { useAdminAction, useAdminResource } from "../hooks/use-admin-resource";
import { useLocale, useT } from "../i18n";
import { adminApi } from "../lib/api";
import { formatNumber } from "../lib/format";
import { onEvents, onSyncBoundary } from "../lib/live";

/** The families: themed sets of cards, each worth a bonus once completed. */
export function FamiliesView() {
  const t = useT();
  const { intlLocale } = useLocale();
  const navigate = useNavigate();
  const { run, busy } = useAdminAction();
  const n = (value: number) => formatNumber(value, intlLocale);

  const { data, loading, failed, reload } = useAdminResource(
    (user) => adminApi.families(user),
    [],
    // A sync resolves the families again; an edit elsewhere is an audit entry.
    { live: (message) => onSyncBoundary(message) || onEvents("audit.recorded", "families.updated")(message) },
  );

  return (
    <div className="p-[24px_28px_40px]">
      <div className="mb-[18px] flex flex-wrap items-start gap-3">
        <p className="mb-0 max-w-3xl flex-1 text-sm text-muted">{t.families.intro}</p>
        <div className="ml-auto flex gap-2">
          <Button
            loading={busy}
            onClick={() =>
              void run((user) => adminApi.resolveFamilies(user), {
                success: (result) => t.families.resolved(result.resolved, result.failed),
                onDone: () => reload({ silent: true }),
              })
            }
          >
            {t.families.resolveAll}
          </Button>
          <Button variant="primary" onClick={() => navigate("/admin/families/new")}>
            {t.families.create}
          </Button>
        </div>
      </div>

      <Card className="gap-0 p-[4px_16px_10px]">
        <Table
          rows={data ?? []}
          rowKey={(row) => row.id}
          loading={loading}
          failed={failed}
          onRetry={() => void reload()}
          skeletonRows={5}
          emptyLabel={t.families.empty}
          onRowClick={(row) => navigate(`/admin/families/${row.id}`)}
          columns={[
            {
              header: t.families.thFamily,
              render: (row) => (
                <span className="flex items-center gap-3">
                  <span className="w-7 text-center text-xl">{row.icon ?? "◆"}</span>
                  <span className="font-medium">{row.name}</span>
                </span>
              ),
            },
            {
              header: t.families.thMembers,
              className: "text-sm",
              render: (row) => t.families.membersMeta(n(row.droppable), n(row.members)),
            },
            {
              header: t.families.thBonus,
              align: "right",
              className: "num text-sm",
              render: (row) => t.families.points(n(row.bonusPoints)),
            },
            {
              header: t.families.thCompletions,
              align: "right",
              className: "num text-sm",
              render: (row) => t.families.players(n(row.completions)),
            },
            {
              header: t.families.thStatus,
              render: (row) => (
                <span className="flex flex-wrap gap-2">
                  {row.enabled ? (
                    <Tag tone="sage">{t.families.visible}</Tag>
                  ) : (
                    <Tag tone="neutral">{t.families.hidden}</Tag>
                  )}
                  {row.resolveError ? (
                    <Tag tone="accent" title={row.resolveError}>
                      {t.families.resolveFailed}
                    </Tag>
                  ) : null}
                </span>
              ),
            },
          ]}
        />
      </Card>
    </div>
  );
}
