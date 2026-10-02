import { ConfigModule } from "@nestjs/config";
import { getEnv } from "./env";

/**
 * `ConfigService` backed by the validated environment only: values come typed
 * (numbers, lists, booleans) from `getEnv()`, and an undeclared key reads as
 * undefined instead of falling back to a raw `process.env` string.
 *
 * `load` runs when the provider is instantiated, not at import, so the OpenAPI
 * generator (preview mode) needs no environment at all.
 */
export const AppConfigModule = ConfigModule.forRoot({
  isGlobal: true,
  ignoreEnvFile: true,
  skipProcessEnv: true,
  load: [getEnv],
});
