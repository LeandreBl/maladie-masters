import { applyDecorators, Controller, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import {
  ApiAdminErrorResponses,
  ApiAuthErrorResponses,
} from "../common/swagger/api-error-responses";
import { FIREBASE_AUTH_SCHEME } from "../common/swagger/api-security";
import type { ApiTagName } from "../common/swagger/api-tags";
import { AdminGuard } from "./admin.guard";
import { AuthGuard } from "./auth.guard";

/**
 * A controller every signed-in player can reach. Bundles the route prefix, the
 * guard and the documentation that has to agree with it, so a route cannot end
 * up guarded but documented as public, or the reverse.
 */
export function ApiAuthenticatedController(tag: ApiTagName, path: string) {
  return applyDecorators(
    ApiTags(tag),
    ApiBearerAuth(FIREBASE_AUTH_SCHEME),
    ApiAuthErrorResponses(),
    UseGuards(AuthGuard),
    Controller(path),
  );
}

/** A controller reserved for admins: same as above, plus the `403`. */
export function ApiAdminController(tag: ApiTagName, path: string) {
  return applyDecorators(
    ApiTags(tag),
    ApiBearerAuth(FIREBASE_AUTH_SCHEME),
    ApiAdminErrorResponses(),
    UseGuards(AuthGuard, AdminGuard),
    Controller(path),
  );
}
