import { Module } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { SyncRunStatus, SyncTrigger } from "@prisma/client";
import { AppConfigModule } from "./config/config.module";
import { getEnvOrExit } from "./config/env";
import { PrismaModule } from "./prisma/prisma.module";
import { RealtimeModule } from "./realtime/realtime.module";
import { SettingsModule } from "./settings/settings.module";
import { DiseaseSyncService } from "./sync/disease-sync.service";
import { SyncModule } from "./sync/sync.module";

/**
 * Just what an import needs: no HTTP server, no scheduler, no Firebase. The
 * run is recorded like any other and shows up in the admin panel — live, since
 * its progress goes through Redis like the server's.
 */
@Module({
  imports: [
    AppConfigModule,
    PrismaModule,
    RealtimeModule,
    SettingsModule,
    SyncModule,
  ],
})
class SyncCliModule {}

/**
 * `npm run sync:diseases`: runs the Wikipedia import in the foreground and
 * exits non-zero when it fails. Refuses to start while another run is live.
 */
async function main(): Promise<void> {
  getEnvOrExit();
  const app = await NestFactory.createApplicationContext(SyncCliModule, {
    logger: ["log", "warn", "error"],
  });

  try {
    const run = await app
      .get(DiseaseSyncService)
      .runToCompletion(SyncTrigger.MANUAL);
    process.stdout.write(
      `Sync ${run.status}: ${run.fetched} fetched, ${run.created} new, ` +
        `${run.updated} refreshed, ${run.missing} missing, ${run.restored} restored\n`,
    );
    process.exitCode = run.status === SyncRunStatus.SUCCEEDED ? 0 : 1;
  } finally {
    await app.close();
  }
}

void main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
