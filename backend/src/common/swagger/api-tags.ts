/**
 * Every tag the OpenAPI document groups operations under. Declared once so a
 * controller cannot invent a typo'd tag that would show up as an extra,
 * undocumented section in the spec.
 */
export const ApiTag = {
  Health: "health",
  Me: "me",
  Packs: "packs",
  Cards: "cards",
  Leaderboard: "leaderboard",
  Discord: "discord",
  Realtime: "realtime",
  AdminUsers: "admin-users",
  AdminCards: "admin-cards",
  AdminFamilies: "admin-families",
  AdminStats: "admin-stats",
  AdminSync: "admin-sync",
  AdminSettings: "admin-settings",
  AdminAccess: "admin-access",
} as const;

export type ApiTagName = (typeof ApiTag)[keyof typeof ApiTag];

/**
 * Tag descriptions rendered at the top of each Swagger UI section. Keeping them
 * next to the tag names means a new tag cannot be added without explaining what
 * it covers.
 */
export const API_TAG_DESCRIPTIONS: Record<ApiTagName, string> = {
  [ApiTag.Health]: "Unauthenticated liveness probe.",
  [ApiTag.Me]:
    "The caller's own profile and collection. The first call a client makes after signing in.",
  [ApiTag.Packs]:
    "The pack wallet: packs refill on a timer up to a cap, and opening one draws cards weighted by rarity.",
  [ApiTag.Cards]:
    "The card catalog: every disease imported from Wikipedia, whether the caller owns it or not.",
  [ApiTag.Leaderboard]: "Top collectors, ranked by a rarity-weighted score.",
  [ApiTag.Realtime]:
    "Live updates: a ticket to open a socket on the websocket relay, which pushes events as they happen.",
  [ApiTag.Discord]:
    "The Discord bot: link the caller's Discord account, and the endpoint Discord sends slash commands to.",
  [ApiTag.AdminUsers]:
    "Player administration: profiles, pack grants, card unlocks, suspensions.",
  [ApiTag.AdminCards]:
    "Catalog administration: disable a card, pin its rarity, recompute the ranking.",
  [ApiTag.AdminFamilies]:
    "Card families: themed sets picked by regex rules and Wikidata classes, with a live preview, and the bonus a player earns for completing one.",
  [ApiTag.AdminStats]: "Dashboard metrics for the admin panel.",
  [ApiTag.AdminSync]:
    "The Wikipedia import: run history, live progress, and a manual trigger.",
  [ApiTag.AdminSettings]:
    "Game rules: pack timer and cap, drop odds, rarity shares, sync schedule.",
  [ApiTag.AdminAccess]: "Admin grants and the audit trail of admin actions.",
};
