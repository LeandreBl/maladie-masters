import { SyncRunStatus, type DiseaseSyncRun, type GameSettings } from "@prisma/client";

/** A failed scheduled run is retried after this delay, not a full interval. */
export const FAILED_RETRY_MS = 30 * 60_000;

/**
 * When the scheduler should start the next run, given the last one. Null when
 * the schedule is off. A date in the past means "now".
 */
export function nextScheduledRun(
  settings: Pick<GameSettings, "syncEnabled" | "syncIntervalHours">,
  lastRun: Pick<DiseaseSyncRun, "status" | "startedAt"> | null,
): Date | null {
  if (!settings.syncEnabled) return null;
  if (!lastRun) return new Date();

  const delay =
    lastRun.status === SyncRunStatus.FAILED
      ? Math.min(FAILED_RETRY_MS, settings.syncIntervalHours * 3_600_000)
      : settings.syncIntervalHours * 3_600_000;

  return new Date(lastRun.startedAt.getTime() + delay);
}
