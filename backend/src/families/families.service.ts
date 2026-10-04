import { Injectable, Logger } from "@nestjs/common";
import { Prisma, type CardFamily } from "@prisma/client";
import { FALLBACK_LOCALE, fallbackChain, LOCALES, type AppLocale } from "../common/locale";
import { PrismaService } from "../prisma/prisma.service";
import { FamilyMatcherService, type Evaluation } from "./family-matcher.service";
import { parseRules, type FamilyDefinition, type FamilyMatch } from "./family-rules";

export type FamilyNames = Partial<Record<AppLocale, string>>;

/** What a player is shown of a family. */
export interface FamilyBrief {
  id: string;
  name: string;
  icon: string | null;
  bonusPoints: number;
}

export interface FamilyProgress extends FamilyBrief {
  /** Droppable members owned. */
  owned: number;
  /** Droppable members: what completing the family takes. */
  total: number;
  completed: boolean;
}

/** Inserted per statement when the members of a family are rewritten. */
const MEMBER_CHUNK = 5_000;

/**
 * Per player, the bonus points and the number of families completed: every
 * droppable member owned. A member that can no longer drop is not asked for,
 * as for the catalog completion, and a family without one cannot be
 * completed. Narrowed to one player when `userId` is given.
 */
export function familyBonusSql(userId?: string): Prisma.Sql {
  const onlyUser = userId ? Prisma.sql`AND uc.user_id = ${userId}` : Prisma.empty;
  return Prisma.sql`
    SELECT o.user_id,
           SUM(f.bonus_points)::int AS "bonus",
           COUNT(*)::int AS "completed"
    FROM (
      SELECT uc.user_id, m.family_id, COUNT(*) AS owned
      FROM user_cards uc
      JOIN card_family_members m ON m.card_id = uc.card_id
      JOIN cards c ON c.id = uc.card_id AND c.enabled AND c.missing_since IS NULL
      WHERE TRUE ${onlyUser}
      GROUP BY uc.user_id, m.family_id
    ) o
    JOIN (
      SELECT m.family_id, COUNT(*) AS total
      FROM card_family_members m
      JOIN cards c ON c.id = m.card_id AND c.enabled AND c.missing_since IS NULL
      GROUP BY m.family_id
    ) t ON t.family_id = o.family_id AND t.total = o.owned
    JOIN card_families f ON f.id = o.family_id AND f.enabled
    GROUP BY o.user_id
  `;
}

/** Reads the `names` JSON column. */
export function parseNames(value: unknown): FamilyNames {
  if (!value || typeof value !== "object") return {};
  const names: FamilyNames = {};
  for (const locale of LOCALES) {
    const name = (value as Record<string, unknown>)[locale];
    if (typeof name === "string" && name.trim()) names[locale] = name.trim();
  }
  return names;
}

/** The family's name in `locale`, or in the first language of the fallback chain that has one. */
export function familyName(family: Pick<CardFamily, "names">, locale: AppLocale): string {
  const names = parseNames(family.names);
  for (const candidate of fallbackChain(locale)) {
    if (names[candidate]) return names[candidate];
  }
  return "?";
}

export function familyDefinition(family: CardFamily): FamilyDefinition {
  return {
    match: (family.match === "all" ? "all" : "any") as FamilyMatch,
    rules: parseRules(family.rules),
    includedCardIds: family.includedCardIds,
    excludedCardIds: family.excludedCardIds,
  };
}

/**
 * Families: their members, kept in `card_family_members`, and what each
 * player has collected of them.
 */
@Injectable()
export class FamiliesService {
  private readonly logger = new Logger(FamiliesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly matcher: FamilyMatcherService,
  ) {}

  /**
   * Rewrites a family's members from its rules. When a rule cannot run —
   * Wikidata down, most likely — the members are left as they were rather
   * than emptied, and the reason is kept on the family.
   */
  async resolve(
    family: CardFamily,
    { fresh = false }: { fresh?: boolean } = {},
  ): Promise<{ members: number; error: string | null; evaluation: Evaluation }> {
    const evaluation = await this.matcher.evaluate(familyDefinition(family), FALLBACK_LOCALE, {
      fresh,
    });
    const now = new Date();

    if (!evaluation.valid) {
      const error = evaluation.rules
        .map((rule, index) => (rule.error ? `Rule ${index + 1}: ${rule.error}` : null))
        .filter(Boolean)
        .join("; ");
      await this.prisma.cardFamily.update({
        where: { id: family.id },
        data: { resolveError: error },
      });
      const members = await this.prisma.cardFamilyMember.count({ where: { familyId: family.id } });
      return { members, error, evaluation };
    }

    const ids = evaluation.cards.filter((card) => card.membership.member).map((card) => card.cardId);
    await this.prisma.$transaction(async (tx) => {
      await tx.cardFamilyMember.deleteMany({ where: { familyId: family.id } });
      for (let index = 0; index < ids.length; index += MEMBER_CHUNK) {
        await tx.cardFamilyMember.createMany({
          data: ids.slice(index, index + MEMBER_CHUNK).map((cardId) => ({
            familyId: family.id,
            cardId,
          })),
          skipDuplicates: true,
        });
      }
      await tx.cardFamily.update({
        where: { id: family.id },
        data: { resolvedAt: now, resolveError: null },
      });
    });
    return { members: ids.length, error: null, evaluation };
  }

  /** Every family, one after the other: after a sync, new cards may belong. */
  async resolveAll({ fresh = false }: { fresh?: boolean } = {}): Promise<{
    resolved: number;
    failed: number;
  }> {
    const families = await this.prisma.cardFamily.findMany({ orderBy: { position: "asc" } });
    let failed = 0;
    for (const family of families) {
      try {
        const result = await this.resolve(family, { fresh });
        if (result.error) failed += 1;
      } catch (error) {
        failed += 1;
        this.logger.warn(`Family ${family.id} not resolved: ${String(error)}`);
      }
    }
    return { resolved: families.length - failed, failed };
  }

  /** The player's progress in every enabled family, in the panel's order. */
  async progress(userId: string, locale: AppLocale): Promise<FamilyProgress[]> {
    const [families, counts] = await Promise.all([
      this.prisma.cardFamily.findMany({
        where: { enabled: true },
        orderBy: [{ position: "asc" }, { createdAt: "asc" }],
      }),
      this.prisma.$queryRaw<Array<{ familyId: string; total: number; owned: number }>>`
        SELECT m.family_id AS "familyId",
               COUNT(*)::int AS "total",
               COUNT(uc.card_id)::int AS "owned"
        FROM card_family_members m
        JOIN cards c ON c.id = m.card_id AND c.enabled AND c.missing_since IS NULL
        LEFT JOIN user_cards uc ON uc.card_id = m.card_id AND uc.user_id = ${userId}
        GROUP BY m.family_id
      `,
    ]);
    const byFamily = new Map(counts.map((row) => [row.familyId, row]));

    return families.map((family) => {
      const count = byFamily.get(family.id);
      const total = count?.total ?? 0;
      const owned = count?.owned ?? 0;
      return {
        ...this.brief(family, locale),
        owned,
        total,
        completed: total > 0 && owned >= total,
      };
    });
  }

  /** Bonus points the player has earned, and from how many families. */
  async bonus(userId: string): Promise<{ points: number; completed: number }> {
    const [row] = await this.prisma.$queryRaw<Array<{ bonus: number; completed: number }>>(
      familyBonusSql(userId),
    );
    return { points: row?.bonus ?? 0, completed: row?.completed ?? 0 };
  }

  /**
   * The families the player has completed among those holding one of
   * `cardIds`: after a pack, those that its new cards just completed.
   */
  async completedWith(
    userId: string,
    cardIds: string[],
    locale: AppLocale,
  ): Promise<FamilyBrief[]> {
    if (cardIds.length === 0) return [];
    const touched = await this.prisma.cardFamilyMember.findMany({
      where: { cardId: { in: cardIds }, family: { enabled: true } },
      select: { familyId: true },
      distinct: ["familyId"],
    });
    if (touched.length === 0) return [];
    const ids = new Set(touched.map((row) => row.familyId));
    return (await this.progress(userId, locale))
      .filter((family) => ids.has(family.id) && family.completed)
      .map(({ id, name, icon, bonusPoints }) => ({ id, name, icon, bonusPoints }));
  }

  /** The enabled families a card belongs to. */
  async familiesOf(cardId: string, locale: AppLocale): Promise<FamilyBrief[]> {
    const rows = await this.prisma.cardFamilyMember.findMany({
      where: { cardId, family: { enabled: true } },
      include: { family: true },
      orderBy: { family: { position: "asc" } },
    });
    return rows.map((row) => this.brief(row.family, locale));
  }

  brief(family: CardFamily, locale: AppLocale): FamilyBrief {
    return {
      id: family.id,
      name: familyName(family, locale),
      icon: family.icon,
      bonusPoints: family.bonusPoints,
    };
  }
}
