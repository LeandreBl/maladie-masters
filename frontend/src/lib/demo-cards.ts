import type { Card, Locale, Rarity } from "../api/types";
import type { DemoCard, Dictionary } from "../i18n/dictionaries";

const DEMO: Record<DemoCard, { number: number; rarity: Rarity; pageviews: number }> = {
  tuberculosis: { number: 3, rarity: "LEGENDARY", pageviews: 2_410_000 },
  acromegaly: { number: 118, rarity: "EPIC", pageviews: 412_000 },
  marfan: { number: 402, rarity: "RARE", pageviews: 151_000 },
};

/**
 * A sample card for the screens that have no API to ask: the sign-in page and
 * the Discord announcement preview.
 */
export function demoCard(key: DemoCard, t: Dictionary, locale: Locale): Card {
  const [name, description] = t.demo[key];
  return {
    id: `demo-${key}`,
    ...DEMO[key],
    name,
    description,
    imageUrl: null,
    popularityRank: DEMO[key].number,
    wikipediaUrl: "",
    lang: locale,
  };
}
