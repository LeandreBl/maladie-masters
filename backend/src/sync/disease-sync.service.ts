import { HttpStatus, Injectable, Logger } from "@nestjs/common";
import {
  Prisma,
  SyncRunStatus,
  SyncTrigger,
  type DiseaseSyncRun,
} from "@prisma/client";
import { RarityRankingService } from "../cards/rarity-ranking.service";
import { AppException } from "../common/app.exception";
import { ErrorCode } from "../common/error-code.enum";
import { PrismaService } from "../prisma/prisma.service";
import { RealtimeService } from "../realtime/realtime.service";
import { GameSettingsService } from "../settings/game-settings.service";
import { dedupeByArticle } from "./dedupe";
import { FALLBACK_LOCALE, LOCALES, type AppLocale } from "../common/locale";
import {
  cardNameFromTitle,
  WikipediaDiseaseSource,
  type DiseaseEntry,
  type PageMetadata,
} from "../wikipedia/wikipedia-disease.source";

type MetadataByLocale = Record<AppLocale, Map<string, PageMetadata>>;

/** Where a card's picture comes from, in order. */
const IMAGE_SOURCES: AppLocale[] = [FALLBACK_LOCALE, ...LOCALES.filter((locale) => locale !== FALLBACK_LOCALE)];

/**
 * A run still marked RUNNING after this long is assumed dead (the process
 * that owned it crashed) and no longer blocks a new one.
 */
const STALE_RUN_MS = 6 * 60 * 60_000;

/**
 * Below this share of the cards already known, a Wikidata answer is treated as
 * an outage rather than as news: marking most of the catalog missing because
 * one query came back short would empty every pack.
 */
const MIN_FETCH_RATIO = 0.5;
const MIN_CATALOG_FOR_RATIO_CHECK = 100;

const WRITE_CHUNK = 250;
const MAX_LOG_LINES = 300;
/** Progress lines are written to the run at most this often. */
const FLUSH_INTERVAL_MS = 2_000;

class RunReporter {
  private readonly lines: Array<{ at: string; message: string }> = [];
  private counters: Partial<
    Pick<DiseaseSyncRun, "fetched" | "created" | "updated" | "missing" | "restored">
  > = {};
  private phase: string | null = null;
  private lastFlush = 0;

  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeService,
    private readonly logger: Logger,
    readonly runId: string,
  ) {}

  async log(message: string, flush = true) {
    this.logger.log(`[sync ${this.runId.slice(0, 8)}] ${message}`);
    this.lines.push({ at: new Date().toISOString(), message });
    if (this.lines.length > MAX_LOG_LINES) this.lines.shift();
    if (flush) await this.flush(true);
  }

  async setPhase(phase: string, force = false) {
    this.phase = phase;
    await this.flush(force);
  }

  async count(counters: RunReporter["counters"]) {
    this.counters = { ...this.counters, ...counters };
    await this.flush(true);
  }

  async finish(status: SyncRunStatus, error?: string) {
    await this.prisma.diseaseSyncRun.update({
      where: { id: this.runId },
      data: {
        ...this.counters,
        status,
        error: error ?? null,
        phase: null,
        finishedAt: new Date(),
        log: this.lines as Prisma.InputJsonArray,
      },
    });
    this.announce(status, null);
  }

  private async flush(force: boolean) {
    if (!force && Date.now() - this.lastFlush < FLUSH_INTERVAL_MS) return;
    this.lastFlush = Date.now();
    await this.prisma.diseaseSyncRun.update({
      where: { id: this.runId },
      data: {
        ...this.counters,
        phase: this.phase,
        log: this.lines as Prisma.InputJsonArray,
      },
    });
    this.announce(SyncRunStatus.RUNNING, this.phase);
  }

  /**
   * Follows the database writes, so the panel sees what a reload would show,
   * at the same pace. The log stays out: the panel fetches it when shown.
   */
  private announce(status: SyncRunStatus, phase: string | null) {
    this.realtime.toAdmins({
      type: "sync.progress",
      data: {
        runId: this.runId,
        status,
        phase,
        fetched: this.counters.fetched ?? null,
        created: this.counters.created ?? null,
        updated: this.counters.updated ?? null,
        missing: this.counters.missing ?? null,
        restored: this.counters.restored ?? null,
      },
    });
  }
}

/**
 * Imports the diseases from Wikipedia into the card catalog.
 *
 * Runs in the background: `start` records the run and returns at once, and the
 * admin panel follows it through the run row (phase, counters, log), and
 * through the `sync.progress` events published at each write. One run
 * at a time per database.
 */
@Injectable()
export class DiseaseSyncService {
  private readonly logger = new Logger(DiseaseSyncService.name);
  private current: Promise<void> | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly source: WikipediaDiseaseSource,
    private readonly ranking: RarityRankingService,
    private readonly settings: GameSettingsService,
    private readonly realtime: RealtimeService,
  ) {}

  /** The Wikipedias the catalog is built from. */
  get wikipediaHosts(): string[] {
    return this.source.locales.map((locale) => this.source.host(locale));
  }

  isRunning(): boolean {
    return this.current !== null;
  }

  /**
   * Marks the runs a previous process left RUNNING as failed. Called once by
   * the server at boot — not by the CLI, which would otherwise kill the
   * server's own run.
   */
  async recoverInterruptedRuns(): Promise<number> {
    const { count } = await this.prisma.diseaseSyncRun.updateMany({
      where: { status: SyncRunStatus.RUNNING },
      data: {
        status: SyncRunStatus.FAILED,
        phase: null,
        finishedAt: new Date(),
        error: "Interrupted: the server stopped during the run",
      },
    });
    if (count > 0) {
      this.logger.warn(`${count} interrupted sync run(s) marked as failed`);
    }
    return count;
  }

  /** Records a run and starts it in the background. */
  async start(
    trigger: SyncTrigger,
    triggeredById?: string,
  ): Promise<DiseaseSyncRun> {
    const run = await this.claim(trigger, triggeredById);
    this.current = this.execute(run.id).finally(() => {
      this.current = null;
    });
    return run;
  }

  /** Same as `start`, but resolves when the run is over. For the CLI. */
  async runToCompletion(trigger: SyncTrigger): Promise<DiseaseSyncRun> {
    const run = await this.claim(trigger);
    await this.execute(run.id);
    return this.prisma.diseaseSyncRun.findUniqueOrThrow({ where: { id: run.id } });
  }

  private async claim(
    trigger: SyncTrigger,
    triggeredById?: string,
  ): Promise<DiseaseSyncRun> {
    if (this.current) {
      throw this.alreadyRunning();
    }

    // Another process (the CLI, a second instance) may own a live run.
    const live = await this.prisma.diseaseSyncRun.findFirst({
      where: {
        status: SyncRunStatus.RUNNING,
        startedAt: { gt: new Date(Date.now() - STALE_RUN_MS) },
      },
    });
    if (live) {
      throw this.alreadyRunning();
    }

    return this.prisma.diseaseSyncRun.create({
      data: {
        trigger,
        triggeredById: triggeredById ?? null,
        phase: "Starting",
      },
    });
  }

  private alreadyRunning() {
    return new AppException(
      ErrorCode.SYNC_ALREADY_RUNNING,
      HttpStatus.CONFLICT,
      "A sync is already running",
    );
  }

  private async execute(runId: string): Promise<void> {
    const report = new RunReporter(this.prisma, this.realtime, this.logger, runId);

    try {
      await this.importDiseases(report);
      await report.log("Sync finished");
      await report.finish(SyncRunStatus.SUCCEEDED);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Sync ${runId} failed: ${message}`);
      await report.log(`Failed: ${message}`, false);
      await report
        .finish(SyncRunStatus.FAILED, message)
        .catch((finishError: unknown) =>
          this.logger.error(`Could not record the failure: ${String(finishError)}`),
        );
    }
  }

  private async importDiseases(report: RunReporter): Promise<void> {
    const settings = await this.settings.get();

    // 1. Which diseases exist, and in which languages.
    await report.setPhase("Querying Wikidata", true);
    await report.log(`Querying Wikidata for diseases on ${this.wikipediaHosts.join(", ")}`);
    const diseases = await this.source.fetchDiseases((message) => report.log(message));
    await report.count({ fetched: diseases.size });
    await report.log(`${diseases.size} diseases found in at least one language`);

    const known = await this.prisma.card.count({ where: { missingSince: null } });
    if (
      known >= MIN_CATALOG_FOR_RATIO_CHECK &&
      diseases.size < known * MIN_FETCH_RATIO
    ) {
      throw new Error(
        `Wikidata returned ${diseases.size} diseases for ${known} known cards: ` +
          "refusing to mark the rest missing. Retry later.",
      );
    }

    let icd10 = new Map<string, string[]>();
    try {
      icd10 = await this.source.fetchIcd10Codes();
      await report.log(`ICD-10 codes found for ${icd10.size} items`);
    } catch (error) {
      // Cosmetic data: the import goes on without it.
      await report.log(`ICD-10 codes skipped: ${String(error)}`);
    }

    // 2. How popular each article is, language by language.
    let entries = [...diseases.values()];
    const metadata = {} as MetadataByLocale;
    for (const locale of LOCALES) {
      const titles = entries.flatMap((entry) => entry.titles[locale] ?? []);
      const label = `Reading ${locale} pageviews`;
      await report.setPhase(`${label} (0/${titles.length})`, true);
      metadata[locale] = await this.source.fetchMetadata(
        locale,
        titles,
        settings.pageviewsWindowDays,
        (done, total) => report.setPhase(`${label} (${done}/${total})`),
      );
      await report.log(`Pageviews read for ${titles.length} ${locale} articles`);
    }

    // Two items reaching the same article through a redirect: each language
    // keeps one of them, and an item left with no article at all is dropped.
    for (const locale of LOCALES) {
      const { dropped } = dedupeByArticle(
        entries
          .filter((entry) => entry.titles[locale])
          .map((entry) => ({ wikidataId: entry.wikidataId, pageTitle: entry.titles[locale]!, entry })),
        (item) => metadata[locale].get(item.pageTitle)?.canonicalTitle ?? item.pageTitle,
      );
      for (const item of dropped) delete item.entry.titles[locale];
      if (dropped.length > 0) {
        await report.log(
          `${dropped.length} ${locale} sitelinks skipped: they redirect to another disease's article`,
        );
      }
    }
    entries = entries.filter((entry) => Object.keys(entry.titles).length > 0);

    // Chinese Wikipedia returns descriptions in whichever script they were
    // written in; Wikidata has them in simplified Chinese.
    const descriptions = new Map<AppLocale, Map<string, string>>();
    for (const locale of LOCALES) {
      if (locale !== "zh") continue;
      const qids = entries.filter((entry) => entry.titles[locale]).map((entry) => entry.wikidataId);
      try {
        descriptions.set(
          locale,
          await this.source.fetchWikidataDescriptions(locale, qids, (done, total) =>
            report.setPhase(`Reading ${locale} descriptions (${done}/${total})`),
          ),
        );
      } catch (error) {
        await report.log(`${locale} descriptions skipped: ${String(error)}`);
      }
    }

    // 3. Write the cards.
    await report.setPhase("Writing cards", true);
    const counters = await this.writeCards(entries, metadata, icd10, descriptions);
    await report.count(counters);
    await report.log(
      `${counters.created} new, ${counters.updated} refreshed, ` +
        `${counters.missing} gone missing, ${counters.restored} found again`,
    );

    // 4. Opening sentences, for the articles that have none yet.
    for (const locale of LOCALES) {
      const needExtract = await this.prisma.cardLocalization.findMany({
        where: { locale, extract: null, card: { missingSince: null } },
        select: { cardId: true, pageTitle: true },
      });
      if (needExtract.length === 0) continue;

      const label = `Reading ${locale} article intros`;
      await report.setPhase(`${label} (0/${needExtract.length})`, true);
      const extracts = await this.source.fetchExtracts(
        locale,
        needExtract.map((text) => text.pageTitle),
        (done, total) => report.setPhase(`${label} (${done}/${total})`),
      );
      const updates = needExtract
        .filter((text) => extracts.has(text.pageTitle))
        .map((text) =>
          this.prisma.cardLocalization.update({
            where: { cardId_locale: { cardId: text.cardId, locale } },
            data: { extract: extracts.get(text.pageTitle) },
          }),
        );
      for (let index = 0; index < updates.length; index += WRITE_CHUNK) {
        await this.prisma.$transaction(updates.slice(index, index + WRITE_CHUNK));
      }
      await report.log(`${updates.length} ${locale} article intros stored`);
    }

    // 5. Popularity → rarity.
    await report.setPhase("Ranking rarities", true);
    const ranking = await this.ranking.recompute();
    await report.log(
      `Rarities recomputed over ${ranking.ranked} cards (${ranking.changed} changed)`,
    );
  }

  private async writeCards(
    entries: DiseaseEntry[],
    metadata: MetadataByLocale,
    icd10: Map<string, string[]>,
    descriptions: Map<AppLocale, Map<string, string>>,
  ) {
    const now = new Date();
    const existing = await this.prisma.card.findMany({
      select: {
        id: true,
        wikidataId: true,
        missingSince: true,
        localizations: { select: { locale: true, pageTitle: true } },
      },
    });
    const byQid = new Map(existing.map((card) => [card.wikidataId, card]));

    /** What each language's article says about the disease. */
    const texts = (entry: DiseaseEntry) =>
      LOCALES.flatMap((locale) => {
        const asked = entry.titles[locale];
        if (!asked) return [];
        const meta = metadata[locale].get(asked);
        const pageTitle = meta?.canonicalTitle ?? asked;
        return [
          {
            locale,
            name: cardNameFromTitle(meta?.displayTitle ?? pageTitle),
            pageTitle,
            wikipediaUrl: this.source.articleUrl(locale, pageTitle),
            description:
              descriptions.get(locale)?.get(entry.wikidataId) ??
              meta?.description ??
              null,
            pageviews: meta?.pageviews ?? 0,
          },
        ];
      });

    const cardFields = (entry: DiseaseEntry, localized: ReturnType<typeof texts>) => ({
      imageUrl:
        IMAGE_SOURCES.map((locale) => {
          const title = entry.titles[locale];
          return title ? metadata[locale].get(title)?.imageUrl : null;
        }).find(Boolean) ?? null,
      icd10: icd10.get(entry.wikidataId) ?? [],
      pageviews: localized.reduce((sum, text) => sum + text.pageviews, 0),
      lastSyncedAt: now,
    });

    // New cards are numbered in order of popularity: on the first import,
    // #1 is the most read disease.
    const fresh = entries
      .filter((entry) => !byQid.has(entry.wikidataId))
      .map((entry) => {
        const localized = texts(entry);
        return { entry, localized, fields: cardFields(entry, localized) };
      })
      .sort(
        (a, b) =>
          b.fields.pageviews - a.fields.pageviews ||
          a.entry.wikidataId.localeCompare(b.entry.wikidataId),
      );

    for (let index = 0; index < fresh.length; index += WRITE_CHUNK) {
      const slice = fresh.slice(index, index + WRITE_CHUNK);
      await this.prisma.card.createMany({
        data: slice.map(({ entry, fields }) => ({ wikidataId: entry.wikidataId, ...fields })),
        skipDuplicates: true,
      });
      const created = await this.prisma.card.findMany({
        where: { wikidataId: { in: slice.map(({ entry }) => entry.wikidataId) } },
        select: { id: true, wikidataId: true },
      });
      const idOf = new Map(created.map((card) => [card.wikidataId, card.id]));
      await this.prisma.cardLocalization.createMany({
        data: slice.flatMap(({ entry, localized }) => {
          const cardId = idOf.get(entry.wikidataId);
          return cardId ? localized.map((text) => ({ cardId, ...text })) : [];
        }),
        skipDuplicates: true,
      });
    }

    let restored = 0;
    let updated = 0;
    const writes: Prisma.PrismaPromise<unknown>[] = [];
    for (const entry of entries) {
      const card = byQid.get(entry.wikidataId);
      if (!card) continue;
      if (card.missingSince) restored += 1;
      updated += 1;

      const localized = texts(entry);
      writes.push(
        this.prisma.card.update({
          where: { id: card.id },
          data: { ...cardFields(entry, localized), missingSince: null },
        }),
      );

      for (const text of localized) {
        const previous = card.localizations.find((row) => row.locale === text.locale);
        writes.push(
          this.prisma.cardLocalization.upsert({
            where: { cardId_locale: { cardId: card.id, locale: text.locale } },
            create: { cardId: card.id, ...text },
            // A renamed article gets its new intro on this run.
            update: {
              ...text,
              ...(previous && previous.pageTitle !== text.pageTitle ? { extract: null } : {}),
            },
          }),
        );
      }

      // A language that lost its article falls back to the others.
      const gone = card.localizations
        .map((row) => row.locale)
        .filter((locale) => !localized.some((text) => text.locale === locale));
      if (gone.length > 0) {
        writes.push(
          this.prisma.cardLocalization.deleteMany({
            where: { cardId: card.id, locale: { in: gone } },
          }),
        );
      }
    }
    for (let index = 0; index < writes.length; index += WRITE_CHUNK) {
      await this.prisma.$transaction(writes.slice(index, index + WRITE_CHUNK));
    }

    const seen = new Set(entries.map((entry) => entry.wikidataId));
    const goneIds = existing
      .filter((card) => !card.missingSince && !seen.has(card.wikidataId))
      .map((card) => card.id);
    for (let index = 0; index < goneIds.length; index += WRITE_CHUNK) {
      await this.prisma.card.updateMany({
        where: { id: { in: goneIds.slice(index, index + WRITE_CHUNK) } },
        data: { missingSince: now },
      });
    }

    return {
      created: fresh.length,
      updated,
      missing: goneIds.length,
      restored,
    };
  }
}
