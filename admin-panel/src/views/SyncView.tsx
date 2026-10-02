import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "../components/ui/Button";
import { Card, Panel } from "../components/ui/Card";
import { Pagination } from "../components/ui/Pagination";
import { Table } from "../components/ui/Table";
import { Tag, type Tone } from "../components/ui/Tag";
import { Dialog } from "../components/ui/Dialog";
import { useAdminAction, useAdminResource } from "../hooks/use-admin-resource";
import { useLocale, useT } from "../i18n";
import { adminApi, type SyncRun, type SyncRunDetail } from "../lib/api";
import { onEvents } from "../lib/live";
import { useRealtimeStatus } from "../realtime-context";
import { formatDateTime, formatNumber, formatRelative, formatTime } from "../lib/format";

/**
 * How often the screen re-reads the status while a run is going, when the
 * real-time feed is down. Live, each `sync.progress` event does it instead.
 */
const POLL_MS = 3000;

const STATUS_TONE: Record<SyncRun["status"], Tone> = {
  RUNNING: "accent",
  SUCCEEDED: "sage",
  FAILED: "neutral",
};

/**
 * The Wikipedia import: what it does, the run in progress with its live log,
 * a button to start one, and the history.
 */
export function SyncView() {
  const t = useT();
  const { intlLocale } = useLocale();
  const { run, busy } = useAdminAction();
  const [page, setPage] = useState(1);
  const [openRun, setOpenRun] = useState<string | null>(null);

  const realtime = useRealtimeStatus();
  // A run started elsewhere (the scheduler, the CLI, another operator) shows
  // up as soon as it reports.
  const status = useAdminResource((user) => adminApi.syncStatus(user), [], {
    live: onEvents("sync.progress", "settings.updated"),
  });
  const runs = useAdminResource((user) => adminApi.syncRuns(user, page), [page]);

  const running = status.data?.running ?? null;

  // The history changes when a run starts or ends (not on mount: it was just
  // loaded).
  const seenRun = useRef(running?.id);
  useEffect(() => {
    if (seenRun.current === running?.id) return;
    seenRun.current = running?.id;
    void runs.reload({ silent: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running?.id]);

  // Without the real-time feed, follow a run by polling.
  useEffect(() => {
    if (!running || realtime === "live") return;
    const timer = window.setInterval(() => {
      void status.reload({ silent: true });
    }, POLL_MS);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running?.id, realtime]);

  return (
    <div className="p-[24px_28px_40px]">
      <div className="panel-grid mb-5">
        <Panel
          title={t.sync.statusTitle}
          eyebrow={status.data ? t.sync.statusEyebrow(status.data.wikipediaHosts.join(" · ")) : undefined}
          action={
            <Button
              variant="primary"
              loading={busy}
              disabled={!!running}
              onClick={() =>
                void run((user) => adminApi.startSync(user), {
                  success: t.sync.started,
                  onDone: () => {
                    void status.reload({ silent: true });
                    void runs.reload({ silent: true });
                  },
                })
              }
            >
              {t.sync.startNow}
            </Button>
          }
        >
          <p className="mb-4 text-sm text-muted">{t.sync.explain}</p>
          {status.data ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="tile-inset">
                <div className="eyebrow text-muted">{t.sync.lastRun}</div>
                {status.data.lastRun ? (
                  <>
                    <div className="mt-[3px] flex items-center gap-2">
                      <Tag tone={STATUS_TONE[status.data.lastRun.status]}>
                        {t.sync.status[status.data.lastRun.status]}
                      </Tag>
                      <span className="text-sm">
                        {formatRelative(status.data.lastRun.startedAt, intlLocale)}
                      </span>
                    </div>
                    {status.data.lastRun.error ? (
                      <div className="mt-1 text-xs text-muted">{status.data.lastRun.error}</div>
                    ) : null}
                  </>
                ) : (
                  <div className="mt-[3px] text-sm text-muted">{t.sync.noRuns}</div>
                )}
              </div>
              <div className="tile-inset">
                <div className="eyebrow text-muted">{t.sync.nextRun}</div>
                <div className="mt-[3px] text-sm">
                  {status.data.enabled
                    ? `${status.data.nextScheduledAt ? formatRelative(status.data.nextScheduledAt, intlLocale) : "—"} · ${t.sync.every(status.data.intervalHours)}`
                    : t.sync.scheduleOff}
                </div>
                <Link to="/admin/settings" className="text-xs text-accent-700 hover:text-accent">
                  {t.sync.editSchedule} →
                </Link>
              </div>
            </div>
          ) : null}
        </Panel>

        {running ? <RunningPanel run={running} /> : null}
      </div>

      <Panel title={t.sync.historyTitle}>
        <Table
          rows={runs.data?.items ?? []}
          rowKey={(row) => row.id}
          loading={runs.loading}
          failed={runs.failed}
          onRetry={() => void runs.reload()}
          emptyLabel={t.sync.noRuns}
          onRowClick={(row) => setOpenRun(row.id)}
          columns={[
            {
              header: t.sync.thStarted,
              render: (row) => formatDateTime(row.startedAt, intlLocale),
            },
            {
              header: t.sync.thTrigger,
              render: (row) => (
                <span>
                  {t.sync.trigger[row.trigger]}
                  {row.triggeredBy ? <span className="text-xs text-muted"> {t.sync.by(row.triggeredBy)}</span> : null}
                </span>
              ),
            },
            {
              header: t.sync.thStatus,
              render: (row) => <Tag tone={STATUS_TONE[row.status]}>{t.sync.status[row.status]}</Tag>,
            },
            {
              header: t.sync.thDuration,
              align: "right",
              render: (row) => (row.durationSeconds !== null ? t.sync.duration(row.durationSeconds) : "—"),
            },
            { header: t.sync.thFetched, align: "right", className: "num text-sm", render: (row) => formatNumber(row.fetched, intlLocale) },
            { header: t.sync.thCreated, align: "right", className: "num text-sm", render: (row) => formatNumber(row.created, intlLocale) },
            { header: t.sync.thUpdated, align: "right", className: "num text-sm", render: (row) => formatNumber(row.updated, intlLocale) },
            { header: t.sync.thMissing, align: "right", className: "num text-sm", render: (row) => formatNumber(row.missing, intlLocale) },
          ]}
          footer={
            runs.data && runs.data.total > runs.data.pageSize ? (
              <Pagination
                page={runs.data.page}
                totalPages={Math.ceil(runs.data.total / runs.data.pageSize)}
                total={runs.data.total}
                onPage={setPage}
              />
            ) : null
          }
        />
      </Panel>

      {openRun ? <RunDialog runId={openRun} onClose={() => setOpenRun(null)} /> : null}
    </div>
  );
}

function RunningPanel({ run }: { run: SyncRunDetail }) {
  const t = useT();
  const { intlLocale } = useLocale();

  return (
    <Panel title={run.phase ?? t.sync.status.RUNNING} eyebrow={t.sync.running}>
      <div className="mb-3 text-xs text-muted">
        {t.sync.counters(
          formatNumber(run.fetched, intlLocale),
          formatNumber(run.created, intlLocale),
          formatNumber(run.updated, intlLocale),
          formatNumber(run.missing, intlLocale),
          formatNumber(run.restored, intlLocale),
        )}
      </div>
      <LogBox lines={run.log} />
    </Panel>
  );
}

function LogBox({ lines }: { lines: SyncRunDetail["log"] }) {
  const { intlLocale } = useLocale();
  return (
    <div className="log-box">
      {lines.map((line, index) => (
        <div key={index}>
          <span className="text-muted">{formatTime(line.at, intlLocale)}</span> {line.message}
        </div>
      ))}
    </div>
  );
}

function RunDialog({ runId, onClose }: { runId: string; onClose: () => void }) {
  const t = useT();
  const { intlLocale } = useLocale();
  const { data } = useAdminResource((user) => adminApi.syncRun(user, runId), [runId]);

  return (
    <Dialog
      wide
      title={data ? `${t.sync.trigger[data.trigger]} · ${formatDateTime(data.startedAt, intlLocale)}` : t.common.loading}
      onClose={onClose}
      actions={<Button onClick={onClose}>{t.common.close}</Button>}
    >
      {data ? (
        <div className="grid gap-3">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <Tag tone={STATUS_TONE[data.status]}>{t.sync.status[data.status]}</Tag>
            {data.durationSeconds !== null ? <span>{t.sync.duration(data.durationSeconds)}</span> : null}
          </div>
          <div className="text-xs text-muted">
            {t.sync.counters(
              formatNumber(data.fetched, intlLocale),
              formatNumber(data.created, intlLocale),
              formatNumber(data.updated, intlLocale),
              formatNumber(data.missing, intlLocale),
              formatNumber(data.restored, intlLocale),
            )}
          </div>
          {data.error ? (
            <Card className="p-3 text-sm" style={{ background: "var(--color-accent-200)", color: "var(--color-accent-900)" }}>
              {data.error}
            </Card>
          ) : null}
          <div className="eyebrow text-muted">{t.sync.logTitle}</div>
          <LogBox lines={data.log} />
        </div>
      ) : null}
    </Dialog>
  );
}
