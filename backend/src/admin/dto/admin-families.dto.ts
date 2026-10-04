import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Transform, Type } from "class-transformer";
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateIf,
  ValidateNested,
} from "class-validator";
import { CardDto } from "../../cards/dto/card.dto";
import { LOCALES, type AppLocale } from "../../common/locale";
import {
  FAMILY_MATCHES,
  FAMILY_RULE_FIELDS,
  MAX_FAMILY_RULES,
  MAX_PATTERN_LENGTH,
  type FamilyMatch,
  type FamilyRuleField,
} from "../../families/family-rules";

/** Cards an admin can pick by hand in one family, in or out. */
const MAX_PICKED_CARDS = 2_000;

const trim = ({ value }: { value: unknown }) =>
  typeof value === "string" ? value.trim() : value;

export class FamilyNamesDto {
  @ApiProperty({ example: "Cancers", description: "Required: the fallback of the other languages." })
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  @Transform(trim)
  en!: string;

  @ApiPropertyOptional({ example: "Cancers" })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  @Transform(trim)
  fr?: string;

  @ApiPropertyOptional({ example: "癌症" })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  @Transform(trim)
  zh?: string;
}

export class FamilyRuleDto {
  @ApiProperty({
    enum: FAMILY_RULE_FIELDS,
    description: [
      "What the rule looks at. `name`, `title`, `description` and `extract` are the card's text (in `locale`, or in any language);",
      "`icd10` any of its ICD-10 codes; `wikidataId` its QID;",
      "`wikidataClass` takes QIDs instead of a regex and matches every subclass of them, at any depth, in Wikidata.",
    ].join(" "),
  })
  @IsIn(FAMILY_RULE_FIELDS)
  field!: FamilyRuleField;

  @ApiProperty({
    example: "\\bcancer|carcinom",
    description:
      "A case-insensitive regex (PostgreSQL flavour; `\\b` is read as a word boundary), or the QIDs of a `wikidataClass` rule.",
  })
  @IsString()
  @MaxLength(MAX_PATTERN_LENGTH)
  pattern!: string;

  @ApiPropertyOptional({
    enum: LOCALES,
    enumName: "Locale",
    nullable: true,
    description: "Narrows a text rule to one language. Ignored by the other fields.",
  })
  @IsOptional()
  @ValidateIf((_object, value) => value !== null)
  @IsIn(LOCALES)
  locale?: AppLocale | null;

  @ApiPropertyOptional({ description: "A card this rule matches is out of the family." })
  @IsOptional()
  @IsBoolean()
  exclude?: boolean;
}

/** Who is in a family: what the live preview and the saved family share. */
export class FamilyDefinitionDto {
  @ApiProperty({
    enum: FAMILY_MATCHES,
    description: "`any`: one include rule is enough; `all`: a card must match every include rule.",
  })
  @IsIn(FAMILY_MATCHES)
  match!: FamilyMatch;

  @ApiProperty({ type: [FamilyRuleDto] })
  @IsArray()
  @ArrayMaxSize(MAX_FAMILY_RULES)
  @ValidateNested({ each: true })
  @Type(() => FamilyRuleDto)
  rules!: FamilyRuleDto[];

  @ApiProperty({ type: [String], description: "Cards put in by hand, whatever the rules say." })
  @IsArray()
  @ArrayMaxSize(MAX_PICKED_CARDS)
  @IsUUID("all", { each: true })
  includedCardIds!: string[];

  @ApiProperty({ type: [String], description: "Cards taken out by hand. Wins over everything." })
  @IsArray()
  @ArrayMaxSize(MAX_PICKED_CARDS)
  @IsUUID("all", { each: true })
  excludedCardIds!: string[];
}

export class SaveFamilyDto extends FamilyDefinitionDto {
  @ApiProperty({ type: FamilyNamesDto })
  @ValidateNested()
  @Type(() => FamilyNamesDto)
  names!: FamilyNamesDto;

  @ApiPropertyOptional({ nullable: true, type: String, example: "🦀", description: "An emoji." })
  @IsOptional()
  @ValidateIf((_object, value) => value !== null)
  @IsString()
  @MaxLength(16)
  @Transform(trim)
  icon?: string | null;

  @ApiProperty({ minimum: 0, maximum: 1_000_000, example: 500 })
  @IsInt()
  @Min(0)
  @Max(1_000_000)
  bonusPoints!: number;

  @ApiProperty()
  @IsBoolean()
  enabled!: boolean;

  @ApiPropertyOptional({ description: "Order in the lists, smallest first." })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10_000)
  position?: number;
}

export const FAMILY_PREVIEW_VIEWS = ["members", "excluded"] as const;
export type FamilyPreviewView = (typeof FAMILY_PREVIEW_VIEWS)[number];

export class FamilyPreviewDto extends FamilyDefinitionDto {
  @ApiPropertyOptional({
    enum: FAMILY_PREVIEW_VIEWS,
    default: "members",
    description: "`excluded`: the cards the include rules match but an exclude rule or the admin took out.",
  })
  @IsOptional()
  @IsIn(FAMILY_PREVIEW_VIEWS)
  view?: FamilyPreviewView;

  @ApiPropertyOptional({ description: "Narrows the listed cards by name, in any language." })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  @Transform(trim)
  search?: string;

  @ApiPropertyOptional({ minimum: 1, default: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: 100, default: 50 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number;
}

export class RuleCheckDto {
  @ApiProperty({ description: "Cards this rule matches on its own." })
  matches!: number;

  @ApiProperty({ nullable: true, type: String, description: "Why the rule cannot run; it then matches nothing." })
  error!: string | null;

  @ApiProperty({ type: [String], description: "For a `wikidataClass` rule, the labels of its classes." })
  labels!: string[];
}

export const FAMILY_CARD_REASONS = [
  "rules",
  "manual",
  "excludedByRule",
  "excludedByHand",
] as const;
export type FamilyCardReason = (typeof FAMILY_CARD_REASONS)[number];

export class FamilyPreviewCardDto extends CardDto {
  @ApiProperty({ example: "Q12078" })
  wikidataId!: string;

  @ApiProperty({ description: "Can drop: only droppable members count towards completing the family." })
  droppable!: boolean;

  @ApiProperty({ type: [Number], description: "Indexes of the rules this card matches." })
  hits!: number[];

  @ApiProperty({
    enum: FAMILY_CARD_REASONS,
    description: "Why the card is in, or out: `manual` and `excludedByHand` are the admin's own picks.",
  })
  reason!: FamilyCardReason;
}

export class FamilyPreviewCountsDto {
  @ApiProperty() members!: number;
  @ApiProperty({ description: "Members that can drop: what completing the family takes." }) droppable!: number;
  @ApiProperty({ description: "Matched, then taken out by an exclude rule or by hand." }) excluded!: number;
}

export class FamilyPreviewResultDto {
  @ApiProperty({ type: FamilyPreviewCountsDto }) counts!: FamilyPreviewCountsDto;
  @ApiProperty({ type: [RuleCheckDto], description: "One per rule, in order." }) rules!: RuleCheckDto[];
  @ApiProperty({ type: [FamilyPreviewCardDto] }) items!: FamilyPreviewCardDto[];
  @ApiProperty({ description: "Cards in the current view, after `search`." }) total!: number;
  @ApiProperty() page!: number;
  @ApiProperty() pageSize!: number;
}

export class AdminFamilyDto {
  @ApiProperty({ format: "uuid" }) id!: string;
  @ApiProperty({ description: "In the panel's language." }) name!: string;
  @ApiProperty({ type: FamilyNamesDto }) names!: FamilyNamesDto;
  @ApiProperty({ nullable: true, type: String }) icon!: string | null;
  @ApiProperty() bonusPoints!: number;
  @ApiProperty() enabled!: boolean;
  @ApiProperty() position!: number;
  @ApiProperty({ enum: FAMILY_MATCHES }) match!: FamilyMatch;
  @ApiProperty({ type: [FamilyRuleDto] }) rules!: FamilyRuleDto[];
  @ApiProperty({ type: [String] }) includedCardIds!: string[];
  @ApiProperty({ type: [String] }) excludedCardIds!: string[];
  @ApiProperty() members!: number;
  @ApiProperty({ description: "Members that can drop." }) droppable!: number;
  @ApiProperty({ description: "Players owning every droppable member." }) completions!: number;
  @ApiProperty({ nullable: true, type: String, format: "date-time" }) resolvedAt!: string | null;
  @ApiProperty({
    nullable: true,
    type: String,
    description: "Why the last resolution failed; the members are then those of the one before.",
  })
  resolveError!: string | null;
  @ApiProperty({ format: "date-time" }) updatedAt!: string;
}

export class FamiliesResolvedDto {
  @ApiProperty() resolved!: number;
  @ApiProperty({ description: "Families whose rules could not run: their members were kept." }) failed!: number;
}
