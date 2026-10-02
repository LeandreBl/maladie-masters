import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from "@nestjs/common";
import { SyncTrigger } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { GameSettingsService } from "../settings/game-settings.service";
import { DiseaseSyncService } from "../sync/disease-sync.service";
import { nextScheduledRun } from "../sync/sync-schedule";

const TICK_INTERVAL_MS = 60_000;
/** The first tick waits for the app to settle, then a fresh install imports. */
const FIRST_TICK_DELAY_MS = 15_000;

/**
 * The scheduler. A plain interval, like the rest of the stack: the schedule
 * lives in the game settings, so the admin panel changes it without a restart,
 * and the last run's start time — in the database — decides whether a run is
 * due, so a restart does not trigger an extra one.
 */
@Injectable()
export class CronService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(CronService.name);
  private timer: NodeJS.Timeout | null = null;
  private firstTick: NodeJS.Timeout | null = null;
  private ticking = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: GameSettingsService,
    private readonly sync: DiseaseSyncService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.sync.recoverInterruptedRuns();

    this.firstTick = setTimeout(() => void this.tick(), FIRST_TICK_DELAY_MS);
    this.firstTick.unref();
    this.timer = setInterval(() => void this.tick(), TICK_INTERVAL_MS);
    this.timer.unref();
  }

  onModuleDestroy(): void {
    if (this.firstTick) clearTimeout(this.firstTick);
    if (this.timer) clearInterval(this.timer);
    this.firstTick = null;
    this.timer = null;
  }

  private async tick(): Promise<void> {
    if (this.ticking || this.sync.isRunning()) return;
    this.ticking = true;

    try {
      const settings = await this.settings.get();
      const lastRun = await this.prisma.diseaseSyncRun.findFirst({
        orderBy: { startedAt: "desc" },
      });
      const due = nextScheduledRun(settings, lastRun);

      if (due && due.getTime() <= Date.now()) {
        this.logger.log("Scheduled Wikipedia sync is due, starting it");
        await this.sync.start(SyncTrigger.SCHEDULE);
      }
    } catch (error) {
      this.logger.error(`Cron tick failed: ${String(error)}`);
    } finally {
      this.ticking = false;
    }
  }
}
