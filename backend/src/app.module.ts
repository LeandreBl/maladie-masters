import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { LoggerModule } from "nestjs-pino";
import { AdminModule } from "./admin/admin.module";
import { AuditModule } from "./audit/audit.module";
import { AuthModule } from "./auth/auth.module";
import { CardsModule } from "./cards/cards.module";
import { ThrottlingModule } from "./common/throttling/throttling.module";
import { AppConfigModule } from "./config/config.module";
import type { Env } from "./config/env";
import { CronModule } from "./cron/cron.module";
import { DiscordModule } from "./discord/discord.module";
import { HealthModule } from "./health/health.module";
import { PacksModule } from "./packs/packs.module";
import { PrismaModule } from "./prisma/prisma.module";
import { RealtimeApiModule } from "./realtime/realtime-api.module";
import { RealtimeModule } from "./realtime/realtime.module";
import { SettingsModule } from "./settings/settings.module";
import { SyncModule } from "./sync/sync.module";
import { UsersModule } from "./users/users.module";

@Module({
  imports: [
    AppConfigModule,
    LoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => {
        const production =
          config.get("NODE_ENV", { infer: true }) === "production";
        return {
          pinoHttp: {
            transport: !production
              ? {
                  target: "pino-pretty",
                  options: {
                    colorize: true,
                    singleLine: true,
                    ignore: "pid,hostname,req,res,responseTime",
                  },
                }
              : undefined,
            level: production ? "info" : "debug",
            customLogLevel: (_req, res, err) => {
              if (err || (res.statusCode && res.statusCode >= 500)) {
                return "error";
              }

              if (res.statusCode && res.statusCode >= 400) {
                return "warn";
              }

              return "info";
            },
            customSuccessMessage: (req, res) => {
              return `${req.method} ${req.url} ${res.statusCode}`;
            },
            customErrorMessage: (req, res) => {
              return `${req.method} ${req.url} ${res.statusCode}`;
            },
            serializers: {
              req: () => undefined,
              res: () => undefined,
            },
          },
        };
      },
    }),
    ThrottlingModule,
    PrismaModule,
    RealtimeModule,
    SettingsModule,
    AuditModule,
    AuthModule,
    CardsModule,
    DiscordModule,
    PacksModule,
    UsersModule,
    RealtimeApiModule,
    SyncModule,
    AdminModule,
    CronModule,
    HealthModule,
  ],
})
export class AppModule {}
