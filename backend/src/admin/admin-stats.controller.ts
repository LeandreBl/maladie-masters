import { Get, Query } from "@nestjs/common";
import { ApiAdminController } from "../auth/api-controller.decorators";
import { CollectionService } from "../cards/collection.service";
import { LeaderboardEntryDto, LeaderboardQueryDto } from "../cards/dto/card.dto";
import type { AppLocale } from "../common/locale";
import { RequestLocale } from "../common/request-locale.decorator";
import { ApiEndpoint, ApiTag } from "../common/swagger";
import { AdminStatsService } from "./admin-stats.service";
import {
  DropStatsDto,
  StatsOverviewDto,
  StatsSeriesDto,
  StatsWindowQueryDto,
  TopCardDto,
} from "./dto/admin-stats.dto";

@ApiAdminController(ApiTag.AdminStats, "v1/admin/stats")
export class AdminStatsController {
  constructor(
    private readonly stats: AdminStatsService,
    private readonly collection: CollectionService,
  ) {}

  @Get("overview")
  @ApiEndpoint({
    summary: "Dashboard figures",
    description: "Players, packs, catalog, collections and the state of the sync, in one call.",
    response: "Overview returned",
    type: StatsOverviewDto,
  })
  overview(): Promise<StatsOverviewDto> {
    return this.stats.overview();
  }

  @Get("series")
  @ApiEndpoint({
    summary: "Daily signups, openings and active players",
    response: "Series returned",
    type: StatsSeriesDto,
    validation: true,
  })
  series(@Query() query: StatsWindowQueryDto): Promise<StatsSeriesDto> {
    return this.stats.series(query.days ?? 30);
  }

  @Get("drops")
  @ApiEndpoint({
    summary: "Observed drop rates per rarity",
    description: "Side by side with what the current settings should give, to spot a skewed catalog.",
    response: "Drop rates returned",
    type: DropStatsDto,
    validation: true,
  })
  drops(@Query() query: StatsWindowQueryDto): Promise<DropStatsDto> {
    return this.stats.drops(query.days ?? 30);
  }

  @Get("top-cards")
  @ApiEndpoint({
    summary: "Cards in the most collections",
    response: "Cards returned",
    type: [TopCardDto],
    validation: true,
  })
  topCards(
    @Query() query: LeaderboardQueryDto,
    @RequestLocale() locale: AppLocale,
  ): Promise<TopCardDto[]> {
    return this.stats.topCards(query.limit ?? 10, locale);
  }

  @Get("top-collectors")
  @ApiEndpoint({
    summary: "Top collectors",
    description: "The public leaderboard, suspended players excluded.",
    response: "Collectors returned",
    type: [LeaderboardEntryDto],
    validation: true,
  })
  topCollectors(@Query() query: LeaderboardQueryDto): Promise<LeaderboardEntryDto[]> {
    return this.collection.leaderboard(query.limit ?? 10);
  }
}
