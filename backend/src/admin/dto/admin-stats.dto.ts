import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Rarity } from "@prisma/client";
import { Type } from "class-transformer";
import { IsInt, IsOptional, Max, Min } from "class-validator";
import { CardDto } from "../../cards/dto/card.dto";
import { LOCALES, type AppLocale } from "../../common/locale";
import { LocaleQueryDto } from "../../common/request-locale.decorator";
import { SyncRunDto } from "../../sync/dto/sync.dto";

export class StatsWindowQueryDto extends LocaleQueryDto {
  @ApiPropertyOptional({ minimum: 1, maximum: 180, default: 30 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(180)
  days?: number;
}

class LocaleCountDto {
  @ApiProperty({ enum: LOCALES, enumName: "Locale" }) locale!: AppLocale;
  @ApiProperty() count!: number;
}

class UsersOverviewDto {
  @ApiProperty({ type: [LocaleCountDto], description: "Accounts per language." })
  byLocale!: LocaleCountDto[];
  @ApiProperty() total!: number;
  @ApiProperty({ description: "Seen in the last 24 hours." }) active24h!: number;
  @ApiProperty() active7d!: number;
  @ApiProperty({ description: "Signed up in the last 7 days." }) new7d!: number;
  @ApiProperty() suspended!: number;
  @ApiProperty() admins!: number;
}

class PacksOverviewDto {
  @ApiProperty() opened24h!: number;
  @ApiProperty() opened7d!: number;
  @ApiProperty() openedTotal!: number;
  @ApiProperty({ description: "Bonus packs granted and not opened yet." }) bonusOutstanding!: number;
  @ApiProperty({ description: "Shiny cards drawn, all time." }) shiniesTotal!: number;
  @ApiProperty({ description: "Shiny cards drawn over 7 days." }) shinies7d!: number;
}

class RarityCatalogDto {
  @ApiProperty({ enum: Rarity, enumName: "Rarity" }) rarity!: Rarity;
  @ApiProperty() total!: number;
  @ApiProperty({ description: "Enabled and still in Wikidata." }) droppable!: number;
}

class CardsOverviewDto {
  @ApiProperty() total!: number;
  @ApiProperty() droppable!: number;
  @ApiProperty() disabled!: number;
  @ApiProperty() missing!: number;
  @ApiProperty({
    type: [LocaleCountDto],
    description: "Droppable cards with an article in each language; the others fall back to English.",
  })
  byLocale!: LocaleCountDto[];
  @ApiProperty({ type: [RarityCatalogDto] }) byRarity!: RarityCatalogDto[];
}

class CollectionOverviewDto {
  @ApiProperty({ description: "Copies across every collection." }) copies!: number;
  @ApiProperty({ description: "Players owning at least one card." }) collectors!: number;
  @ApiProperty({ description: "Average distinct cards per collector." }) avgUniquePerCollector!: number;
}

class SyncOverviewDto {
  @ApiProperty() running!: boolean;
  @ApiProperty({ nullable: true, type: SyncRunDto }) lastRun!: SyncRunDto | null;
  @ApiProperty({ nullable: true, type: SyncRunDto, description: "Last run that succeeded." })
  lastSuccess!: SyncRunDto | null;
  @ApiProperty({ nullable: true, type: String, format: "date-time" }) nextScheduledAt!: string | null;
}

export class StatsOverviewDto {
  @ApiProperty({ format: "date-time" }) generatedAt!: string;
  @ApiProperty({ type: UsersOverviewDto }) users!: UsersOverviewDto;
  @ApiProperty({ type: PacksOverviewDto }) packs!: PacksOverviewDto;
  @ApiProperty({ type: CardsOverviewDto }) cards!: CardsOverviewDto;
  @ApiProperty({ type: CollectionOverviewDto }) collection!: CollectionOverviewDto;
  @ApiProperty({ type: SyncOverviewDto }) sync!: SyncOverviewDto;
}

export class DailyPointDto {
  @ApiProperty({ example: "2026-10-02" }) date!: string;
  @ApiProperty() signups!: number;
  @ApiProperty() packsOpened!: number;
  @ApiProperty({ description: "Distinct players who opened a pack that day." }) activePlayers!: number;
}

export class StatsSeriesDto {
  @ApiProperty() days!: number;
  @ApiProperty({ type: [DailyPointDto] }) points!: DailyPointDto[];
}

class RarityDropDto {
  @ApiProperty({ enum: Rarity, enumName: "Rarity" }) rarity!: Rarity;
  @ApiProperty() count!: number;
  @ApiProperty({ description: "Observed share of the drops, in percent." }) pct!: number;
  @ApiProperty({ description: "Share the current settings should give, in percent." }) expectedPct!: number;
}

export class DropStatsDto {
  @ApiProperty() days!: number;
  @ApiProperty() total!: number;
  @ApiProperty({ type: [RarityDropDto] }) byRarity!: RarityDropDto[];
}

export class TopCardDto {
  @ApiProperty({ type: CardDto }) card!: CardDto;
  @ApiProperty() owners!: number;
  @ApiProperty() copies!: number;
}
