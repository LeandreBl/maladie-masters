import type { User } from "firebase/auth";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3005";

/**
 * The panel's language, sent as `?lang=` on every call: card names and
 * articles come back in it (English when a disease has no article in it),
 * whatever the admin's account language is.
 */
let apiLocale = "en";

export function setApiLocale(locale: string): void {
  apiLocale = locale;
}

export type Locale = "fr" | "en" | "zh";

// --- Types (mirror of the backend's DTOs, see /api on the backend) ----------

export type Rarity = "COMMON" | "UNCOMMON" | "RARE" | "EPIC" | "LEGENDARY";
export const RARITIES_DESC: Rarity[] = [
  "LEGENDARY",
  "EPIC",
  "RARE",
  "UNCOMMON",
  "COMMON",
];

export type UserRole = "USER" | "ADMIN";

export type Page<T> = {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
};

export type PackWallet = {
  available: number;
  natural: number;
  bonus: number;
  maxStored: number;
  intervalMinutes: number;
  nextPackAt: string | null;
  fullAt: string | null;
  serverTime: string;
};

export type CollectionSummary = {
  uniqueOwned: number;
  totalCopies: number;
  catalogSize: number;
  completionPct: number;
  score: number;
  byRarity: Array<{ rarity: Rarity; owned: number; total: number }>;
};

export type Me = {
  id: string;
  email: string;
  displayName: string | null;
  photoUrl: string | null;
  role: UserRole;
  locale: Locale;
  createdAt: string;
  packs: PackWallet;
  collection: CollectionSummary;
};

export type Card = {
  id: string;
  number: number;
  name: string;
  description: string | null;
  imageUrl: string | null;
  rarity: Rarity;
  pageviews: number;
  popularityRank: number | null;
  wikipediaUrl: string;
  /** The language the name and article are in: differs from the one asked
   * for when the disease has no article in it. */
  lang: Locale;
};

export type CollectionItem = {
  card: Card;
  quantity: number;
  shinyQuantity: number;
  firstObtainedAt: string | null;
  lastObtainedAt: string | null;
};

export type PackOpening = {
  id: string;
  source: "NATURAL" | "BONUS";
  openedAt: string;
  cards: Array<{ slot: number; rarity: Rarity; isNew: boolean; isShiny: boolean; card: Card }>;
};

export type AuditEntry = {
  id: string;
  action: string;
  actor: { id: string; email: string } | null;
  targetUser: { id: string; email: string; displayName: string | null } | null;
  metadata: Record<string, unknown>;
  createdAt: string;
};

export type UserFilter = "all" | "admins" | "suspended" | "active7d";
export type UserSort = "lastSeen" | "createdAt" | "cards" | "packs";

export type AdminUserRow = {
  id: string;
  email: string;
  displayName: string | null;
  photoUrl: string | null;
  role: UserRole;
  locale: Locale;
  suspendedAt: string | null;
  lastSeenAt: string | null;
  createdAt: string;
  uniqueCards: number;
  packsOpened: number;
  packsAvailable: number;
};

export type AdminUsersPage = Page<AdminUserRow> & {
  counts: Record<UserFilter, number>;
};

export type AdminUserDetail = AdminUserRow & {
  suspendedReason: string | null;
  wallet: PackWallet;
  collection: CollectionSummary;
  stats: { packsOpened: number; packsOpened7d: number; lastOpenedAt: string | null };
  recentOpenings: PackOpening[];
  audit: AuditEntry[];
};

export type CardStatus = "all" | "enabled" | "disabled" | "missing" | "overridden";
export type CardSort = "popularity" | "number" | "name" | "owners" | "recent";

export type AdminCard = Card & {
  wikidataId: string;
  languages: Locale[];
  popularityRarity: Rarity;
  rarityOverride: Rarity | null;
  enabled: boolean;
  missingSince: string | null;
  owners: number;
  createdAt: string;
};

export type AdminCardsPage = Page<AdminCard> & {
  counts: Record<CardStatus, number>;
};

export type CardLocalization = {
  locale: Locale;
  name: string;
  pageTitle: string;
  wikipediaUrl: string;
  description: string | null;
  extract: string | null;
  pageviews: number;
};

/** A family a card belongs to; `enabled: false` is hidden from players. */
export type CardFamilyBrief = {
  id: string;
  name: string;
  icon: string | null;
  bonusPoints: number;
  enabled: boolean;
};

export type AdminCardDetail = AdminCard & {
  extract: string | null;
  localizations: CardLocalization[];
  icd10: string[];
  copies: number;
  drops: number;
  drops7d: number;
  lastSyncedAt: string;
  families: CardFamilyBrief[];
};

// --- Families ---------------------------------------------------------------

export type FamilyRuleField =
  | "name"
  | "title"
  | "description"
  | "extract"
  | "icd10"
  | "wikidataId"
  | "wikidataClass";

export const FAMILY_RULE_FIELDS: FamilyRuleField[] = [
  "name",
  "title",
  "description",
  "extract",
  "icd10",
  "wikidataClass",
  "wikidataId",
];

/** The fields that exist once per language. Mirrors the backend's `LOCALIZED_FIELDS`. */
export const LOCALIZED_RULE_FIELDS: FamilyRuleField[] = ["name", "title", "description", "extract"];

export type FamilyRule = {
  field: FamilyRuleField;
  /** A case-insensitive regex, or QIDs for `wikidataClass`. */
  pattern: string;
  locale?: Locale | null;
  exclude?: boolean;
};

export type FamilyMatch = "any" | "all";

export type FamilyDefinition = {
  match: FamilyMatch;
  rules: FamilyRule[];
  includedCardIds: string[];
  excludedCardIds: string[];
};

export type FamilyPayload = FamilyDefinition & {
  names: { en: string; fr?: string; zh?: string };
  icon: string | null;
  bonusPoints: number;
  enabled: boolean;
  position?: number;
};

export type AdminFamily = FamilyPayload & {
  id: string;
  name: string;
  position: number;
  members: number;
  droppable: number;
  completions: number;
  resolvedAt: string | null;
  resolveError: string | null;
  updatedAt: string;
};

export type FamilyPreviewView = "members" | "excluded";

export type FamilyCardReason = "rules" | "manual" | "excludedByRule" | "excludedByHand";

export type FamilyPreviewCard = Card & {
  wikidataId: string;
  droppable: boolean;
  /** Indexes of the rules the card matches. */
  hits: number[];
  reason: FamilyCardReason;
};

export type FamilyPreview = {
  counts: { members: number; droppable: number; excluded: number };
  rules: Array<{ matches: number; error: string | null; labels: string[] }>;
  items: FamilyPreviewCard[];
  total: number;
  page: number;
  pageSize: number;
};

export type SyncRun = {
  id: string;
  status: "RUNNING" | "SUCCEEDED" | "FAILED";
  trigger: "SCHEDULE" | "MANUAL";
  triggeredBy: string | null;
  phase: string | null;
  startedAt: string;
  finishedAt: string | null;
  durationSeconds: number | null;
  fetched: number;
  created: number;
  updated: number;
  missing: number;
  restored: number;
  error: string | null;
};

export type SyncRunDetail = SyncRun & {
  log: Array<{ at: string; message: string }>;
};

export type SyncStatus = {
  running: SyncRunDetail | null;
  lastRun: SyncRun | null;
  enabled: boolean;
  intervalHours: number;
  nextScheduledAt: string | null;
  wikipediaHosts: string[];
};

export type RarityWeights = Record<Rarity, number>;

/** One kind of slot in the booster: `count` slots drawing from `weights`. */
export type PackSlot = { count: number; weights: RarityWeights };

export type GameSettings = {
  packIntervalMinutes: number;
  packMaxStored: number;
  packSlots: PackSlot[];
  /** Read-only: the total of the slots' `count`. */
  cardsPerPack: number;
  /** A drawn card comes out shiny one time in N, any rarity. */
  shinyOneIn: number;
  shareLegendary: number;
  shareEpic: number;
  shareRare: number;
  shareUncommon: number;
  syncEnabled: boolean;
  syncIntervalHours: number;
  pageviewsWindowDays: number;
  /** Share of each rarity among drawn cards, in percent. */
  expectedDropPct: RarityWeights;
  /** Chance a pack holds at least one of each rarity, in percent. */
  packHitPct: RarityWeights;
  updatedAt: string;
};

export type GameSettingsPayload = Partial<
  Omit<GameSettings, "expectedDropPct" | "packHitPct" | "cardsPerPack" | "updatedAt">
>;

export type StatsOverview = {
  generatedAt: string;
  users: {
    total: number;
    active24h: number;
    active7d: number;
    new7d: number;
    suspended: number;
    admins: number;
    byLocale: Array<{ locale: Locale; count: number }>;
  };
  packs: {
    opened24h: number;
    opened7d: number;
    openedTotal: number;
    bonusOutstanding: number;
    shiniesTotal: number;
    shinies7d: number;
  };
  cards: {
    total: number;
    droppable: number;
    disabled: number;
    missing: number;
    byLocale: Array<{ locale: Locale; count: number }>;
    byRarity: Array<{ rarity: Rarity; total: number; droppable: number }>;
  };
  collection: {
    copies: number;
    collectors: number;
    avgUniquePerCollector: number;
  };
  sync: {
    running: boolean;
    lastRun: SyncRun | null;
    lastSuccess: SyncRun | null;
    nextScheduledAt: string | null;
  };
};

export type StatsSeries = {
  days: number;
  points: Array<{
    date: string;
    signups: number;
    packsOpened: number;
    activePlayers: number;
  }>;
};

export type DropStats = {
  days: number;
  total: number;
  byRarity: Array<{
    rarity: Rarity;
    count: number;
    pct: number;
    expectedPct: number;
  }>;
};

export type TopCard = { card: Card; owners: number; copies: number };

export type LeaderboardEntry = {
  rank: number;
  userId: string;
  displayName: string | null;
  photoUrl: string | null;
  uniqueOwned: number;
  score: number;
};

export type AdminGrant = {
  email: string;
  createdAt: string;
  hasSignedIn: boolean;
  /** Set by the backend's ADMINS variable: the panel cannot revoke it. */
  bootstrap: boolean;
};

// --- Errors ----------------------------------------------------------------

/**
 * An API error. `code` carries the backend's `ErrorCode`, `serverMessage` the
 * English message the backend wrote — a fallback for codes the panel has no
 * wording for.
 */
export class ApiError extends Error {
  readonly statusCode: number;
  readonly code?: string;
  readonly serverMessage?: string;

  constructor(params: { statusCode: number; code?: string; serverMessage?: string }) {
    super(params.serverMessage ?? params.code ?? "API error");
    this.name = "ApiError";
    this.statusCode = params.statusCode;
    this.code = params.code;
    this.serverMessage = params.serverMessage;
  }

  static async fromResponse(response: Response): Promise<ApiError> {
    const rawBody = await response.text().catch(() => "");
    try {
      const body = JSON.parse(rawBody) as { code?: string; message?: unknown };
      return new ApiError({
        statusCode: response.status,
        code: body.code && body.code !== "UNKNOWN_ERROR" ? body.code : undefined,
        serverMessage: typeof body.message === "string" ? body.message : undefined,
      });
    } catch {
      return new ApiError({
        statusCode: response.status,
        serverMessage: `${response.status} ${response.statusText}`,
      });
    }
  }

  get isForbidden(): boolean {
    return this.statusCode === 403;
  }

  get isSuspended(): boolean {
    return this.code === "ACCOUNT_SUSPENDED";
  }
}

// --- Transport -------------------------------------------------------------

async function authedFetch(
  user: User,
  path: string,
  init?: RequestInit,
  forceTokenRefresh = false,
) {
  const token = await user.getIdToken(forceTokenRefresh);
  const url = new URL(`${API_URL}${path}`);
  url.searchParams.set("lang", apiLocale);
  return fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...init?.headers,
    },
  });
}

export async function apiRequest<T>(
  user: User,
  path: string,
  init?: RequestInit,
): Promise<T> {
  let response = await authedFetch(user, path, init);

  // An expired token is the only error worth a second attempt.
  if (response.status === 401) {
    response = await authedFetch(user, path, init, true);
  }
  if (!response.ok) {
    throw await ApiError.fromResponse(response);
  }
  if (response.status === 204) {
    return undefined as T;
  }
  return response.json() as Promise<T>;
}

function query(params: Record<string, string | number | boolean | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && `${value}`.length > 0) {
      search.set(key, String(value));
    }
  }
  const serialized = search.toString();
  return serialized ? `?${serialized}` : "";
}

function jsonBody(method: string, payload?: unknown): RequestInit {
  return {
    method,
    ...(payload === undefined ? {} : { body: JSON.stringify(payload) }),
  };
}

// --- Endpoints -------------------------------------------------------------

export const adminApi = {
  me: (user: User) => apiRequest<Me>(user, "/v1/me"),
  realtimeTicket: (user: User) =>
    apiRequest<{ ticket: string; expiresAt: string }>(user, "/v1/realtime/ticket", jsonBody("POST")),

  // — dashboard —
  overview: (user: User) => apiRequest<StatsOverview>(user, "/v1/admin/stats/overview"),
  series: (user: User, days: number) =>
    apiRequest<StatsSeries>(user, `/v1/admin/stats/series${query({ days })}`),
  drops: (user: User, days: number) =>
    apiRequest<DropStats>(user, `/v1/admin/stats/drops${query({ days })}`),
  topCards: (user: User, limit = 8) =>
    apiRequest<TopCard[]>(user, `/v1/admin/stats/top-cards${query({ limit })}`),
  topCollectors: (user: User, limit = 8) =>
    apiRequest<LeaderboardEntry[]>(
      user,
      `/v1/admin/stats/top-collectors${query({ limit })}`,
    ),

  // — players —
  users: (
    user: User,
    params: { page?: number; pageSize?: number; search?: string; filter?: UserFilter; sort?: UserSort },
  ) => apiRequest<AdminUsersPage>(user, `/v1/admin/users${query(params)}`),
  userDetail: (user: User, id: string) =>
    apiRequest<AdminUserDetail>(user, `/v1/admin/users/${id}`),
  userCards: (
    user: User,
    id: string,
    params: { page?: number; pageSize?: number; search?: string; rarity?: Rarity; owned?: "all" | "owned" | "missing"; sort?: string },
  ) => apiRequest<Page<CollectionItem>>(user, `/v1/admin/users/${id}/cards${query(params)}`),
  grantPacks: (user: User, id: string, amount: number, note?: string) =>
    apiRequest<PackWallet>(user, `/v1/admin/users/${id}/packs`, jsonBody("POST", { amount, note })),
  refillPacks: (user: User, id: string) =>
    apiRequest<PackWallet>(user, `/v1/admin/users/${id}/packs/refill`, jsonBody("POST")),
  unlockCard: (user: User, id: string, cardId: string, quantity = 1, shiny = false) =>
    apiRequest<CollectionItem>(
      user,
      `/v1/admin/users/${id}/cards`,
      jsonBody("POST", { cardId, quantity, shiny }),
    ),
  lockCard: (user: User, id: string, cardId: string) =>
    apiRequest<{ cardId: string; removed: boolean }>(user, `/v1/admin/users/${id}/cards/${cardId}`, {
      method: "DELETE",
    }),
  removeCopies: (user: User, id: string, cardId: string, quantity: number, shiny: boolean) =>
    apiRequest<{ cardId: string; removed: number; quantity: number; shinyQuantity: number }>(
      user,
      `/v1/admin/users/${id}/cards/${cardId}/remove`,
      jsonBody("POST", { quantity, shiny }),
    ),
  resetCollection: (user: User, id: string, history: boolean) =>
    apiRequest<AdminUserDetail>(user, `/v1/admin/users/${id}/reset`, jsonBody("POST", { history })),
  resetAllCollections: (user: User, history: boolean) =>
    apiRequest<{ players: number; cards: number; openings: number }>(
      user,
      "/v1/admin/users/reset-collections",
      jsonBody("POST", { history, confirm: "RESET" }),
    ),
  deleteUser: (user: User, id: string) =>
    apiRequest<{ userId: string; deleted: boolean; firebaseDeleted: boolean }>(user, `/v1/admin/users/${id}`, {
      method: "DELETE",
    }),
  suspend: (user: User, id: string, reason: string) =>
    apiRequest<AdminUserDetail>(user, `/v1/admin/users/${id}/suspend`, jsonBody("POST", { reason })),
  reactivate: (user: User, id: string) =>
    apiRequest<AdminUserDetail>(user, `/v1/admin/users/${id}/reactivate`, jsonBody("POST")),

  // — catalog —
  cards: (
    user: User,
    params: { page?: number; pageSize?: number; search?: string; rarity?: Rarity; status?: CardStatus; sort?: CardSort },
  ) => apiRequest<AdminCardsPage>(user, `/v1/admin/cards${query(params)}`),
  cardDetail: (user: User, id: string) =>
    apiRequest<AdminCardDetail>(user, `/v1/admin/cards/${id}`),
  updateCard: (user: User, id: string, payload: { enabled?: boolean; rarityOverride?: Rarity | null }) =>
    apiRequest<AdminCardDetail>(user, `/v1/admin/cards/${id}`, jsonBody("PATCH", payload)),
  // — families —
  families: (user: User) => apiRequest<AdminFamily[]>(user, "/v1/admin/families"),
  family: (user: User, id: string) => apiRequest<AdminFamily>(user, `/v1/admin/families/${id}`),
  previewFamily: (
    user: User,
    payload: FamilyDefinition & { view?: FamilyPreviewView; search?: string; page?: number; pageSize?: number },
    signal?: AbortSignal,
  ) =>
    apiRequest<FamilyPreview>(user, "/v1/admin/families/preview", { ...jsonBody("POST", payload), signal }),
  createFamily: (user: User, payload: FamilyPayload) =>
    apiRequest<AdminFamily>(user, "/v1/admin/families", jsonBody("POST", payload)),
  updateFamily: (user: User, id: string, payload: FamilyPayload) =>
    apiRequest<AdminFamily>(user, `/v1/admin/families/${id}`, jsonBody("PATCH", payload)),
  deleteFamily: (user: User, id: string) =>
    apiRequest<{ id: string; removed: boolean }>(user, `/v1/admin/families/${id}`, { method: "DELETE" }),
  resolveFamilies: (user: User) =>
    apiRequest<{ resolved: number; failed: number }>(user, "/v1/admin/families/resolve", jsonBody("POST")),

  recomputeRarities: (user: User) =>
    apiRequest<{ ranked: number; changed: number }>(user, "/v1/admin/cards/recompute-rarities", jsonBody("POST")),

  // — sync —
  syncStatus: (user: User) => apiRequest<SyncStatus>(user, "/v1/admin/sync/status"),
  syncRuns: (user: User, page = 1, pageSize = 15) =>
    apiRequest<Page<SyncRun>>(user, `/v1/admin/sync/runs${query({ page, pageSize })}`),
  syncRun: (user: User, id: string) =>
    apiRequest<SyncRunDetail>(user, `/v1/admin/sync/runs/${id}`),
  startSync: (user: User) =>
    apiRequest<SyncRunDetail>(user, "/v1/admin/sync/runs", jsonBody("POST")),

  // — settings —
  settings: (user: User) => apiRequest<GameSettings>(user, "/v1/admin/settings"),
  updateSettings: (user: User, payload: GameSettingsPayload) =>
    apiRequest<GameSettings>(user, "/v1/admin/settings", jsonBody("PATCH", payload)),

  // — access —
  admins: (user: User) => apiRequest<AdminGrant[]>(user, "/v1/admin/admins"),
  addAdmin: (user: User, email: string) =>
    apiRequest<AdminGrant>(user, "/v1/admin/admins", jsonBody("POST", { email })),
  removeAdmin: (user: User, email: string) =>
    apiRequest<{ email: string; removed: boolean }>(
      user,
      `/v1/admin/admins/${encodeURIComponent(email)}`,
      { method: "DELETE" },
    ),
  audit: (user: User, page = 1, pageSize = 25) =>
    apiRequest<Page<AuditEntry>>(user, `/v1/admin/audit${query({ page, pageSize })}`),
};
