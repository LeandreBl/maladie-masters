import { HttpStatus, Injectable } from "@nestjs/common";
import type { ExecutionContext } from "@nestjs/common";
import { ThrottlerGuard, type ThrottlerLimitDetail } from "@nestjs/throttler";
import { createHash } from "node:crypto";
import { AppException } from "../app.exception";
import { ErrorCode } from "../error-code.enum";

/**
 * Counts requests per caller rather than per IP address.
 *
 * A company reaches the outside through a handful of public addresses: counting
 * by IP would let one busy user throttle all of their colleagues. The bearer
 * token, on the other hand, identifies the caller.
 *
 * This guard is global, so it runs before the route's `AuthGuard` and normally
 * does not see `request.user`: it falls back to a fingerprint of the token,
 * which is stable for as long as the token lives. The IP is only used for
 * unauthenticated calls — `POST /v1/auth/token` first among them, which is
 * precisely the one worth protecting.
 */
@Injectable()
export class UserAwareThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(request: Record<string, any>): Promise<string> {
    const userId = request.user?.id;
    if (typeof userId === "string" && userId) {
      return `user:${userId}`;
    }

    const authorization = request.headers?.authorization;
    if (
      typeof authorization === "string" &&
      authorization.toLowerCase().startsWith("bearer ")
    ) {
      const token = authorization.slice("bearer ".length).trim();
      if (token) {
        // A fingerprint only: the token itself has no business in a cache key,
        // still less in a log.
        return `token:${createHash("sha256").update(token).digest("base64url").slice(0, 32)}`;
      }
    }

    return `ip:${request.ip ?? "unknown"}`;
  }

  /**
   * Returns the same error envelope as the rest of the API, so a client can
   * branch on `code` the way it does everywhere else.
   */
  protected async throwThrottlingException(
    _context: ExecutionContext,
    detail: ThrottlerLimitDetail,
  ): Promise<void> {
    const retryAfter = Math.ceil(detail.timeToBlockExpire);

    throw new AppException(
      ErrorCode.TOO_MANY_REQUESTS,
      HttpStatus.TOO_MANY_REQUESTS,
      `Too many requests. Retry in ${retryAfter} second${retryAfter > 1 ? "s" : ""}.`,
    );
  }
}
