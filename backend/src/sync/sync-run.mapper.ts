import type { DiseaseSyncRun, User } from "@prisma/client";
import type { SyncLogLineDto, SyncRunDetailDto, SyncRunDto } from "./dto/sync.dto";

export type RunWithTrigger = DiseaseSyncRun & {
  triggeredBy: Pick<User, "email"> | null;
};

export function toSyncRunDto(run: RunWithTrigger): SyncRunDto {
  return {
    id: run.id,
    status: run.status,
    trigger: run.trigger,
    triggeredBy: run.triggeredBy?.email ?? null,
    phase: run.phase,
    startedAt: run.startedAt.toISOString(),
    finishedAt: run.finishedAt?.toISOString() ?? null,
    durationSeconds: run.finishedAt
      ? Math.round((run.finishedAt.getTime() - run.startedAt.getTime()) / 1000)
      : null,
    fetched: run.fetched,
    created: run.created,
    updated: run.updated,
    missing: run.missing,
    restored: run.restored,
    error: run.error,
  };
}

export function toSyncRunDetailDto(run: RunWithTrigger): SyncRunDetailDto {
  return {
    ...toSyncRunDto(run),
    log: Array.isArray(run.log) ? (run.log as unknown as SyncLogLineDto[]) : [],
  };
}
