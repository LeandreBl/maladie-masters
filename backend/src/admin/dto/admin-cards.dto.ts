import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Rarity } from "@prisma/client";
import { Transform } from "class-transformer";
import {
  IsBoolean,
  IsEnum,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  ValidateIf,
} from "class-validator";
import { CardDto, FamilyBriefDto } from "../../cards/dto/card.dto";
import { LOCALES, type AppLocale } from "../../common/locale";
import { PageQueryDto } from "../../common/pagination";

export const ADMIN_CARD_STATUSES = ["all", "enabled", "disabled", "missing", "overridden"] as const;
export type AdminCardStatus = (typeof ADMIN_CARD_STATUSES)[number];

export const ADMIN_CARD_SORTS = ["popularity", "number", "name", "owners", "recent"] as const;
export type AdminCardSort = (typeof ADMIN_CARD_SORTS)[number];

export class AdminCardsQueryDto extends PageQueryDto {
  @ApiPropertyOptional({ description: "Matches a name or an article title in any language, or the QID." })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  search?: string;

  @ApiPropertyOptional({ enum: Rarity, enumName: "Rarity" })
  @IsOptional()
  @IsEnum(Rarity)
  rarity?: Rarity;

  @ApiPropertyOptional({ enum: ADMIN_CARD_STATUSES, default: "all" })
  @IsOptional()
  @IsIn(ADMIN_CARD_STATUSES)
  status?: AdminCardStatus;

  @ApiPropertyOptional({ enum: ADMIN_CARD_SORTS, default: "popularity" })
  @IsOptional()
  @IsIn(ADMIN_CARD_SORTS)
  sort?: AdminCardSort;
}

export class AdminCardDto extends CardDto {
  @ApiProperty({ example: "Q2840" })
  wikidataId!: string;

  @ApiProperty({
    enum: LOCALES,
    enumName: "Locale",
    isArray: true,
    description: "Languages this disease has an article in.",
  })
  languages!: AppLocale[];

  @ApiProperty({ enum: Rarity, enumName: "Rarity", description: "What popularity alone gives." })
  popularityRarity!: Rarity;

  @ApiProperty({ enum: Rarity, enumName: "Rarity", nullable: true })
  rarityOverride!: Rarity | null;

  @ApiProperty({ description: "Disabled cards never drop." })
  enabled!: boolean;

  @ApiProperty({ nullable: true, type: String, format: "date-time" })
  missingSince!: string | null;

  @ApiProperty({ description: "Players owning a copy." })
  owners!: number;

  @ApiProperty({ format: "date-time" })
  createdAt!: string;
}

export class AdminCardCountsDto {
  @ApiProperty() all!: number;
  @ApiProperty() enabled!: number;
  @ApiProperty() disabled!: number;
  @ApiProperty() missing!: number;
  @ApiProperty() overridden!: number;
}

export class AdminCardsPageDto {
  @ApiProperty({ type: [AdminCardDto] }) items!: AdminCardDto[];
  @ApiProperty({ type: AdminCardCountsDto }) counts!: AdminCardCountsDto;
  @ApiProperty() total!: number;
  @ApiProperty() page!: number;
  @ApiProperty() pageSize!: number;
}

export class CardLocalizationDto {
  @ApiProperty({ enum: LOCALES, enumName: "Locale" }) locale!: AppLocale;
  @ApiProperty() name!: string;
  @ApiProperty() pageTitle!: string;
  @ApiProperty() wikipediaUrl!: string;
  @ApiProperty({ nullable: true, type: String }) description!: string | null;
  @ApiProperty({ nullable: true, type: String }) extract!: string | null;
  @ApiProperty({ description: "Views of this language's article alone." }) pageviews!: number;
}

export class AdminCardFamilyDto extends FamilyBriefDto {
  @ApiProperty() enabled!: boolean;
}

export class AdminCardDetailDto extends AdminCardDto {
  @ApiProperty({ nullable: true, type: String, description: "In `lang`." }) extract!: string | null;
  @ApiProperty({ type: [CardLocalizationDto], description: "Every language, in the fallback order." })
  localizations!: CardLocalizationDto[];
  @ApiProperty({ type: [String] }) icd10!: string[];
  @ApiProperty({ description: "Copies across every collection." }) copies!: number;
  @ApiProperty({ description: "Times it came out of a pack." }) drops!: number;
  @ApiProperty() drops7d!: number;
  @ApiProperty({ format: "date-time" }) lastSyncedAt!: string;
  @ApiProperty({ type: [AdminCardFamilyDto], description: "Every family it belongs to, hidden ones included." })
  families!: AdminCardFamilyDto[];
}

export class UpdateAdminCardDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @ApiPropertyOptional({
    enum: Rarity,
    enumName: "Rarity",
    nullable: true,
    description: "Pins the rarity. `null` goes back to the popularity ranking.",
  })
  @IsOptional()
  @ValidateIf((_object, value) => value !== null)
  @IsEnum(Rarity)
  rarityOverride?: Rarity | null;
}

export class RankingResultDto {
  @ApiProperty() ranked!: number;
  @ApiProperty({ description: "Cards whose rarity changed." }) changed!: number;
}
