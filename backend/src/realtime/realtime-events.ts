import type { SyncRunStatus } from "@prisma/client";
import type { RarityName } from "../cards/rarity";
import type { PackWalletDto } from "../packs/dto/pack.dto";

/**
 * The Redis contract shared with `websocket-relay/`: the relay subscribes to
 * these channels and forwards each message, unchanged, to the sockets allowed
 * on it. Changing a name here means changing it there too.
 */
export const RealtimeChannel = {
  everyone: "realtime:everyone",
  admins: "realtime:admins",
  user: (userId: string) => `realtime:user:${userId}`,
  /** Orders for the relay itself, never forwarded to a socket. */
  control: "realtime:control",
} as const;

/** `realtime:ticket:<ticket>` holds who a pending connection belongs to. */
export const TICKET_KEY_PREFIX = "realtime:ticket:";

/** What a ticket stands for, read once by the relay when the socket opens. */
export interface RealtimeTicket {
  userId: string;
  admin: boolean;
}

/**
 * Every event the fronts can receive.
 *
 * They are hints, not a data feed: a missed one costs nothing, because the
 * fronts refetch on reconnect. So an event carries what a notification needs
 * to be shown, and lets the receiver reload the rest from the API.
 */
export type RealtimeEvent =
  // --- Admins ---------------------------------------------------------------
  | { type: "player.joined"; data: { userId: string } }
  | {
      type: "pack.opened";
      data: { userId: string; best: RarityName; shiny: number };
    }
  | {
      type: "audit.recorded";
      data: { action: string; targetUserId: string | null };
    }
  | {
      type: "sync.progress";
      data: {
        runId: string;
        status: SyncRunStatus;
        phase: string | null;
        fetched: number | null;
        created: number | null;
        updated: number | null;
        missing: number | null;
        restored: number | null;
      };
    }
  // --- One player -----------------------------------------------------------
  | {
      type: "packs.granted";
      data: { amount: number; note: string | null; wallet: PackWalletDto };
    }
  | { type: "packs.refilled"; data: { wallet: PackWalletDto } }
  | {
      type: "card.granted";
      data: { cardId: string; quantity: number; shiny: boolean };
    }
  | { type: "card.removed"; data: { cardId: string } }
  // --- Everyone -------------------------------------------------------------
  | { type: "settings.updated"; data: Record<string, never> };

export type RealtimeEventType = RealtimeEvent["type"];

/**
 * The JSON a socket receives. The relay adds one event of its own,
 * `realtime.resync`, when its Redis subscription comes back after an outage:
 * the fronts then reload as they do after reconnecting.
 */
export type RealtimeMessage = RealtimeEvent & { at: string };

/** Orders the backend gives the relay on `realtime:control`. */
export type RealtimeControl =
  /**
   * Closes every socket of a player whose rights changed (suspended, admin
   * granted or revoked). The front reconnects with a fresh ticket, which
   * carries the new rights — or is refused.
   */
  { type: "disconnect"; userId: string };
