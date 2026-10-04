import { Module, applyDecorators } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { APP_GUARD } from "@nestjs/core";
import { Throttle, ThrottlerModule, seconds } from "@nestjs/throttler";
import { getEnv, type Env } from "../../config/env";
import { UserAwareThrottlerGuard } from "./user-aware-throttler.guard";

/**
 * Global rate limiting.
 *
 * `@nestjs/throttler` applies *every* declared throttler to *every* route, so a
 * limit meant for one expensive route would end up imposed on the whole API.
 * Routes that deserve something stricter override the `default` throttler
 * instead. Two are declared:
 *
 * - `default`, per caller and per route (see `UserAwareThrottlerGuard`);
 * - `ip`, one counter per address across the whole API. The `default` tracker
 *   comes from the bearer token before it is verified, so a client sending a
 *   new made-up token on every request would get a fresh counter each time:
 *   this ceiling is what such a client still runs into. Generous, because a
 *   school or an office shares one address.
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
        {
          name: "ip",
          ttl: seconds(60),
          limit: config.get("THROTTLE_IP_PER_MINUTE", { infer: true }),
          getTracker: (request) => `ip:${request.ip ?? "unknown"}`,
          // The default key also holds the route: one counter for the whole
          // API instead, or the ceiling would multiply by the number of routes.
          generateKey: (_context, tracker, name) => `${name}-${tracker}`,
        },
      ],
    }),
  ],
  providers: [{ provide: APP_GUARD, useClass: UserAwareThrottlerGuard }],
})
export class ThrottlingModule {}
