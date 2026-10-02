import type { Locale } from "../api/types";

/** The BCP 47 tag for `Intl`: the game's Chinese is simplified. */
export function intlLocale(locale: Locale): string {
  return locale === "zh" ? "zh-CN" : locale;
}

export function formatNumber(value: number, locale: Locale): string {
  return new Intl.NumberFormat(intlLocale(locale)).format(value);
}

export function formatCompact(value: number, locale: Locale): string {
  return new Intl.NumberFormat(intlLocale(locale), { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

/** `#0042`: the collection number, zero-padded to four digits. */
export function cardNumber(number: number): string {
  return `#${String(number).padStart(4, "0")}`;
}

/** The letter shown in place of an avatar. */
export function initialOf(name: string | null | undefined): string {
  const first = name?.trim().charAt(0);
  return first ? first.toUpperCase() : "?";
}

/** `m:ss` */
export function clock(ms: number): string {
  const minutes = Math.floor(ms / 60_000);
  const seconds = Math.floor((ms % 60_000) / 1000);
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}
