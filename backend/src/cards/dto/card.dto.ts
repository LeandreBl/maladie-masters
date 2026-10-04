import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Rarity } from "@prisma/client";
import { Transform, Type } from "class-transformer";
import {
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from "class-validator";
import { LOCALES, type AppLocale } from "../../common/locale";
import { PageQueryDto } from "../../common/pagination";
import { LocaleQueryDto } from "../../common/request-locale.decorator";

export class CardDto {
  @ApiProperty({ format: "uuid" })
  id!: string;

  @ApiProperty({ description: "Collector number, in order of discovery.", example: 42 })
  number!: number;

  @ApiProperty({ example: "Grippe", description: "In `lang`." })
  name!: string;

  @ApiProperty({ nullable: true, type: String, example: "maladie infectieuse", description: "In `lang`." })
  description!: string | null;

  @ApiProperty({ nullable: true, type: String, description: "Thumbnail served by Wikimedia." })
  imageUrl!: string | null;

  @ApiProperty({ enum: Rarity, enumName: "Rarity" })
  rarity!: Rarity;

  @ApiProperty({ description: "Article views over the sync window (60 days by default)." })
  pageviews!: number;

  @ApiProperty({ nullable: true, type: Number, description: "1 is the most viewed disease." })
  popularityRank!: number | null;

  @ApiProperty({ example: "https://fr.wikipedia.org/wiki/Grippe", description: "The article in `lang`." })
  wikipediaUrl!: string;

  @ApiProperty({
    enum: LOCALES,
    enumName: "Locale",
    description:
      "Language the name, description and article are in. Differs from the one asked for when the disease has no article in it: English first, then any other.",
  })
  lang!: AppLocale;
}

export class FamilyBriefDto {
  @ApiProperty({ format: "uuid" })
  id!: string;

  @ApiProperty({ example: "Cancers", description: "In the caller's language, English when it has none." })
  name!: string;

  @ApiProperty({ nullable: true, type: String, example: "🦀", description: "An emoji." })
  icon!: string | null;

  @ApiProperty({ description: "Added to the score once every droppable member is owned." })
  bonusPoints!: number;
}

export class FamilyProgressDto extends FamilyBriefDto {
  @ApiProperty({ description: "Droppable members owned." })
  owned!: number;

  @ApiProperty({ description: "Droppable members: owning them all completes the family." })
  total!: number;

  @ApiProperty()
  completed!: boolean;
}

export class CardDetailDto extends CardDto {
  @ApiProperty({ nullable: true, type: String, description: "First sentences of the article, in `lang`." })
  extract!: string | null;

  @ApiProperty({
    enum: LOCALES,
    enumName: "Locale",
    isArray: true,
    description: "Languages this disease has an article in.",
  })
  languages!: AppLocale[];

  @ApiProperty({ type: [String], example: ["J11"] })
  icd10!: string[];

  @ApiProperty({ description: "Copies the caller owns; 0 when not collected yet." })
  quantity!: number;

  @ApiProperty({ description: "How many of those copies are shiny." })
  shinyQuantity!: number;

  @ApiProperty({ nullable: true, type: String, format: "date-time" })
  firstObtainedAt!: string | null;

  @ApiProperty({ description: "Players owning at least one copy." })
  ownersCount!: number;

  @ApiProperty({ type: [FamilyBriefDto], description: "The families the card belongs to." })
  families!: FamilyBriefDto[];
}

export class CollectionItemDto {
  @ApiProperty({ type: CardDto })
  card!: CardDto;

  @ApiProperty({ description: "Copies owned; 0 for a card not collected yet." })
  quantity!: number;

  @ApiProperty({ description: "How many of those copies are shiny. Show the card shiny when above 0." })
  shinyQuantity!: number;

  @ApiProperty({ nullable: true, type: String, format: "date-time" })
  firstObtainedAt!: string | null;

  @ApiProperty({ nullable: true, type: String, format: "date-time" })
  lastObtainedAt!: string | null;
}

export class CollectionPageDto {
  @ApiProperty({ type: [CollectionItemDto] })
  items!: CollectionItemDto[];

  @ApiProperty()
  total!: number;

  @ApiProperty()
  page!: number;

  @ApiProperty()
  pageSize!: number;
}

export const COLLECTION_OWNED_FILTERS = ["all", "owned", "missing", "shiny"] as const;
export type CollectionOwnedFilter = (typeof COLLECTION_OWNED_FILTERS)[number];

export const COLLECTION_SORTS = [
  "number",
  "name",
  "rarity",
  "popularity",
  "recent",
] as const;
export type CollectionSort = (typeof COLLECTION_SORTS)[number];

export class CollectionQueryDto extends PageQueryDto {
  @ApiPropertyOptional({ description: "Matches the card name, in any language." })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  search?: string;

  @ApiPropertyOptional({ enum: Rarity, enumName: "Rarity" })
  @IsOptional()
  @IsEnum(Rarity)
  rarity?: Rarity;

  @ApiPropertyOptional({
    enum: COLLECTION_OWNED_FILTERS,
    default: "all",
    description: "`shiny`: only the cards owned in a shiny copy.",
  })
  @IsOptional()
  @IsIn(COLLECTION_OWNED_FILTERS)
  owned?: CollectionOwnedFilter;

  @ApiPropertyOptional({ format: "uuid", description: "Only the members of this family." })
  @IsOptional()
  @IsUUID()
  family?: string;

  @ApiPropertyOptional({
    enum: COLLECTION_SORTS,
    default: "number",
    description: "`recent` lists owned cards by last drop, newest first.",
  })
  @IsOptional()
  @IsIn(COLLECTION_SORTS)
  sort?: CollectionSort;
}

export class RarityProgressDto {
  @ApiProperty({ enum: Rarity, enumName: "Rarity" })
  rarity!: Rarity;

  @ApiProperty({ description: "Distinct cards of this rarity owned." })
  owned!: number;

  @ApiProperty({ description: "Cards of this rarity that can drop." })
  total!: number;
}

export class CollectionSummaryDto {
  @ApiProperty({ description: "Distinct cards owned." })
  uniqueOwned!: number;

  @ApiProperty({ description: "Copies owned, duplicates included." })
  totalCopies!: number;

  @ApiProperty({ description: "Distinct cards owned in a shiny copy." })
  shinyOwned!: number;

  @ApiProperty({ description: "Cards that can currently drop from a pack." })
  catalogSize!: number;

  @ApiProperty({ description: "Share of the droppable catalog owned, 0-100." })
  completionPct!: number;

  @ApiProperty({
    description: "Leaderboard score: the rarity points of every distinct card owned, plus `familyBonus`.",
  })
  score!: number;

  @ApiProperty({ description: "Bonus points from the completed families, included in `score`." })
  familyBonus!: number;

  @ApiProperty({ description: "Families whose every droppable member is owned." })
  familiesCompleted!: number;

  @ApiProperty({ type: [RarityProgressDto] })
  byRarity!: RarityProgressDto[];
}

export class LeaderboardQueryDto extends LocaleQueryDto {
  @ApiPropertyOptional({ minimum: 1, maximum: 100, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}

export class LeaderboardEntryDto {
  @ApiProperty()
  rank!: number;

  @ApiProperty({ format: "uuid" })
  userId!: string;

  @ApiProperty({ nullable: true, type: String })
  displayName!: string | null;

  @ApiProperty({ nullable: true, type: String })
  photoUrl!: string | null;

  @ApiProperty()
  uniqueOwned!: number;

  @ApiProperty({
    description: "Sum of the rarity points of every distinct card owned, plus the bonus of every completed family.",
  })
  score!: number;
}
