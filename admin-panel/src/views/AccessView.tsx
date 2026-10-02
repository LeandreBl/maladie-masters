import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "../components/ui/Button";
import { Panel } from "../components/ui/Card";
import { ConfirmDialog } from "../components/ui/Dialog";
import { Pagination } from "../components/ui/Pagination";
import { Table } from "../components/ui/Table";
import { Tag } from "../components/ui/Tag";
import { useAdminAction, useAdminResource } from "../hooks/use-admin-resource";
import { onEvents } from "../lib/live";
import { useAuditLabel, useLocale, useT } from "../i18n";
import { adminApi } from "../lib/api";
import { formatDate, formatDateTime } from "../lib/format";
import { describeMetadata } from "./UserDetailView";

/** Who administers the game, and everything they did. */
export function AccessView() {
  const t = useT();
  const { intlLocale } = useLocale();
  const label = useAuditLabel();
  const { run, busy } = useAdminAction();
  const [email, setEmail] = useState("");
  const [removing, setRemoving] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  // Another operator's changes show up without a reload.
  const admins = useAdminResource((user) => adminApi.admins(user), [], {
    live: (message) =>
      message.type === "audit.recorded" && message.data.action.startsWith("admin."),
  });
  const audit = useAdminResource((user) => adminApi.audit(user, page), [page], {
    live: onEvents("audit.recorded"),
  });

  return (
    <div className="p-[24px_28px_40px]">
      <Panel title={t.access.adminsTitle} className="mb-5">
        <p className="mb-4 text-xs text-muted">{t.access.adminsHelp}</p>
        <form
          className="mb-4 flex flex-wrap gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            const value = email.trim();
            if (!value) return;
            void run((user) => adminApi.addAdmin(user, value), {
              success: t.access.added(value),
              onDone: () => {
                setEmail("");
                void admins.reload({ silent: true });
                void audit.reload({ silent: true });
              },
            });
          }}
        >
          <input
            className="input min-w-[240px] flex-1"
            type="email"
            required
            placeholder={t.access.emailPlaceholder}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
          <Button type="submit" variant="primary" loading={busy}>
            {t.access.add}
          </Button>
        </form>
        <Table
          rows={admins.data ?? []}
          rowKey={(row) => row.email}
          loading={admins.loading}
          failed={admins.failed}
          onRetry={() => void admins.reload()}
          columns={[
            { header: "Email", render: (row) => <span className="font-medium">{row.email}</span> },
            {
              header: "",
              render: (row) =>
                row.hasSignedIn ? <Tag tone="sage">{t.access.signedIn}</Tag> : <Tag tone="outline">{t.access.notYet}</Tag>,
            },
            { header: "", render: (row) => <span className="text-muted">{formatDate(row.createdAt, intlLocale)}</span> },
            {
              header: "",
              align: "right",
              render: (row) => (
                <Button className="btn-sm" onClick={() => setRemoving(row.email)}>
                  {t.access.remove}
                </Button>
              ),
            },
          ]}
        />
      </Panel>

      <Panel title={t.access.auditTitle}>
        <Table
          rows={audit.data?.items ?? []}
          rowKey={(row) => row.id}
          loading={audit.loading}
          failed={audit.failed}
          onRetry={() => void audit.reload()}
          columns={[
            { header: t.access.thWhen, render: (row) => <span className="text-muted">{formatDateTime(row.createdAt, intlLocale)}</span> },
            { header: t.access.thActor, render: (row) => row.actor?.email ?? "—" },
            { header: t.access.thAction, render: (row) => <span className="font-medium">{label(row.action)}</span> },
            {
              header: t.access.thTarget,
              render: (row) =>
                row.targetUser ? (
                  <Link className="text-accent-700 hover:text-accent" to={`/admin/users/${row.targetUser.id}`}>
                    {row.targetUser.displayName ?? row.targetUser.email}
                  </Link>
                ) : (
                  "—"
                ),
            },
            {
              header: t.access.thDetails,
              render: (row) => <span className="text-xs text-muted">{describeMetadata(row.metadata)}</span>,
            },
          ]}
          footer={
            audit.data && audit.data.total > audit.data.pageSize ? (
              <Pagination
                page={audit.data.page}
                totalPages={Math.ceil(audit.data.total / audit.data.pageSize)}
                total={audit.data.total}
                onPage={setPage}
              />
            ) : null
          }
        />
      </Panel>

      {removing ? (
        <ConfirmDialog
          danger
          title={t.access.removeTitle}
          message={t.access.removeBody(removing)}
          confirmLabel={t.access.remove}
          busy={busy}
          onCancel={() => setRemoving(null)}
          onConfirm={() =>
            void run((user) => adminApi.removeAdmin(user, removing), {
              success: t.access.removed(removing),
              onDone: () => {
                setRemoving(null);
                void admins.reload({ silent: true });
                void audit.reload({ silent: true });
              },
            })
          }
        />
      ) : null}
    </div>
  );
}
