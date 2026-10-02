/**
 * Two Wikidata items can point at the same article: one item's sitelink is a
 * redirect, and resolving it lands on the other's page. Left alone, that gives
 * two cards with the same name, picture and views.
 *
 * One entry per article is kept: the one whose own sitelink already is the
 * article (not a redirect to it), then the lowest QID — the older item.
 */
export interface ArticleEntry {
  wikidataId: string;
  pageTitle: string;
}

function qidNumber(qid: string): number {
  return Number(qid.replace(/^Q/, "")) || Number.MAX_SAFE_INTEGER;
}

export function dedupeByArticle<T extends ArticleEntry>(
  entries: T[],
  canonicalTitle: (entry: T) => string,
): { kept: T[]; dropped: T[] } {
  const byArticle = new Map<string, T>();

  for (const entry of entries) {
    const article = canonicalTitle(entry);
    const current = byArticle.get(article);
    if (!current) {
      byArticle.set(article, entry);
      continue;
    }

    const entryIsDirect = entry.pageTitle === article;
    const currentIsDirect = current.pageTitle === article;
    const better =
      entryIsDirect !== currentIsDirect
        ? entryIsDirect
        : qidNumber(entry.wikidataId) < qidNumber(current.wikidataId);
    if (better) byArticle.set(article, entry);
  }

  const kept = new Set(byArticle.values());
  return {
    kept: entries.filter((entry) => kept.has(entry)),
    dropped: entries.filter((entry) => !kept.has(entry)),
  };
}
