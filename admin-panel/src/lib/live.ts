import type { LiveFilter } from "../hooks/use-admin-resource";
import type { RealtimeEventType, RealtimeMessage } from "./realtime";

/** Matches any event of these types. */
export function onEvents(...types: RealtimeEventType[]): LiveFilter {
  return (message) => types.includes(message.type);
}

/** The player an event concerns, when it concerns one. */
export function eventUserId(message: RealtimeMessage): string | null {
  switch (message.type) {
    case "player.joined":
    case "pack.opened":
      return message.data.userId;
    case "audit.recorded":
      return message.data.targetUserId;
    default:
      return null;
  }
}

/** Matches the events about one player. */
export function onPlayer(userId: string): LiveFilter {
  return (message) => eventUserId(message) === userId;
}

/** A sync run ended: the catalog may have changed. */
export const onSyncBoundary: LiveFilter = (message) =>
  message.type === "sync.progress" && message.data.status !== "RUNNING";
