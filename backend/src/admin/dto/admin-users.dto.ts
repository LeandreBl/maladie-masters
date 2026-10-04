import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { UserRole } from "@prisma/client";
import { Transform, Type } from "class-transformer";
import {
  Equals,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Max,
  MaxLength,
  Min,
  NotEquals,
} from "class-validator";
import { CollectionSummaryDto } from "../../cards/dto/card.dto";
import { LOCALES, type AppLocale } from "../../common/locale";
import { PageQueryDto } from "../../common/pagination";
import { PackOpeningDto, PackWalletDto } from "../../packs/dto/pack.dto";
import { AuditEntryDto } from "./admin-access.dto";

export const ADMIN_USER_FILTERS = ["all", "admins", "suspended", "active7d"] as const;
export type AdminUserFilter = (typeof ADMIN_USER_FILTERS)[number];

export const ADMIN_USER_SORTS = ["lastSeen", "createdAt", "cards", "packs"] as const;
export type AdminUserSort = (typeof ADMIN_USER_SORTS)[number];

const trim = ({ value }: { value: unknown }) =>
  typeof value === "string" ? value.trim() : value;

export class AdminUsersQueryDto extends PageQueryDto {
  @ApiPropertyOptional({ description: "Matches the email or the display name." })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  @Transform(trim)
  search?: string;

  @ApiPropertyOptional({ enum: ADMIN_USER_FILTERS, default: "all" })
  @IsOptional()
  @IsIn(ADMIN_USER_FILTERS)
  filter?: AdminUserFilter;

  @ApiPropertyOptional({ enum: ADMIN_USER_SORTS, default: "lastSeen" })
  @IsOptional()
  @IsIn(ADMIN_USER_SORTS)
  sort?: AdminUserSort;
}

export class AdminUserRowDto {
  @ApiProperty({ format: "uuid" })
  id!: string;

  @ApiProperty({ format: "email" })
  email!: string;

  @ApiProperty({ nullable: true, type: String })
  displayName!: string | null;

  @ApiProperty({ nullable: true, type: String })
  photoUrl!: string | null;

  @ApiProperty({ enum: UserRole, enumName: "UserRole" })
  role!: UserRole;

  @ApiProperty({ enum: LOCALES, enumName: "Locale", description: "The account's language." })
  locale!: AppLocale;

  @ApiProperty({ nullable: true, type: String, format: "date-time" })
  suspendedAt!: string | null;

  @ApiProperty({ nullable: true, type: String, format: "date-time" })
  lastSeenAt!: string | null;

  @ApiProperty({ format: "date-time" })
  createdAt!: string;

  @ApiProperty({ description: "Distinct cards owned." })
  uniqueCards!: number;

  @ApiProperty()
  packsOpened!: number;

  @ApiProperty({ description: "Packs that can be opened right now." })
  packsAvailable!: number;
}

export class AdminUserCountsDto {
  @ApiProperty() all!: number;
  @ApiProperty() admins!: number;
  @ApiProperty() suspended!: number;
  @ApiProperty() active7d!: number;
}

export class AdminUsersPageDto {
  @ApiProperty({ type: [AdminUserRowDto] })
  items!: AdminUserRowDto[];

  @ApiProperty({ type: AdminUserCountsDto })
  counts!: AdminUserCountsDto;

  @ApiProperty() total!: number;
  @ApiProperty() page!: number;
  @ApiProperty() pageSize!: number;
}

export class AdminUserStatsDto {
  @ApiProperty() packsOpened!: number;
  @ApiProperty() packsOpened7d!: number;
  @ApiProperty({ nullable: true, type: String, format: "date-time" })
  lastOpenedAt!: string | null;
}

export class AdminUserDetailDto extends AdminUserRowDto {
  @ApiProperty({ nullable: true, type: String })
  suspendedReason!: string | null;

  @ApiProperty({ type: PackWalletDto })
  wallet!: PackWalletDto;

  @ApiProperty({ type: CollectionSummaryDto })
  collection!: CollectionSummaryDto;

  @ApiProperty({ type: AdminUserStatsDto })
  stats!: AdminUserStatsDto;

  @ApiProperty({ type: [PackOpeningDto], description: "The last ten openings." })
  recentOpenings!: PackOpeningDto[];

  @ApiProperty({ type: [AuditEntryDto], description: "The last twenty admin actions on this player." })
  audit!: AuditEntryDto[];
}

export class GrantPacksDto {
  @ApiProperty({
    minimum: -1000,
    maximum: 1000,
    example: 5,
    description: "Bonus packs to add. Negative takes some back, down to zero.",
  })
  @Type(() => Number)
  @IsInt()
  @Min(-1000)
  @Max(1000)
  @NotEquals(0)
  amount!: number;

  @ApiPropertyOptional({ maxLength: 200, description: "Kept in the audit trail." })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  @Transform(trim)
  note?: string;
}

export class UnlockCardDto {
  @ApiProperty({ format: "uuid" })
  @IsUUID()
  cardId!: string;

  @ApiPropertyOptional({ minimum: 1, maximum: 100, default: 1, description: "Copies to add." })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  quantity?: number;

  @ApiPropertyOptional({ default: false, description: "Add the copies as shiny ones." })
  @IsOptional()
  @IsBoolean()
  shiny?: boolean;
}

export class SuspendUserDto {
  @ApiProperty({ minLength: 3, maxLength: 300 })
  @IsString()
  @Transform(trim)
  @Length(3, 300)
  reason!: string;
}

export class CardRemovalDto {
  @ApiProperty({ format: "uuid" }) cardId!: string;
  @ApiProperty() removed!: boolean;
}

export class RemoveCopiesDto {
  @ApiPropertyOptional({
    minimum: 1,
    maximum: 10000,
    description: "Copies to take. Omitted, or more than owned: every copy of that kind.",
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10000)
  quantity?: number;

  @ApiPropertyOptional({
    default: false,
    description: "Take shiny copies instead of normal ones.",
  })
  @IsOptional()
  @IsBoolean()
  shiny?: boolean;
}

export class CopiesRemovalDto {
  @ApiProperty({ format: "uuid" }) cardId!: string;
  @ApiProperty({ description: "Copies taken." }) removed!: number;
  @ApiProperty({ description: "Copies left, shiny ones included." }) quantity!: number;
  @ApiProperty({ description: "Shiny copies left." }) shinyQuantity!: number;
}

export class ResetCollectionDto {
  @ApiPropertyOptional({
    default: false,
    description: "Also erase the pack openings, so the history starts over too.",
  })
  @IsOptional()
  @IsBoolean()
  history?: boolean;
}

export class ResetAllCollectionsDto extends ResetCollectionDto {
  @ApiProperty({
    enum: ["RESET"],
    description: "Must be `RESET`: this empties every player's collection.",
  })
  @Equals("RESET")
  confirm!: "RESET";
}

export class CollectionsResetDto {
  @ApiProperty({ description: "Players whose collection was not empty." })
  players!: number;

  @ApiProperty({ description: "Collection rows erased." })
  cards!: number;

  @ApiProperty({ description: "Pack openings erased." })
  openings!: number;
}

export class UserDeletionDto {
  @ApiProperty({ format: "uuid" }) userId!: string;
  @ApiProperty() deleted!: boolean;
  @ApiProperty({ description: "The Firebase account was deleted as well." })
  firebaseDeleted!: boolean;
}
