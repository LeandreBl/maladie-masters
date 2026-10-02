import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useAdminSession } from "./auth-context";
import { adminApi } from "./lib/api";
import {
  RealtimeConnection,
  type RealtimeMessage,
  type RealtimeStatus,
} from "./lib/realtime";

const RealtimeContext = createContext<RealtimeConnection | null>(null);

/**
 * Opens the relay socket once the admin session is established, and closes it
 * on sign-out. Views listen through `useRealtimeEvent`, or declare `live` on
 * `useAdminResource`.
 */
export function RealtimeProvider({ children }: { children: ReactNode }) {
  const { firebaseUser, status } = useAdminSession();
  const [connection, setConnection] = useState<RealtimeConnection | null>(null);

  useEffect(() => {
    if (status !== "ready" || !firebaseUser) return;
    const next = new RealtimeConnection(async () => {
      const { ticket } = await adminApi.realtimeTicket(firebaseUser);
      return ticket;
    });
    setConnection(next);
    next.start();
    return () => {
      next.stop();
      setConnection(null);
    };
  }, [firebaseUser, status]);

  return <RealtimeContext.Provider value={connection}>{children}</RealtimeContext.Provider>;
}

export function useRealtimeStatus(): RealtimeStatus {
  const connection = useContext(RealtimeContext);
  const [status, setStatus] = useState<RealtimeStatus>(connection?.status ?? "connecting");

  useEffect(() => {
    if (!connection) return;
    setStatus(connection.status);
    return connection.onStatus(setStatus);
  }, [connection]);

  return status;
}

/**
 * Calls `handler` for every event. The latest handler is always the one
 * called, so call sites can pass an inline closure without resubscribing.
 */
export function useRealtimeEvent(handler: (message: RealtimeMessage) => void): void {
  const connection = useContext(RealtimeContext);
  const latest = useRef(handler);
  latest.current = handler;

  useEffect(() => {
    if (!connection) return;
    return connection.subscribe((message) => latest.current(message));
  }, [connection]);
}
