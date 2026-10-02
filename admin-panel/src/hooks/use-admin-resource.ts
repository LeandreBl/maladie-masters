import { useCallback, useEffect, useRef, useState } from "react";
import type { User } from "firebase/auth";
import { useAuthedUser } from "../auth-context";
import { useT } from "../i18n";
import type { RealtimeMessage } from "../lib/realtime";
import { useRealtimeEvent } from "../realtime-context";
import { useToasts } from "../toast-context";

/**
 * A busy server sends a pack opening every few hundred milliseconds: live
 * reloads are spaced by at least this much, the last event always winning a
 * final one.
 */
const LIVE_RELOAD_MS = 2_000;

/** Which real-time events make a resource stale. */
export type LiveFilter = (message: RealtimeMessage) => boolean;

/**
 * Loads an admin resource: the loading flag, an error the view can render
 * (not only a toast), and a reload for after a mutation.
 *
 * `silent` reloads leave the previous data on screen, so acting on a row does
 * not blank the table underneath the operator.
 *
 * `live` reloads it, silently, when a matching real-time event arrives — and
 * after any reconnection, since events may have been missed meanwhile.
 */
export function useAdminResource<T>(
  load: (user: User) => Promise<T>,
  deps: unknown[] = [],
  { live }: { live?: LiveFilter } = {},
) {
  const user = useAuthedUser();
  const t = useT();
  const { showError } = useToasts();
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  const reload = useCallback(
    async ({ silent = false }: { silent?: boolean } = {}) => {
      if (!silent) setLoading(true);
      setFailed(false);
      try {
        setData(await load(user));
      } catch (error) {
        setFailed(true);
        showError(error, t.common.loadError);
      } finally {
        setLoading(false);
      }
    },
    // `load` is a fresh closure on every render at the call sites; the
    // dependencies they declare are what actually decides a refetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [user, showError, t, ...deps],
  );

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reload]);

  const reloadRef = useRef(reload);
  reloadRef.current = reload;
  const lastLiveReload = useRef(0);
  const liveTimer = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (liveTimer.current !== null) window.clearTimeout(liveTimer.current);
    },
    [],
  );

  useRealtimeEvent((message) => {
    if (!live) return;
    if (message.type !== "realtime.resync" && !live(message)) return;
    if (liveTimer.current !== null) return;
    const wait = Math.max(0, lastLiveReload.current + LIVE_RELOAD_MS - Date.now());
    liveTimer.current = window.setTimeout(() => {
      liveTimer.current = null;
      lastLiveReload.current = Date.now();
      void reloadRef.current({ silent: true });
    }, wait);
  });

  return { data, loading, failed, reload, setData };
}

/**
 * Runs one operator action: a busy flag, a success toast and an error toast,
 * so a view never repeats the same try/catch per button.
 */
export function useAdminAction() {
  const user = useAuthedUser();
  const t = useT();
  const { showError, showSuccess } = useToasts();
  const [busy, setBusy] = useState(false);

  const run = useCallback(
    async <T,>(
      action: (user: User) => Promise<T>,
      options: {
        success?: string | ((result: T) => string);
        failure?: string;
        onDone?: (result: T) => void | Promise<void>;
      } = {},
    ): Promise<T | undefined> => {
      setBusy(true);
      try {
        const result = await action(user);
        if (options.success) {
          showSuccess(
            typeof options.success === "function"
              ? options.success(result)
              : options.success,
          );
        }
        await options.onDone?.(result);
        return result;
      } catch (error) {
        showError(error, options.failure ?? t.common.saveError);
        return undefined;
      } finally {
        setBusy(false);
      }
    },
    [user, showError, showSuccess, t],
  );

  return { run, busy };
}
