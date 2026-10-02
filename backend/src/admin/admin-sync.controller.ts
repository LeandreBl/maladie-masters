import { Get, HttpStatus, Post, Query } from "@nestjs/common";
import { ApiConflictResponse } from "@nestjs/swagger";
import { SyncTrigger, type User } from "@prisma/client";
import { ApiAdminController } from "../auth/api-controller.decorators";
import { CurrentUser } from "../auth/current-user.decorator";
import { AuditAction, AuditService } from "../audit/audit.service";
import { AppException } from "../common/app.exception";
import { ApiErrorResponseDto } from "../common/dto/api-error-response.dto";
import { ErrorCode } from "../common/error-code.enum";
import { PageQueryDto, pageWindow } from "../common/pagination";
import { ApiEndpoint, ApiTag, UuidParam } from "../common/swagger";
import { PrismaService } from "../prisma/prisma.service";
import { GameSettingsService } from "../settings/game-settings.service";
import { DiseaseSyncService } from "../sync/disease-sync.service";
import {
  SyncRunDetailDto,
  SyncRunPageDto,
  SyncStatusDto,
} from "../sync/dto/sync.dto";
import { toSyncRunDetailDto, toSyncRunDto } from "../sync/sync-run.mapper";
import { nextScheduledRun } from "../sync/sync-schedule";

const WITH_TRIGGER = { triggeredBy: { select: { email: true } } } as const;

@ApiAdminController(ApiTag.AdminSync, "v1/admin/sync")
export class AdminSyncController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sync: DiseaseSyncService,
    private readonly settings: GameSettingsService,
    private readonly audit: AuditService,
  ) {}

  @Get("status")
  @ApiEndpoint({
    summary: "Where the sync stands",
    description: "The run in progress with its log, the last run, and when the scheduler fires next. While `running` is set, the admin feed of the websocket relay carries a `sync.progress` event at each update.",
    response: "Status returned",
    type: SyncStatusDto,
  })
  async status(): Promise<SyncStatusDto> {
    const [running, lastRun, settings] = await Promise.all([
      this.prisma.diseaseSyncRun.findFirst({
        where: { status: "RUNNING" },
        orderBy: { startedAt: "desc" },
        include: WITH_TRIGGER,
      }),
      this.prisma.diseaseSyncRun.findFirst({
        where: { status: { not: "RUNNING" } },
        orderBy: { startedAt: "desc" },
        include: WITH_TRIGGER,
      }),
      this.settings.get(),
    ]);
    const next = running ? null : nextScheduledRun(settings, lastRun);

    return {
      running: running ? toSyncRunDetailDto(running) : null,
      lastRun: lastRun ? toSyncRunDto(lastRun) : null,
      enabled: settings.syncEnabled,
      intervalHours: settings.syncIntervalHours,
      nextScheduledAt: next
        ? new Date(Math.max(next.getTime(), Date.now())).toISOString()
        : null,
      wikipediaHosts: this.sync.wikipediaHosts,
    };
  }

  @Get("runs")
  @ApiEndpoint({
    summary: "Run history",
    description: "Newest first, without the logs.",
    response: "Runs returned",
    type: SyncRunPageDto,
    validation: true,
  })
  async runs(@Query() query: PageQueryDto): Promise<SyncRunPageDto> {
    const { page, pageSize, skip, take } = pageWindow(query);
    const [runs, total] = await this.prisma.$transaction([
      this.prisma.diseaseSyncRun.findMany({
        orderBy: { startedAt: "desc" },
        include: WITH_TRIGGER,
        skip,
        take,
      }),
      this.prisma.diseaseSyncRun.count(),
    ]);
    return { items: runs.map(toSyncRunDto), total, page, pageSize };
  }

  @Post("runs")
  @ApiEndpoint({
    summary: "Start a sync now",
    description: "Returns as soon as the run is recorded; follow it through `GET /v1/admin/sync/status`.",
    response: "Run started",
    type: SyncRunDetailDto,
    created: true,
  })
  @ApiConflictResponse({
    description: "A run is already in progress (`SYNC_ALREADY_RUNNING`).",
    type: ApiErrorResponseDto,
  })
  async start(@CurrentUser() actor: User): Promise<SyncRunDetailDto> {
    const run = await this.sync.start(SyncTrigger.MANUAL, actor.id);
    await this.audit.record(actor.id, AuditAction.SyncStarted, { runId: run.id });
    return toSyncRunDetailDto({ ...run, triggeredBy: { email: actor.email } });
  }

  @Get("runs/:id")
  @ApiEndpoint({
    summary: "Get a run with its log",
    response: "Run returned",
    type: SyncRunDetailDto,
    notFound: true,
  })
  async run(@UuidParam("id", "Identifier of the run") id: string): Promise<SyncRunDetailDto> {
    const run = await this.prisma.diseaseSyncRun.findUnique({
      where: { id },
      include: WITH_TRIGGER,
    });
    if (!run) {
      throw new AppException(
        ErrorCode.SYNC_RUN_NOT_FOUND,
        HttpStatus.NOT_FOUND,
        "Sync run not found",
      );
    }
    return toSyncRunDetailDto(run);
  }
}
