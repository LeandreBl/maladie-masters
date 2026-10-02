import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { api } from "../api/client";
import { useAuth } from "../auth/AuthProvider";
import { RealtimeConnection, type RealtimeMessage } from "./connection";

const RealtimeContext = createContext<RealtimeConnection | null>(null);

/**
 * Opens the relay socket once the player's profile is loaded — the account
 * exists and is not suspended — and closes it on sign-out.
 */
export function RealtimeProvider({ children }: { children: ReactNode }) {
  const { user, me } = useAuth();
  const [connection, setConnection] = useState<RealtimeConnection | null>(null);
  const signedIn = Boolean(user && me);

  useEffect(() => {
    if (!user || !signedIn) return;
    const next = new RealtimeConnection(async () => (await api.realtimeTicket(user)).ticket);
    setConnection(next);
    next.start();
    return () => {
      next.stop();
      setConnection(null);
    };
  }, [user, signedIn]);

  return <RealtimeContext.Provider value={connection}>{children}</RealtimeContext.Provider>;
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
