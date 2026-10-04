/**
 * Shapes returned by the backend. The OpenAPI document (`/api-json` on the
 * backend, or `npm run openapi:generate` there) is the source of truth; these
 * mirror the parts the player app uses.
 */
export type Rarity = "COMMON" | "UNCOMMON" | "RARE" | "EPIC" | "LEGENDARY";

export const RARITIES_DESC: Rarity[] = ["LEGENDARY", "EPIC", "RARE", "UNCOMMON", "COMMON"];

/** The game's languages. Cards missing one are served in English. */
export type Locale = "fr" | "en" | "zh";

export const LOCALES: Locale[] = ["fr", "en", "zh"];

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
  /** Distinct cards owned in a shiny copy. */
  shinyOwned: number;
  catalogSize: number;
  completionPct: number;
  /** Rarity points plus `familyBonus`: what the leaderboard ranks on. */
  score: number;
  familyBonus: number;
  familiesCompleted: number;
  byRarity: Array<{ rarity: Rarity; owned: number; total: number }>;
};

export type Me = {
  id: string;
  email: string;
  displayName: string | null;
  photoUrl: string | null;
  role: "USER" | "ADMIN";
  /** Cards are served in it; the interface follows it too. */
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
  /** The language the name and article are in: English when the disease has
   * no article in the account's language. */
  lang: Locale;
};

export type CardDetail = Card & {
  extract: string | null;
  icd10: string[];
  quantity: number;
  shinyQuantity: number;
  firstObtainedAt: string | null;
  ownersCount: number;
  languages: Locale[];
  families: FamilyBrief[];
};

/** A themed set of cards: owning every droppable member adds `bonusPoints` to the score. */
export type FamilyBrief = {
  id: string;
  name: string;
  /** An emoji. */
  icon: string | null;
  bonusPoints: number;
};

export type FamilyProgress = FamilyBrief & {
  owned: number;
  total: number;
  completed: boolean;
};

export type CollectionItem = {
  card: Card;
  quantity: number;
  /** Copies that are shiny: show the card shiny when above 0. */
  shinyQuantity: number;
  firstObtainedAt: string | null;
  lastObtainedAt: string | null;
};

export type Page<T> = { items: T[]; total: number; page: number; pageSize: number };

export type PackSource = "NATURAL" | "BONUS";

export type CollectionSort = "number" | "name" | "rarity" | "popularity" | "recent";

export type OwnedFilter = "owned" | "missing" | "all" | "shiny";

export type PackOpening = {
  id: string;
  source: PackSource;
  openedAt: string;
  /** `isShiny`: a one-in-10,000 copy, any rarity, shown with its special effect. */
  cards: Array<{ slot: number; rarity: Rarity; isNew: boolean; isShiny: boolean; card: Card }>;
  wallet?: PackWallet;
  /** Families this pack's new cards completed. Only on the opening itself. */
  completedFamilies?: FamilyBrief[];
};

export type LeaderboardEntry = {
  rank: number;
  userId: string;
  displayName: string | null;
  photoUrl: string | null;
  uniqueOwned: number;
  score: number;
};

export type DiscordLinkCode = { code: string; expiresAt: string };

export type DiscordStatus = {
  /** False when the game server runs without a bot: hide the feature. */
  enabled: boolean;
  inviteUrl: string | null;
  account: { username: string; announce: boolean; linkedAt: string } | null;
  pendingCode: DiscordLinkCode | null;
};
