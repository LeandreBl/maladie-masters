import { Body, Get, Patch } from "@nestjs/common";
import type { GameSettings, User } from "@prisma/client";
import { ApiAdminController } from "../auth/api-controller.decorators";
import { CurrentUser } from "../auth/current-user.decorator";
import { AuditAction, AuditService } from "../audit/audit.service";
import { cardsPerPack, expectedDropShares, packHitOdds } from "../cards/rarity";
import { RarityRankingService } from "../cards/rarity-ranking.service";
import { ApiEndpoint, ApiTag } from "../common/swagger";
import { RealtimeService } from "../realtime/realtime.service";
import { GameSettingsService } from "../settings/game-settings.service";
import { GameSettingsDto, UpdateGameSettingsDto } from "./dto/admin-settings.dto";

const SHARE_FIELDS = [
  "shareLegendary",
  "shareEpic",
  "shareRare",
  "shareUncommon",
] as const;

@ApiAdminController(ApiTag.AdminSettings, "v1/admin/settings")
export class AdminSettingsController {
  constructor(
    private readonly settings: GameSettingsService,
    private readonly ranking: RarityRankingService,
    private readonly audit: AuditService,
    private readonly realtime: RealtimeService,
  ) {}

  @Get()
  @ApiEndpoint({
    summary: "Get the game rules",
    response: "Settings returned",
    type: GameSettingsDto,
  })
  async get(): Promise<GameSettingsDto> {
    return this.toDto(await this.settings.get());
  }

  @Patch()
  @ApiEndpoint({
    summary: "Change the game rules",
    description: [
      "Only the fields present change. A new pack timer applies to every wallet on its next read.",
      "Changing a rarity share re-ranks the catalog straight away.",
    ].join(" "),
    response: "Settings updated",
    type: GameSettingsDto,
    validation: true,
  })
  async update(
    @CurrentUser() actor: User,
    @Body() dto: UpdateGameSettingsDto,
  ): Promise<GameSettingsDto> {
    const before = await this.settings.get();
    const { packSlots, ...rest } = dto;
    const after = await this.settings.update({
      ...rest,
      ...(packSlots
        ? { packSlots: packSlots.map((slot) => ({ count: slot.count, weights: { ...slot.weights } })) }
        : {}),
    });

    // Compared by value: the slots are JSON, a new array every time.
    const changed = Object.fromEntries(
      Object.entries(dto).filter(
        ([key, value]) =>
          JSON.stringify(before[key as keyof GameSettings]) !== JSON.stringify(value),
      ),
    );
    if (Object.keys(changed).length > 0) {
      await this.audit.record(actor.id, AuditAction.SettingsUpdated, changed);
    }
    if (SHARE_FIELDS.some((field) => field in changed)) {
      await this.ranking.recompute();
    }
    // The pack timer and cap shape every wallet on screen.
    if (Object.keys(changed).length > 0) {
      this.realtime.toEveryone({ type: "settings.updated", data: {} });
    }

    return this.toDto(after);
  }

  private toDto(settings: GameSettings): GameSettingsDto {
    const { id: _id, createdAt: _createdAt, updatedAt, packSlots: _raw, ...rules } = settings;
    const packSlots = this.settings.packSlots(settings);
    return {
      ...rules,
      packSlots,
      cardsPerPack: cardsPerPack(packSlots),
      expectedDropPct: expectedDropShares(packSlots),
      packHitPct: packHitOdds(packSlots),
      updatedAt: updatedAt.toISOString(),
    };
  }
}
