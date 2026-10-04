import type { AppLocale } from "../common/locale";

/**
 * What a family rule looks at.
 *
 * - `name`, `title`, `description`, `extract`: the card's text, in one
 *   language or in any of them;
 * - `icd10`: any of the card's ICD-10 codes (only about a quarter of the
 *   catalog has one);
 * - `wikidataId`: the item's QID;
 * - `wikidataClass`: the item is, at any depth, a subclass (or an instance of
 *   a subclass) of one of the QIDs listed in `pattern`. The only rule that is
 *   not a regex: Wikidata's own classification, asked of the Query Service.
 */
export const FAMILY_RULE_FIELDS = [
  "name",
  "title",
  "description",
  "extract",
  "icd10",
  "wikidataId",
  "wikidataClass",
] as const;
export type FamilyRuleField = (typeof FAMILY_RULE_FIELDS)[number];

/** The fields that exist once per language, and can be narrowed to one. */
export const LOCALIZED_FIELDS: ReadonlySet<FamilyRuleField> = new Set([
  "name",
  "title",
  "description",
  "extract",
]);

export const FAMILY_MATCHES = ["any", "all"] as const;
export type FamilyMatch = (typeof FAMILY_MATCHES)[number];

export interface FamilyRule {
  field: FamilyRuleField;
  pattern: string;
  /** Only for the localized fields; absent means any language. */
  locale?: AppLocale | null;
  /** A card matching an exclude rule is out, whatever the include rules say. */
  exclude?: boolean;
}

/** Everything that decides who is in a family. */
export interface FamilyDefinition {
  match: FamilyMatch;
  rules: FamilyRule[];
  includedCardIds: string[];
  excludedCardIds: string[];
}

export const MAX_FAMILY_RULES = 20;
export const MAX_PATTERN_LENGTH = 500;

/** Reads the `rules` JSON column, dropping whatever is not a rule. */
export function parseRules(value: unknown): FamilyRule[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((raw): FamilyRule[] => {
    if (!raw || typeof raw !== "object") return [];
    const rule = raw as Record<string, unknown>;
    if (!FAMILY_RULE_FIELDS.includes(rule.field as FamilyRuleField)) return [];
    if (typeof rule.pattern !== "string") return [];
    return [
      {
        field: rule.field as FamilyRuleField,
        pattern: rule.pattern,
        locale: (rule.locale as AppLocale | null | undefined) ?? null,
        exclude: rule.exclude === true,
      },
    ];
  });
}

/**
 * The regex as PostgreSQL runs it. Admins write JavaScript-style regexes,
 * where `\b` is a word boundary; in PostgreSQL it is a backspace, and the word
 * boundary is `\y`. An escaped backslash (`\\b`) is left alone.
 */
export function toPostgresRegex(pattern: string): string {
  return pattern.replace(/\\(\\|b|B)/g, (escape, next: string) =>
    next === "b" ? "\\y" : next === "B" ? "\\Y" : escape,
  );
}

const QID = /^Q[1-9]\d*$/;

/**
 * The QIDs of a `wikidataClass` rule: `Q12078`, `Q12078 Q18556617` or
 * `Q12078, Q18556617`. Null when one of them is not a QID.
 */
export function parseQids(pattern: string): string[] | null {
  const parts = pattern
    .split(/[\s,;|]+/)
    .map((part) => part.trim().toUpperCase())
    .filter(Boolean);
  if (parts.length === 0 || !parts.every((part) => QID.test(part))) return null;
  return [...new Set(parts)];
}

/** One card as the matcher saw it: which rules it matched. */
export interface RuleHits {
  cardId: string;
  /** `hits[i]` is whether rule `i` matched. */
  hits: boolean[];
}

export type Membership =
  | { member: true; reason: "rules" | "manual" }
  | { member: false; reason: "excludedByRule" | "manual" | "unmatched" };

/**
 * Whether a card is in the family. The admin's hand-picked choices come
 * first, then the exclude rules, then the include rules.
 */
export function membership(
  definition: FamilyDefinition,
  card: RuleHits,
): Membership {
  if (definition.excludedCardIds.includes(card.cardId)) {
    return { member: false, reason: "manual" };
  }
  if (definition.includedCardIds.includes(card.cardId)) {
    return { member: true, reason: "manual" };
  }

  const includes: boolean[] = [];
  let excluded = false;
  definition.rules.forEach((rule, index) => {
    const hit = card.hits[index] === true;
    if (rule.exclude) excluded ||= hit;
    else includes.push(hit);
  });

  const matched =
    includes.length > 0 &&
    (definition.match === "all" ? includes.every(Boolean) : includes.some(Boolean));
  if (!matched) return { member: false, reason: "unmatched" };
  if (excluded) return { member: false, reason: "excludedByRule" };
  return { member: true, reason: "rules" };
}
