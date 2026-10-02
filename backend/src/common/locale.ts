/**
 * The languages the game is played in, kept free of Nest and Prisma. The
 * names mirror the Prisma `Locale` enum, whose generated type is the same
 * string union.
 */
export const LOCALES = ["fr", "en", "zh"] as const;

export type AppLocale = (typeof LOCALES)[number];

/** Served when a disease has no article in the language asked for. */
export const FALLBACK_LOCALE: AppLocale = "en";

/**
 * Where each language's diseases come from. Chinese Wikipedia stores articles
 * in both scripts and converts on display: `variant` asks for simplified
 * Chinese, and `wikidataLanguage` is the label language matching it.
 */
export const WIKIS: Record<
  AppLocale,
  { host: string; variant?: string; wikidataLanguage: string }
> = {
  fr: { host: "fr.wikipedia.org", wikidataLanguage: "fr" },
  en: { host: "en.wikipedia.org", wikidataLanguage: "en" },
  zh: { host: "zh.wikipedia.org", variant: "zh-cn", wikidataLanguage: "zh-hans" },
};

/** `fr`, `fr-FR`, `zh-Hans-CN`, `ZH_tw` → the matching locale, or null. */
export function parseLocale(value: unknown): AppLocale | null {
  if (typeof value !== "string") return null;
  const primary = value.trim().toLowerCase().split(/[-_]/)[0];
  return (LOCALES as readonly string[]).includes(primary ?? "")
    ? (primary as AppLocale)
    : null;
}

/**
 * The first supported language of an `Accept-Language` header, by quality:
 * `zh-CN,zh;q=0.9,en;q=0.8` → `zh`.
 */
export function localeFromAcceptLanguage(header: unknown): AppLocale | null {
  if (typeof header !== "string" || !header.trim()) return null;

  const ranked = header
    .split(",")
    .map((part, index) => {
      const [tag, ...params] = part.trim().split(";");
      const quality = params
        .map((param) => param.trim())
        .find((param) => param.startsWith("q="));
      const q = quality ? Number(quality.slice(2)) : 1;
      return { tag: tag ?? "", q: Number.isFinite(q) ? q : 0, index };
    })
    .filter((entry) => entry.q > 0)
    .sort((a, b) => b.q - a.q || a.index - b.index);

  for (const entry of ranked) {
    const locale = parseLocale(entry.tag);
    if (locale) return locale;
  }
  return null;
}

/**
 * The order in which languages are tried for a card: the one asked for, then
 * English, then the others in their declared order.
 */
export function fallbackChain(requested: AppLocale): AppLocale[] {
  return [
    requested,
    ...[FALLBACK_LOCALE, ...LOCALES].filter((locale) => locale !== requested),
  ].filter((locale, index, all) => all.indexOf(locale) === index);
}

/** Picks the best entry for `requested`, following `fallbackChain`. */
export function pickLocalized<T extends { locale: string }>(
  entries: readonly T[],
  requested: AppLocale,
): T | undefined {
  for (const locale of fallbackChain(requested)) {
    const entry = entries.find((candidate) => candidate.locale === locale);
    if (entry) return entry;
  }
  return entries[0];
}
