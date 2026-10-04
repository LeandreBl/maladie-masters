import { Injectable } from "@nestjs/common";
import { LOCALES, WIKIS, type AppLocale } from "../common/locale";
import { WikimediaHttpService } from "./wikimedia-http.service";

const SPARQL_ENDPOINT = "https://query.wikidata.org/sparql";

/**
 * What makes an item a disease. Each pattern runs as its own query: their
 * union in a single one is what times out on the Wikidata Query Service.
 *
 * - every subclass, at any depth, of "disease" (Q12136);
 * - items that are directly an instance of "disease", "class of disease"
 *   (Q112193867, where Wikidata now files most diseases), "rare disease"
 *   (Q929833) or "genetic disease" (Q42303753).
 */
const DISEASE_PATTERNS = [
  "?item wdt:P279+ wd:Q12136 .",
  "VALUES ?class { wd:Q12136 wd:Q112193867 wd:Q929833 wd:Q42303753 } ?item wdt:P31 ?class .",
];

/** Titles per action API request: the documented maximum for most props. */
const METADATA_BATCH = 50;
/** `prop=extracts` returns at most 20 intros per request. */
const EXTRACT_BATCH = 20;
/** Breathing room between two action API requests. */
const REQUEST_GAP_MS = 150;

export interface DiseaseEntry {
  wikidataId: string;
  /** The article title in each language that has one. */
  titles: Partial<Record<AppLocale, string>>;
}

export interface PageMetadata {
  /** The title after normalisation and redirects. */
  canonicalTitle: string;
  /** The title as readers see it: simplified Chinese on zh. */
  displayTitle: string;
  pageviews: number;
  description: string | null;
  imageUrl: string | null;
  missing: boolean;
}

type Progress = (done: number, total: number) => void | Promise<void>;

interface SparqlResponse {
  results: { bindings: Array<Record<string, { value: string }>> };
}

interface ActionQueryResponse {
  continue?: Record<string, string>;
  query?: {
    normalized?: Array<{ from: string; to: string }>;
    redirects?: Array<{ from: string; to: string }>;
    pages?: Array<{
      title: string;
      missing?: boolean;
      invalid?: boolean;
      description?: string;
      thumbnail?: { source: string };
      varianttitles?: Record<string, string>;
      pageviews?: Record<string, number | null>;
      extract?: string;
    }>;
  };
}

const sleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

/** `Rage (maladie)` → `Rage`: the qualifier is for disambiguation only. */
export function cardNameFromTitle(title: string): string {
  const stripped = title.replace(/\s*\([^()]*\)\s*$/, "").trim();
  return stripped || title;
}

interface WbEntitiesResponse {
  entities?: Record<
    string,
    { descriptions?: Record<string, { value: string }> }
  >;
}

interface WbLabelsResponse {
  entities?: Record<string, { labels?: Record<string, { value: string }> }>;
}

/**
 * Where the diseases come from: Wikidata says which items are diseases and
 * which article each has on the French, English and Chinese Wikipedias; each
 * Wikipedia gives its article's popularity, picture, short description and
 * opening sentences.
 */
@Injectable()
export class WikipediaDiseaseSource {
  constructor(private readonly http: WikimediaHttpService) {}

  readonly locales = LOCALES;

  host(locale: AppLocale): string {
    return WIKIS[locale].host;
  }

  articleUrl(locale: AppLocale, title: string): string {
    return `https://${this.host(locale)}/wiki/${encodeURIComponent(title.replace(/ /g, "_"))}`;
  }

  /**
   * Every disease item with an article in at least one language, keyed by
   * QID. One query per pattern and per language: the Query Service times out
   * on the union of them.
   */
  async fetchDiseases(
    onProgress?: (message: string) => void | Promise<void>,
  ): Promise<Map<string, DiseaseEntry>> {
    const diseases = new Map<string, DiseaseEntry>();

    for (const locale of LOCALES) {
      let found = 0;
      for (const pattern of DISEASE_PATTERNS) {
        const rows = await this.sparql(`
          SELECT DISTINCT ?item ?article WHERE {
            ${pattern}
            ?article schema:about ?item ;
                     schema:isPartOf <https://${this.host(locale)}/> .
          }
        `);

        for (const row of rows) {
          const wikidataId = row.item?.value.split("/").pop();
          const article = row.article?.value;
          if (!wikidataId || !article) continue;

          const title = decodeURIComponent(
            article.slice(article.indexOf("/wiki/") + "/wiki/".length),
          ).replace(/_/g, " ");
          const entry = diseases.get(wikidataId) ?? { wikidataId, titles: {} };
          if (!entry.titles[locale]) found += 1;
          entry.titles[locale] = title;
          diseases.set(wikidataId, entry);
        }
      }
      await onProgress?.(`${found} diseases with a ${this.host(locale)} article`);
    }

    return diseases;
  }

  /** ICD-10 codes (P494) of every item with an article in any language. */
  async fetchIcd10Codes(): Promise<Map<string, string[]>> {
    const wikis = LOCALES.map((locale) => `<https://${this.host(locale)}/>`).join(" ");
    const rows = await this.sparql(`
      SELECT DISTINCT ?item ?code WHERE {
        VALUES ?wiki { ${wikis} }
        ?item wdt:P494 ?code .
        ?article schema:about ?item ;
                 schema:isPartOf ?wiki .
      }
    `);

    const codes = new Map<string, string[]>();
    for (const row of rows) {
      const wikidataId = row.item?.value.split("/").pop();
      const code = row.code?.value;
      if (!wikidataId || !code) continue;
      const list = codes.get(wikidataId) ?? [];
      if (!list.includes(code)) list.push(code);
      codes.set(wikidataId, list.sort());
    }
    return codes;
  }

  /**
   * Views over the last `days` days (60 at most, a limit of the API), the
   * lead image, the short description and the displayed title, keyed by the
   * title asked for.
   */
  async fetchMetadata(
    locale: AppLocale,
    titles: string[],
    days: number,
    onProgress?: Progress,
  ): Promise<Map<string, PageMetadata>> {
    const { variant } = WIKIS[locale];
    const result = new Map<string, PageMetadata>();
    let done = 0;

    for (const batch of chunk(titles, METADATA_BATCH)) {
      const pages = await this.queryPages(locale, batch, {
        prop: variant
          ? "pageviews|pageimages|description|info"
          : "pageviews|pageimages|description",
        pvipdays: String(Math.min(60, Math.max(1, days))),
        piprop: "thumbnail",
        pithumbsize: "640",
        pilimit: String(METADATA_BATCH),
        ...(variant ? { inprop: "varianttitles" } : {}),
      });

      for (const title of batch) {
        const page = pages.get(title);
        const views = page?.pageviews
          ? Object.values(page.pageviews).reduce<number>(
              (sum, value) => sum + (value ?? 0),
              0,
            )
          : 0;
        const canonicalTitle = page?.title ?? title;
        result.set(title, {
          canonicalTitle,
          displayTitle:
            (variant ? page?.varianttitles?.[variant] : undefined) ?? canonicalTitle,
          pageviews: views,
          description: page?.description?.trim() || null,
          imageUrl: page?.thumbnail?.source ?? null,
          missing: !page || Boolean(page.missing || page.invalid),
        });
      }

      done += batch.length;
      await onProgress?.(done, titles.length);
      await sleep(REQUEST_GAP_MS);
    }

    return result;
  }

  /** The article's opening sentences, as plain text, keyed by title. */
  async fetchExtracts(
    locale: AppLocale,
    titles: string[],
    onProgress?: Progress,
  ): Promise<Map<string, string>> {
    const { variant } = WIKIS[locale];
    const result = new Map<string, string>();
    let done = 0;

    for (const batch of chunk(titles, EXTRACT_BATCH)) {
      const pages = await this.queryPages(locale, batch, {
        prop: "extracts",
        exintro: "1",
        explaintext: "1",
        exsentences: "3",
        exlimit: String(EXTRACT_BATCH),
        ...(variant ? { variant } : {}),
      });

      for (const title of batch) {
        const extract = pages.get(title)?.extract?.trim();
        if (extract) result.set(title, extract);
      }

      done += batch.length;
      await onProgress?.(done, titles.length);
      await sleep(REQUEST_GAP_MS);
    }

    return result;
  }

  /**
   * Short descriptions straight from Wikidata, in `locale`'s label language.
   * Used for Chinese, whose Wikipedia hands back the description in whatever
   * script it was written in, where Wikidata has a simplified one.
   */
  async fetchWikidataDescriptions(
    locale: AppLocale,
    qids: string[],
    onProgress?: Progress,
  ): Promise<Map<string, string>> {
    const language = WIKIS[locale].wikidataLanguage;
    const result = new Map<string, string>();
    let done = 0;

    for (const batch of chunk(qids, METADATA_BATCH)) {
      const body = await this.http.getJson<WbEntitiesResponse>(
        "https://www.wikidata.org/w/api.php",
        {
          action: "wbgetentities",
          format: "json",
          ids: batch.join("|"),
          props: "descriptions",
          languages: language,
          languagefallback: "1",
          maxlag: "5",
        },
      );

      for (const [qid, entity] of Object.entries(body.entities ?? {})) {
        const value = entity.descriptions?.[language]?.value?.trim();
        if (value) result.set(qid, value);
      }

      done += batch.length;
      await onProgress?.(done, qids.length);
      await sleep(REQUEST_GAP_MS);
    }

    return result;
  }

  /**
   * Every item that is `qid` or, at any depth, a subclass of it or an
   * instance of such a subclass: what a family's `wikidataClass` rule takes.
   * Most diseases are classes in Wikidata, hence both paths.
   */
  async fetchClassMembers(qid: string): Promise<Set<string>> {
    const rows = await this.sparql(`
      SELECT DISTINCT ?item WHERE {
        { ?item wdt:P279* wd:${qid} . } UNION { ?item wdt:P31/wdt:P279* wd:${qid} . }
      }
    `);
    return new Set(
      rows.flatMap((row) => {
        const id = row.item?.value.split("/").pop();
        return id ? [id] : [];
      }),
    );
  }

  /** Labels of a few items, in `locale`'s label language or a fallback. */
  async fetchLabels(locale: AppLocale, qids: string[]): Promise<Map<string, string>> {
    const language = WIKIS[locale].wikidataLanguage;
    const result = new Map<string, string>();
    for (const batch of chunk(qids, METADATA_BATCH)) {
      const body = await this.http.getJson<WbLabelsResponse>(
        "https://www.wikidata.org/w/api.php",
        {
          action: "wbgetentities",
          format: "json",
          ids: batch.join("|"),
          props: "labels",
          languages: language,
          languagefallback: "1",
          // No `maxlag`: a handful of labels for the admin panel is not the
          // kind of load it exists to shed, and waiting on it stalls a preview.
        },
      );
      for (const [qid, entity] of Object.entries(body.entities ?? {})) {
        const value = entity.labels?.[language]?.value?.trim();
        if (value) result.set(qid, value);
      }
    }
    return result;
  }

  private async sparql(query: string) {
    const body = await this.http.getJson<SparqlResponse>(
      SPARQL_ENDPOINT,
      { query, format: "json" },
      "application/sparql-results+json",
    );
    return body.results.bindings;
  }

  /**
   * One action API query over up to 50 titles, following `continue` until
   * every requested prop is complete, with pages mapped back to the titles
   * that were asked for (through normalisation and redirects).
   */
  private async queryPages(
    locale: AppLocale,
    titles: string[],
    params: Record<string, string>,
  ): Promise<Map<string, NonNullable<NonNullable<ActionQueryResponse["query"]>["pages"]>[number]>> {
    type Page = NonNullable<NonNullable<ActionQueryResponse["query"]>["pages"]>[number];
    const byTitle = new Map<string, Page>();
    const aliases = new Map<string, string>();
    let continuation: Record<string, string> = {};

    for (let guard = 0; guard < 20; guard += 1) {
      const body = await this.http.getJson<ActionQueryResponse>(
        `https://${this.host(locale)}/w/api.php`,
        {
          action: "query",
          format: "json",
          formatversion: "2",
          redirects: "1",
          maxlag: "5",
          titles: titles.join("|"),
          ...params,
          ...continuation,
        },
      );

      for (const { from, to } of [
        ...(body.query?.normalized ?? []),
        ...(body.query?.redirects ?? []),
      ]) {
        aliases.set(from, to);
      }

      for (const page of body.query?.pages ?? []) {
        const known = byTitle.get(page.title);
        byTitle.set(page.title, {
          ...known,
          ...page,
          pageviews: page.pageviews ?? known?.pageviews,
          extract: page.extract ?? known?.extract,
          thumbnail: page.thumbnail ?? known?.thumbnail,
          description: page.description ?? known?.description,
          varianttitles: page.varianttitles ?? known?.varianttitles,
        });
      }

      if (!body.continue) break;
      const { continue: _marker, ...next } = body.continue;
      continuation = { ...next, continue: body.continue.continue ?? "" };
      await sleep(REQUEST_GAP_MS);
    }

    const result = new Map<string, Page>();
    for (const title of titles) {
      let resolved = title;
      // Normalisation then redirect: at most two hops, guarded against loops.
      for (let hop = 0; hop < 3 && aliases.has(resolved); hop += 1) {
        resolved = aliases.get(resolved) ?? resolved;
      }
      const page = byTitle.get(resolved);
      if (page) result.set(title, page);
    }
    return result;
  }
}
