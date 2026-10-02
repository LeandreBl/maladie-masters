import type { Card, CardLocalization, Prisma, UserCard } from "@prisma/client";
import { FALLBACK_LOCALE, pickLocalized, type AppLocale } from "../common/locale";
import type { CardDto, CollectionItemDto } from "./dto/card.dto";

/** What every card query loads, so a card can be told in any language. */
export const CARD_INCLUDE = {
  localizations: true,
} as const satisfies Prisma.CardInclude;

export type LocalizedCard = Card & { localizations: CardLocalization[] };

/** The card's text in `locale`, or in the fallback chain's first language that has it. */
export function localizationOf(
  card: LocalizedCard,
  locale: AppLocale,
): CardLocalization | undefined {
  return pickLocalized(card.localizations, locale);
}

/** A name for logs and audit entries, where no reader's language applies. */
export function cardLabel(card: LocalizedCard): string {
  return localizationOf(card, FALLBACK_LOCALE)?.name ?? card.wikidataId;
}

export function toCardDto(card: LocalizedCard, locale: AppLocale): CardDto {
  const text = localizationOf(card, locale);
  return {
    id: card.id,
    number: card.number,
    name: text?.name ?? card.wikidataId,
    description: text?.description ?? null,
    imageUrl: card.imageUrl,
    rarity: card.rarity,
    pageviews: card.pageviews,
    popularityRank: card.popularityRank,
    wikipediaUrl: text?.wikipediaUrl ?? `https://www.wikidata.org/wiki/${card.wikidataId}`,
    lang: (text?.locale ?? FALLBACK_LOCALE) as AppLocale,
  };
}

export function toCollectionItem(
  card: LocalizedCard,
  locale: AppLocale,
  owned:
    | Pick<UserCard, "quantity" | "shinyQuantity" | "firstObtainedAt" | "lastObtainedAt">
    | undefined,
): CollectionItemDto {
  return {
    card: toCardDto(card, locale),
    quantity: owned?.quantity ?? 0,
    shinyQuantity: owned?.shinyQuantity ?? 0,
    firstObtainedAt: owned?.firstObtainedAt.toISOString() ?? null,
    lastObtainedAt: owned?.lastObtainedAt.toISOString() ?? null,
  };
}
