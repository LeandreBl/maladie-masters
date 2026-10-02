import type { PackWallet } from "../api/types";

const WEBSOCKET_URL: string = import.meta.env.VITE_WEBSOCKET_URL ?? "ws://localhost:3006/ws";

/**
 * The events a player's socket receives (mirror of
 * backend/src/realtime/realtime-events.ts, minus the admin feed).
 */
export type RealtimeEvent =
  | { type: "packs.granted"; data: { amount: number; note: string | null; wallet: PackWallet } }
  | { type: "packs.refilled"; data: { wallet: PackWallet } }
  | { type: "card.granted"; data: { cardId: string; quantity: number; shiny: boolean } }
  | { type: "card.removed"; data: { cardId: string } }
  | { type: "settings.updated"; data: Record<string, never> }
  /**
   * Events may have been missed: sent by the relay after a Redis outage, and
   * by this client after it reconnects.
   */
  | { type: "realtime.resync"; data: Record<string, never> };

export type RealtimeMessage = RealtimeEvent & { at: string };

/** `off`: no relay configured, the game works without live updates. */
export type RealtimeStatus = "off" | "connecting" | "live";

/** Waits between reconnection attempts; the last one repeats. */
const BACKOFF_MS = [1_000, 2_000, 5_000, 10_000, 30_000];

/**
 * One websocket to the relay, kept open for as long as `start` is in effect.
 *
 * Every (re)connection starts with a fresh ticket from the API, which is where
 * the account is checked: the relay itself trusts the ticket only. Whatever
 * closes the socket — the relay's session limit, a rights change, a network
 * drop — the answer is the same: wait, ask a new ticket, reconnect.
 */
export class RealtimeConnection {
  private socket: WebSocket | null = null;
  private retryTimer: number | null = null;
  private attempt = 0;
  private everConnected = false;
  private stopped = true;
  private readonly listeners = new Set<(message: RealtimeMessage) => void>();
  private readonly statusListeners = new Set<(status: RealtimeStatus) => void>();
  status: RealtimeStatus = WEBSOCKET_URL ? "connecting" : "off";

  constructor(private readonly ticket: () => Promise<string>) {}

  start(): void {
    if (!WEBSOCKET_URL || !this.stopped) return;
    this.stopped = false;
    void this.connect();
  }

  stop(): void {
    this.stopped = true;
    if (this.retryTimer !== null) window.clearTimeout(this.retryTimer);
    this.retryTimer = null;
    this.socket?.close(1000, "Client stopped");
    this.socket = null;
  }

  subscribe(listener: (message: RealtimeMessage) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  onStatus(listener: (status: RealtimeStatus) => void): () => void {
    this.statusListeners.add(listener);
    return () => this.statusListeners.delete(listener);
  }

  private setStatus(status: RealtimeStatus): void {
    if (this.status === status) return;
    this.status = status;
    for (const listener of this.statusListeners) listener(status);
  }

  private emit(message: RealtimeMessage): void {
    for (const listener of this.listeners) listener(message);
  }

  private async connect(): Promise<void> {
    this.setStatus("connecting");

    let ticket: string;
    try {
      ticket = await this.ticket();
    } catch {
      this.retry();
      return;
    }
    if (this.stopped) return;

    const url = new URL(WEBSOCKET_URL);
    url.searchParams.set("ticket", ticket);
    const socket = new WebSocket(url);
    this.socket = socket;

    socket.addEventListener("open", () => {
      this.attempt = 0;
      this.setStatus("live");
      // The first connection follows the initial load; a later one may have
      // missed events while it was down.
      if (this.everConnected) {
        this.emit({ type: "realtime.resync", data: {}, at: new Date().toISOString() });
      }
      this.everConnected = true;
    });

    socket.addEventListener("message", (event) => {
      try {
        const message = JSON.parse(String(event.data)) as RealtimeMessage;
        if (message && typeof message.type === "string") this.emit(message);
      } catch {
        // Not ours: the relay only forwards JSON.
      }
    });

    socket.addEventListener("close", () => {
      if (this.socket !== socket) return;
      this.socket = null;
      this.retry();
    });
  }

  private retry(): void {
    if (this.stopped) return;
    this.setStatus("connecting");
    const base = BACKOFF_MS[Math.min(this.attempt, BACKOFF_MS.length - 1)];
    this.attempt += 1;
    // Jitter, so a relay restart is not followed by every panel at once.
    const delay = base * (0.75 + Math.random() / 2);
    this.retryTimer = window.setTimeout(() => {
      this.retryTimer = null;
      void this.connect();
    }, delay);
  }
}
