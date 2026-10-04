import { Injectable, Logger } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import type { AppLocale } from "../common/locale";
import { PrismaService } from "../prisma/prisma.service";
import { WikipediaDiseaseSource } from "../wikipedia/wikipedia-disease.source";
import {
  LOCALIZED_FIELDS,
  membership,
  parseQids,
  toPostgresRegex,
  type FamilyDefinition,
  type FamilyRule,
  type Membership,
} from "./family-rules";

/** A class's members change with Wikidata edits, not by the minute. */
const CLASS_CACHE_MS = 30 * 60_000;
/** Labels only help the admin read a QID: never worth holding a preview for. */
const LABEL_TIMEOUT_MS = 3_000;
/** A regex is the admin's, but a pathological one must not hold a connection. */
const STATEMENT_TIMEOUT_MS = 5_000;

const LOCALIZED_COLUMNS: Record<string, Prisma.Sql> = {
  name: Prisma.raw("l.name"),
  title: Prisma.raw("l.page_title"),
  description: Prisma.raw("l.description"),
  extract: Prisma.raw("l.extract"),
};

/** How one rule fared: what it matches alone, or why it could not run. */
export interface RuleCheck {
  matches: number;
  error: string | null;
  /** For a `wikidataClass` rule, the classes' labels, to check the QIDs. */
  labels: string[];
}

export interface EvaluatedCard {
  cardId: string;
  pageviews: number;
  droppable: boolean;
  hits: boolean[];
  membership: Membership;
}

export interface Evaluation {
  /** Every card some rule matched or the admin picked, member or not. */
  cards: EvaluatedCard[];
  rules: RuleCheck[];
  valid: boolean;
}

/**
 * Turns a family's rules into cards. The regexes run in PostgreSQL, over
 * every language of every card at once; `wikidataClass` rules are asked of
 * the Wikidata Query Service and kept a while, so that a live preview does
 * not query it on every keystroke.
 */
@Injectable()
export class FamilyMatcherService {
  private readonly logger = new Logger(FamilyMatcherService.name);
  private readonly classes = new Map<string, { at: number; members: Promise<Set<string>> }>();
  /** `locale:qid` → label. Labels hardly ever change. */
  private readonly labels = new Map<string, string>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly source: WikipediaDiseaseSource,
  ) {}

  /**
   * Runs `definition` over the catalog. A rule that cannot run is reported
   * and matches nothing, so the preview still shows what the others do.
   *
   * `fresh` bypasses the class cache: the sync wants today's Wikidata.
   */
  async evaluate(
    definition: FamilyDefinition,
    locale: AppLocale,
    { fresh = false }: { fresh?: boolean } = {},
  ): Promise<Evaluation> {
    const checks: RuleCheck[] = [];
    const expressions: Prisma.Sql[] = [];

    for (const rule of definition.rules) {
      const prepared = await this.prepare(rule, locale, fresh);
      checks.push({ matches: 0, error: prepared.error, labels: prepared.labels });
      expressions.push(prepared.sql ?? Prisma.sql`FALSE`);
    }

    const picked = [...definition.includedCardIds, ...definition.excludedCardIds];
    const anyRule =
      expressions.length > 0 ? Prisma.join(expressions, " OR ") : Prisma.sql`FALSE`;
    const hits =
      expressions.length > 0
        ? Prisma.sql`ARRAY[${Prisma.join(expressions)}]::boolean[]`
        : Prisma.sql`ARRAY[]::boolean[]`;

    const rows = await this.prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`SET LOCAL statement_timeout = ${STATEMENT_TIMEOUT_MS}`);
      return tx.$queryRaw<
        Array<{ cardId: string; pageviews: number; droppable: boolean; hits: boolean[] }>
      >`
        SELECT c.id AS "cardId",
               c.pageviews,
               (c.enabled AND c.missing_since IS NULL) AS "droppable",
               ${hits} AS "hits"
        FROM cards c
        WHERE (${anyRule}) OR c.id = ANY(${picked}::text[])
      `;
    });

    const cards = rows.map((row) => ({
      ...row,
      membership: membership(definition, row),
    }));
    for (const card of cards) {
      card.hits.forEach((hit, index) => {
        if (hit && checks[index]) checks[index].matches += 1;
      });
    }

    return { cards, rules: checks, valid: checks.every((check) => !check.error) };
  }

  /** The SQL test for one rule, or why there is none. */
  private async prepare(
    rule: FamilyRule,
    locale: AppLocale,
    fresh: boolean,
  ): Promise<{ sql: Prisma.Sql | null; error: string | null; labels: string[] }> {
    const fail = (error: string) => ({ sql: null, error, labels: [] });

    if (rule.field === "wikidataClass") {
      const qids = parseQids(rule.pattern);
      if (!qids) return fail("Expected one or more QIDs, such as Q12078");
      try {
        const [members, labels] = await Promise.all([
          Promise.all(qids.map((qid) => this.classMembers(qid, fresh))),
          this.classLabels(locale, qids),
        ]);
        const ids = [...new Set(members.flatMap((set) => [...set]))];
        return {
          sql: Prisma.sql`c.wikidata_id = ANY(${ids}::text[])`,
          error: null,
          labels,
        };
      } catch (error) {
        return fail(`Wikidata did not answer: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    if (!rule.pattern.trim()) return fail("Empty pattern");
    const regex = toPostgresRegex(rule.pattern);
    const invalid = await this.regexError(regex);
    if (invalid) return fail(invalid);

    if (LOCALIZED_FIELDS.has(rule.field)) {
      const column = LOCALIZED_COLUMNS[rule.field];
      const inLocale = rule.locale
        ? Prisma.sql`AND l.locale = ${rule.locale}::"Locale"`
        : Prisma.empty;
      return {
        sql: Prisma.sql`EXISTS (SELECT 1 FROM card_localizations l WHERE l.card_id = c.id ${inLocale} AND ${column} ~* ${regex})`,
        error: null,
        labels: [],
      };
    }
    if (rule.field === "icd10") {
      return {
        sql: Prisma.sql`EXISTS (SELECT 1 FROM unnest(c.icd10) AS code WHERE code ~* ${regex})`,
        error: null,
        labels: [],
      };
    }
    return { sql: Prisma.sql`c.wikidata_id ~* ${regex}`, error: null, labels: [] };
  }

  /** PostgreSQL's own complaint about `regex`, or null when it compiles. */
  private async regexError(regex: string): Promise<string | null> {
    try {
      await this.prisma.$queryRaw`SELECT '' ~* ${regex} AS "ok"`;
      return null;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      // The driver wraps the server's message; keep the server's part.
      const reason = /invalid regular expression:?\s*([^\n"`]+)/i.exec(message)?.[1];
      return reason ? `Invalid regex: ${reason.trim()}` : "Invalid regex";
    }
  }

  /** The classes' labels, or their QIDs for those Wikidata did not give in time. */
  private async classLabels(locale: AppLocale, qids: string[]): Promise<string[]> {
    const missing = qids.filter((qid) => !this.labels.has(`${locale}:${qid}`));
    if (missing.length > 0) {
      const fetched = await Promise.race([
        this.source.fetchLabels(locale, missing).catch(() => new Map<string, string>()),
        new Promise<Map<string, string>>((resolve) =>
          setTimeout(() => resolve(new Map()), LABEL_TIMEOUT_MS).unref(),
        ),
      ]);
      for (const [qid, label] of fetched) this.labels.set(`${locale}:${qid}`, label);
    }
    return qids.map((qid) => this.labels.get(`${locale}:${qid}`) ?? qid);
  }

  private classMembers(qid: string, fresh: boolean): Promise<Set<string>> {
    const cached = this.classes.get(qid);
    if (cached && !fresh && Date.now() - cached.at < CLASS_CACHE_MS) {
      return cached.members;
    }
    const members = this.source.fetchClassMembers(qid);
    this.classes.set(qid, { at: Date.now(), members });
    // A failure is not worth remembering: the next keystroke tries again.
    members.catch((error) => {
      this.logger.warn(`Wikidata class ${qid}: ${String(error)}`);
      if (this.classes.get(qid)?.members === members) this.classes.delete(qid);
    });
    return members;
  }
}
