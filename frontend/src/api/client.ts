import type { User } from "firebase/auth";
import type {
  Locale,
  CardDetail,
  CollectionItem,
  CollectionSort,
  DiscordLinkCode,
  DiscordStatus,
  FamilyProgress,
  LeaderboardEntry,
  OwnedFilter,
  Me,
  Page,
  PackOpening,
  PackWallet,
  Rarity,
} from "./types";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL ?? "http://localhost:3005";

/** The backend's error envelope: branch on `code`, show `message`. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string | undefined,
    message: string,
  ) {
    super(message);
  }
}

async function request<T>(user: User, path: string, init?: RequestInit): Promise<T> {
  const send = async (force: boolean) =>
    fetch(`${BACKEND_URL}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${await user.getIdToken(force)}`,
        ...init?.headers,
      },
    });

  let response = await send(false);
  if (response.status === 401) response = await send(true);

  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { code?: string; message?: string };
    throw new ApiError(response.status, body.code, body.message ?? response.statusText);
  }
  return response.json() as Promise<T>;
}

function query(params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") search.set(key, String(value));
  }
  const text = search.toString();
  return text ? `?${text}` : "";
}

export const api = {
  me: (user: User) => request<Me>(user, "/v1/me"),
  updateMe: (user: User, payload: { displayName?: string; locale?: Locale; sfw?: boolean }) =>
    request<Me>(user, "/v1/me", { method: "PATCH", body: JSON.stringify(payload) }),
  wallet: (user: User) => request<PackWallet>(user, "/v1/me/packs"),
  realtimeTicket: (user: User) =>
    request<{ ticket: string; expiresAt: string }>(user, "/v1/realtime/ticket", { method: "POST" }),
  openPack: (user: User) => request<PackOpening>(user, "/v1/me/packs/open", { method: "POST" }),
  history: (user: User, page = 1) =>
    request<Page<PackOpening>>(user, `/v1/me/packs/history${query({ page, pageSize: 10 })}`),
  collection: (
    user: User,
    params: {
      page?: number;
      pageSize?: number;
      search?: string;
      rarity?: Rarity;
      owned?: OwnedFilter;
      sort?: CollectionSort;
      family?: string;
    },
  ) => request<Page<CollectionItem>>(user, `/v1/me/collection${query(params)}`),
  families: (user: User) => request<FamilyProgress[]>(user, "/v1/me/families"),
  card: (user: User, id: string) => request<CardDetail>(user, `/v1/cards/${id}`),
  discord: (user: User) => request<DiscordStatus>(user, "/v1/me/discord"),
  discordLinkCode: (user: User) =>
    request<DiscordLinkCode>(user, "/v1/me/discord/link-code", { method: "POST" }),
  updateDiscord: (user: User, payload: { announce: boolean }) =>
    request<DiscordStatus>(user, "/v1/me/discord", { method: "PATCH", body: JSON.stringify(payload) }),
  unlinkDiscord: (user: User) => request<DiscordStatus>(user, "/v1/me/discord", { method: "DELETE" }),
  leaderboard: (user: User) => request<LeaderboardEntry[]>(user, "/v1/leaderboard?limit=50"),
};
