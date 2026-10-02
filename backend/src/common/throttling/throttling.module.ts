import { Module, applyDecorators } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { APP_GUARD } from "@nestjs/core";
import { Throttle, ThrottlerModule, seconds } from "@nestjs/throttler";
import { getEnv, type Env } from "../../config/env";
import { UserAwareThrottlerGuard } from "./user-aware-throttler.guard";

/**
 * Global rate limiting.
 *
 * One throttler is configured rather than several named ones: `@nestjs/throttler`
 * applies *every* declared throttler to *every* route, so a limit meant for one
 * expensive route would end up imposed on the whole API. Routes that deserve
 * something stricter override the `default` throttler instead.
 */

/**
 * Opening a pack locks the player's row and writes a handful of others. The
 * wallet already caps how many can be opened, but an admin with a large bonus
 * stock should not be able to hammer the database through a loop.
 */
export function ThrottlePacks(): MethodDecorator & ClassDecorator {
  return applyDecorators(
    Throttle({
      default: {
        // Resolved per request: decorators run at import time, before the
        // environment is validated.
        limit: () => getEnv().THROTTLE_PACK_PER_MINUTE,
        ttl: seconds(60),
      },
    }),
  );
}

@Module({
  imports: [
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => [
        {
          name: "default",
          ttl: seconds(60),
          limit: config.get("THROTTLE_DEFAULT_PER_MINUTE", { infer: true }),
        },
      ],
    }),
  ],
  providers: [{ provide: APP_GUARD, useClass: UserAwareThrottlerGuard }],
})
export class ThrottlingModule {}
