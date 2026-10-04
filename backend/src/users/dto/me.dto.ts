import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { UserRole } from "@prisma/client";
import { Transform } from "class-transformer";
import { IsBoolean, IsIn, IsOptional, IsString, Length } from "class-validator";
import { LOCALES, type AppLocale } from "../../common/locale";
import { CollectionSummaryDto } from "../../cards/dto/card.dto";
import { PackWalletDto } from "../../packs/dto/pack.dto";

export class MeDto {
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

  @ApiProperty({
    enum: LOCALES,
    enumName: "Locale",
    description: "The account's language: cards are served in it unless `?lang=` says otherwise.",
  })
  locale!: AppLocale;

  @ApiProperty({
    description: "Safe for work: the player app hides the card pictures and draws the generated art instead.",
  })
  sfw!: boolean;

  @ApiProperty({ format: "date-time" })
  createdAt!: string;

  @ApiProperty({ type: PackWalletDto })
  packs!: PackWalletDto;

  @ApiProperty({ type: CollectionSummaryDto })
  collection!: CollectionSummaryDto;
}

export class UpdateMeDto {
  @ApiPropertyOptional({ minLength: 2, maxLength: 40, example: "Dr House" })
  @IsOptional()
  @IsString()
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @Length(2, 40)
  displayName?: string;

  @ApiPropertyOptional({ enum: LOCALES, enumName: "Locale" })
  @IsOptional()
  @IsIn(LOCALES)
  locale?: AppLocale;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  sfw?: boolean;
}
