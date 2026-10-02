/**
 * Locale-aware formatting.
 *
 * Everything goes through `Intl`, so French gets its narrow no-break space
 * thousands separator, its comma decimal and its suffixed units (41 714 €,
 * 28,4 %) without a lookup table of our own — which is what the handoff asks
 * for. Callers pass the BCP 47 tag from `useLocale()`.
 */

/** Cents to a currency string: 899 → "8,99 €" / "€8.99". */
export function formatMoney(
  cents: number | null | undefined,
  locale: string,
  currency = "EUR",
): string {
  if (cents === null || cents === undefined) return "—";
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    // Whole amounts read better without ",00" on a dashboard.
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

/**
 * A compact currency for the big dashboard numbers: 4171400 → "41,7 k€".
 * Falls back to the full amount below 10 000 units, where the abbreviation
 * costs precision without saving space.
 */
export function formatMoneyCompact(
  cents: number | null | undefined,
  locale: string,
  currency = "EUR",
): string {
  if (cents === null || cents === undefined) return "—";
  const units = cents / 100;
  if (Math.abs(units) < 10_000) return formatMoney(cents, locale, currency);

  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(units);
}

/** A signed amount, for deltas: +1 118 € / −412 €. */
export function formatMoneyDelta(
  cents: number | null | undefined,
  locale: string,
  currency = "EUR",
): string {
  if (cents === null || cents === undefined) return "—";
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    signDisplay: "exceptZero",
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

export function formatNumber(
  value: number | null | undefined,
  locale: string,
): string {
  if (value === null || value === undefined) return "—";
  return new Intl.NumberFormat(locale).format(value);
}

/** A percentage already expressed in percent: 28.4 → "28,4 %". */
export function formatPercent(
  value: number | null | undefined,
  locale: string,
  fractionDigits = 1,
): string {
  if (value === null || value === undefined) return "—";
  return new Intl.NumberFormat(locale, {
    style: "percent",
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(value / 100);
}

/** A signed percentage for a delta tag: +6,4 % / −0,9 %. */
export function formatPercentDelta(
  value: number | null | undefined,
  locale: string,
): string | null {
  if (value === null || value === undefined) return null;
  return new Intl.NumberFormat(locale, {
    style: "percent",
    signDisplay: "exceptZero",
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value / 100);
}

/** Seconds to a run time: 31.14 → "31,14 s". */
export function formatSeconds(
  value: number | null | undefined,
  locale: string,
): string {
  if (value === null || value === undefined) return "—";
  return `${new Intl.NumberFormat(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)} s`;
}

export function formatDate(
  value: string | Date | null | undefined,
  locale: string,
): string {
  const date = toDate(value);
  if (!date) return "—";
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(date);
}

export function formatDateTime(
  value: string | Date | null | undefined,
  locale: string,
): string {
  const date = toDate(value);
  if (!date) return "—";
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function formatTime(
  value: string | Date | null | undefined,
  locale: string,
): string {
  const date = toDate(value);
  if (!date) return "—";
  return new Intl.DateTimeFormat(locale, { timeStyle: "short" }).format(date);
}

/**
 * A relative time — "3 h ago" / "il y a 3 h". `Intl.RelativeTimeFormat`
 * localises the phrasing, so the panel carries no table of its own.
 */
export function formatRelative(
  value: string | Date | null | undefined,
  locale: string,
): string {
  const date = toDate(value);
  if (!date) return "—";

  const seconds = Math.round((date.getTime() - Date.now()) / 1000);
  const format = new Intl.RelativeTimeFormat(locale, {
    numeric: "auto",
    style: "short",
  });

  const steps: Array<[Intl.RelativeTimeFormatUnit, number]> = [
    ["second", 60],
    ["minute", 60],
    ["hour", 24],
    ["day", 30],
    ["month", 12],
  ];

  let amount = seconds;
  for (const [unit, span] of steps) {
    if (Math.abs(amount) < span) return format.format(amount, unit);
    amount = Math.round(amount / span);
  }
  return format.format(amount, "year");
}

/** A month key from the API (`2026-09`) as a short month name. */
export function formatMonthKey(key: string, locale: string): string {
  const [year, month] = key.split("-").map(Number);
  if (!year || !month) return key;
  return new Intl.DateTimeFormat(locale, { month: "short" })
    .format(new Date(Date.UTC(year, month - 1, 1)))
    .toUpperCase();
}

/** An ISO day (`2026-09-04`) as a short axis tick. */
export function formatDayKey(key: string, locale: string): string {
  const date = new Date(`${key}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return key;
  return new Intl.DateTimeFormat(locale, {
    day: "2-digit",
    month: "short",
    timeZone: "UTC",
  })
    .format(date)
    .toUpperCase();
}

/** null quota = unlimited (spec 002, FR-016). */
export function formatQuota(
  quota: number | null,
  locale: string,
  unlimitedLabel: string,
): string {
  return quota === null ? unlimitedLabel : formatNumber(quota, locale);
}

/** Initials for an avatar circle: "Marta Keller" → "MK". */
export function initialsOf(
  name: string | null | undefined,
  email: string,
): string {
  const source = name?.trim() || email.split("@")[0];
  const words = source.split(/[\s._-]+/).filter(Boolean);
  const letters =
    words.length >= 2
      ? `${words[0][0]}${words[1][0]}`
      : source.slice(0, 2);
  return letters.toUpperCase();
}

function toDate(value: string | Date | null | undefined): Date | null {
  if (!value) return null;
  const date = typeof value === "string" ? new Date(value) : value;
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * A file size in the unit a person would say out loud: 524288000 → "500 MB".
 *
 * `Intl` has a `unit` style but no notion of picking the unit, so the step is
 * chosen here and the number is still formatted by the locale — French gets
 * its comma decimal, English its point.
 */
export function formatBytes(
  bytes: number | string | null | undefined,
  locale: string,
): string {
  const value = typeof bytes === "string" ? Number(bytes) : bytes;
  if (value === null || value === undefined || Number.isNaN(value)) return "—";

  const units = ["byte", "kilobyte", "megabyte", "gigabyte"] as const;
  let amount = value;
  let step = 0;
  while (amount >= 1024 && step < units.length - 1) {
    amount /= 1024;
    step += 1;
  }

  return new Intl.NumberFormat(locale, {
    style: "unit",
    unit: units[step],
    unitDisplay: "short",
    maximumFractionDigits: step === 0 ? 0 : 1,
  }).format(amount);
}
