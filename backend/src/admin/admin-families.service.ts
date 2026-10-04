import { HttpStatus, Injectable } from "@nestjs/common";
import { Prisma, type CardFamily, type User } from "@prisma/client";
import { AuditAction, AuditService } from "../audit/audit.service";
import { CARD_INCLUDE, toCardDto } from "../cards/card-mapper";
import { inIdOrder, nameSearch } from "../cards/localized-order";
import { AppException } from "../common/app.exception";
import { ErrorCode } from "../common/error-code.enum";
import type { AppLocale } from "../common/locale";
import {
  FamiliesService,
  familyDefinition,
  familyName,
  parseNames,
} from "../families/families.service";
import { FamilyMatcherService, type EvaluatedCard } from "../families/family-matcher.service";
import { LOCALIZED_FIELDS, type FamilyDefinition } from "../families/family-rules";
import { PrismaService } from "../prisma/prisma.service";
import { RealtimeService } from "../realtime/realtime.service";
import type {
  AdminFamilyDto,
  FamiliesResolvedDto,
  FamilyCardReason,
  FamilyDefinitionDto,
  FamilyPreviewDto,
  FamilyPreviewResultDto,
  SaveFamilyDto,
} from "./dto/admin-families.dto";

const PREVIEW_PAGE_SIZE = 50;

function reasonOf(card: EvaluatedCard): FamilyCardReason | null {
  const { member, reason } = card.membership;
  if (member) return reason;
  if (reason === "manual") return "excludedByHand";
  if (reason === "excludedByRule") return "excludedByRule";
  return null;
}

/** The DTO as the matcher reads it: the locale only where it means something. */
function toDefinition(dto: FamilyDefinitionDto): FamilyDefinition {
  return {
    match: dto.match,
    rules: dto.rules.map((rule) => ({
      field: rule.field,
      pattern: rule.pattern,
      locale: LOCALIZED_FIELDS.has(rule.field) ? (rule.locale ?? null) : null,
      exclude: rule.exclude === true,
    })),
    includedCardIds: [...new Set(dto.includedCardIds)],
    excludedCardIds: [...new Set(dto.excludedCardIds)],
  };
}

/** Families as the panel edits them: their rules, a live preview, their stats. */
@Injectable()
export class AdminFamiliesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly families: FamiliesService,
    private readonly matcher: FamilyMatcherService,
    private readonly audit: AuditService,
    private readonly realtime: RealtimeService,
  ) {}

  async list(locale: AppLocale): Promise<AdminFamilyDto[]> {
    const families = await this.prisma.cardFamily.findMany({
      orderBy: [{ position: "asc" }, { createdAt: "asc" }],
    });
    return this.withStats(families, locale);
  }

  async detail(id: string, locale: AppLocale): Promise<AdminFamilyDto> {
    const [dto] = await this.withStats([await this.find(id)], locale);
    return dto!;
  }

  /**
   * What `definition` would select, without saving anything: the counts, how
   * each rule fares, and one page of the cards in or out.
   */
  async preview(dto: FamilyPreviewDto, locale: AppLocale): Promise<FamilyPreviewResultDto> {
    const evaluation = await this.matcher.evaluate(toDefinition(dto), locale);
    const view = dto.view ?? "members";
    const page = dto.page ?? 1;
    const pageSize = dto.pageSize ?? PREVIEW_PAGE_SIZE;

    const members = evaluation.cards.filter((card) => card.membership.member);
    const excluded = evaluation.cards.filter(
      (card) => !card.membership.member && card.membership.reason !== "unmatched",
    );

    let listed = (view === "members" ? members : excluded).sort(
      (a, b) => b.pageviews - a.pageviews,
    );
    if (dto.search) {
      const found = await this.prisma.card.findMany({
        where: { AND: [{ id: { in: listed.map((card) => card.cardId) } }, nameSearch(dto.search)] },
        select: { id: true },
      });
      const ids = new Set(found.map((card) => card.id));
      listed = listed.filter((card) => ids.has(card.cardId));
    }

    const window = listed.slice((page - 1) * pageSize, page * pageSize);
    const cards = await this.prisma.card.findMany({
      where: { id: { in: window.map((card) => card.cardId) } },
      include: CARD_INCLUDE,
    });
    const byId = new Map(window.map((card) => [card.cardId, card]));

    return {
      counts: {
        members: members.length,
        droppable: members.filter((card) => card.droppable).length,
        excluded: excluded.length,
      },
      rules: evaluation.rules,
      items: inIdOrder(
        window.map((card) => card.cardId),
        cards,
      ).map((card) => {
        const evaluated = byId.get(card.id)!;
        return {
          ...toCardDto(card, locale),
          wikidataId: card.wikidataId,
          droppable: evaluated.droppable,
          hits: evaluated.hits.flatMap((hit, index) => (hit ? [index] : [])),
          reason: reasonOf(evaluated) ?? "rules",
        };
      }),
      total: listed.length,
      page,
      pageSize,
    };
  }

  async create(actor: User, dto: SaveFamilyDto, locale: AppLocale): Promise<AdminFamilyDto> {
    await this.assertRulesRun(dto);
    const last = await this.prisma.cardFamily.aggregate({ _max: { position: true } });
    const family = await this.prisma.cardFamily.create({
      data: {
        ...this.toData(dto),
        position: dto.position ?? (last._max.position ?? -1) + 1,
      },
    });
    const { members } = await this.families.resolve(family);

    await this.audit.record(actor.id, AuditAction.FamilyCreated, {
      familyId: family.id,
      familyName: familyName(family, "en"),
      members,
    });
    this.realtime.toEveryone({ type: "families.updated", data: {} });
    return this.detail(family.id, locale);
  }

  async update(
    actor: User,
    id: string,
    dto: SaveFamilyDto,
    locale: AppLocale,
  ): Promise<AdminFamilyDto> {
    await this.find(id);
    await this.assertRulesRun(dto);
    const family = await this.prisma.cardFamily.update({
      where: { id },
      data: { ...this.toData(dto), ...(dto.position !== undefined ? { position: dto.position } : {}) },
    });
    const { members } = await this.families.resolve(family);

    await this.audit.record(actor.id, AuditAction.FamilyUpdated, {
      familyId: id,
      familyName: familyName(family, "en"),
      members,
      enabled: family.enabled,
      bonusPoints: family.bonusPoints,
    });
    this.realtime.toEveryone({ type: "families.updated", data: {} });
    return this.detail(id, locale);
  }

  async remove(actor: User, id: string): Promise<{ id: string; removed: boolean }> {
    const family = await this.find(id);
    await this.prisma.cardFamily.delete({ where: { id } });
    await this.audit.record(actor.id, AuditAction.FamilyDeleted, {
      familyId: id,
      familyName: familyName(family, "en"),
    });
    this.realtime.toEveryone({ type: "families.updated", data: {} });
    return { id, removed: true };
  }

  /** Re-runs every family against today's Wikidata, as the sync does. */
  async resolveAll(actor: User): Promise<FamiliesResolvedDto> {
    const result = await this.families.resolveAll({ fresh: true });
    await this.audit.record(actor.id, AuditAction.FamiliesResolved, { ...result });
    this.realtime.toEveryone({ type: "families.updated", data: {} });
    return result;
  }

  /**
   * A family is only saved when every rule runs: a typo in a regex would
   * otherwise silently empty it for every player.
   */
  private async assertRulesRun(dto: FamilyDefinitionDto): Promise<void> {
    const evaluation = await this.matcher.evaluate(toDefinition(dto), "en");
    const errors = evaluation.rules
      .map((rule, index) => (rule.error ? `rule ${index + 1}: ${rule.error}` : null))
      .filter(Boolean);
    if (errors.length > 0) {
      throw new AppException(
        ErrorCode.INVALID_FAMILY_RULE,
        HttpStatus.BAD_REQUEST,
        `Invalid family rules (${errors.join("; ")})`,
      );
    }
  }

  private toData(dto: SaveFamilyDto) {
    const definition = toDefinition(dto);
    return {
      names: parseNames(dto.names) as Prisma.InputJsonObject,
      icon: dto.icon || null,
      bonusPoints: dto.bonusPoints,
      enabled: dto.enabled,
      match: definition.match,
      rules: definition.rules as unknown as Prisma.InputJsonArray,
      includedCardIds: definition.includedCardIds,
      excludedCardIds: definition.excludedCardIds,
    };
  }

  private async withStats(families: CardFamily[], locale: AppLocale): Promise<AdminFamilyDto[]> {
    if (families.length === 0) return [];
    const ids = families.map((family) => family.id);
    const [counts, completions] = await Promise.all([
      this.prisma.$queryRaw<Array<{ familyId: string; members: number; droppable: number }>>`
        SELECT m.family_id AS "familyId",
               COUNT(*)::int AS "members",
               (COUNT(*) FILTER (WHERE c.enabled AND c.missing_since IS NULL))::int AS "droppable"
        FROM card_family_members m
        JOIN cards c ON c.id = m.card_id
        WHERE m.family_id = ANY(${ids}::text[])
        GROUP BY m.family_id
      `,
      // Who completed what, whatever `enabled` says: the panel shows it for a
      // hidden family too. Same rule as the bonus otherwise.
      this.prisma.$queryRaw<Array<{ familyId: string; players: number }>>`
        SELECT o.family_id AS "familyId", COUNT(*)::int AS "players"
        FROM (
          SELECT uc.user_id, m.family_id, COUNT(*) AS owned
          FROM user_cards uc
          JOIN card_family_members m ON m.card_id = uc.card_id
          JOIN cards c ON c.id = uc.card_id AND c.enabled AND c.missing_since IS NULL
          WHERE m.family_id = ANY(${ids}::text[])
          GROUP BY uc.user_id, m.family_id
        ) o
        JOIN (
          SELECT m.family_id, COUNT(*) AS total
          FROM card_family_members m
          JOIN cards c ON c.id = m.card_id AND c.enabled AND c.missing_since IS NULL
          GROUP BY m.family_id
        ) t ON t.family_id = o.family_id AND t.total = o.owned
        GROUP BY o.family_id
      `,
    ]);
    const countOf = new Map(counts.map((row) => [row.familyId, row]));
    const completionsOf = new Map(completions.map((row) => [row.familyId, row.players]));

    return families.map((family) => {
      const definition = familyDefinition(family);
      return {
        id: family.id,
        name: familyName(family, locale),
        names: { en: "", ...parseNames(family.names) },
        icon: family.icon,
        bonusPoints: family.bonusPoints,
        enabled: family.enabled,
        position: family.position,
        match: definition.match,
        rules: definition.rules,
        includedCardIds: definition.includedCardIds,
        excludedCardIds: definition.excludedCardIds,
        members: countOf.get(family.id)?.members ?? 0,
        droppable: countOf.get(family.id)?.droppable ?? 0,
        completions: completionsOf.get(family.id) ?? 0,
        resolvedAt: family.resolvedAt?.toISOString() ?? null,
        resolveError: family.resolveError,
        updatedAt: family.updatedAt.toISOString(),
      };
    });
  }

  private async find(id: string): Promise<CardFamily> {
    const family = await this.prisma.cardFamily.findUnique({ where: { id } });
    if (!family) {
      throw new AppException(ErrorCode.FAMILY_NOT_FOUND, HttpStatus.NOT_FOUND, "Family not found");
    }
    return family;
  }
}
