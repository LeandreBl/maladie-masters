import { Prisma } from "@prisma/client";
import { fallbackChain, type AppLocale } from "../common/locale";
import type { PrismaService } from "../prisma/prisma.service";

/**
 * Matches a card whose name, in any language, contains `search`: a player
 * looking for "grippe" finds Influenza whatever language they read in.
 */
export function nameSearch(search: string): Prisma.CardWhereInput {
  return {
    localizations: { some: { name: { contains: search, mode: "insensitive" } } },
  };
}

/**
 * One page of `where`, ordered by the name the reader sees — their language's
 * name, or the fallback one — which Prisma cannot express: the name lives in
 * a related row chosen per card. The ids are filtered by Prisma, then ordered
 * in SQL.
 */
export async function pageIdsByName(
  prisma: PrismaService,
  where: Prisma.CardWhereInput,
  locale: AppLocale,
  skip: number,
  take: number,
): Promise<{ ids: string[]; total: number }> {
  const matching = await prisma.card.findMany({ where, select: { id: true } });
  const ids = matching.map((card) => card.id);
  if (ids.length === 0) return { ids: [], total: 0 };

  const [first, second, third] = fallbackChain(locale);
  const rows = await prisma.$queryRaw<Array<{ id: string }>>`
    SELECT c.id
    FROM cards c
    LEFT JOIN card_localizations l1 ON l1.card_id = c.id AND l1.locale = ${first}::"Locale"
    LEFT JOIN card_localizations l2 ON l2.card_id = c.id AND l2.locale = ${second}::"Locale"
    LEFT JOIN card_localizations l3 ON l3.card_id = c.id AND l3.locale = ${third}::"Locale"
    WHERE c.id = ANY(${ids}::text[])
    ORDER BY lower(COALESCE(l1.name, l2.name, l3.name, c.wikidata_id)), c.number
    OFFSET ${skip} LIMIT ${take}
  `;

  return { ids: rows.map((row) => row.id), total: ids.length };
}

/** Reorders `items` to follow `ids`. */
export function inIdOrder<T extends { id: string }>(ids: string[], items: T[]): T[] {
  const byId = new Map(items.map((item) => [item.id, item]));
  return ids.flatMap((id) => byId.get(id) ?? []);
}
