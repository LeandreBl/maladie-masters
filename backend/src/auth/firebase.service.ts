import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth, type Auth, type DecodedIdToken } from "firebase-admin/auth";
import { existsSync, readFileSync } from "fs";
import type { Env } from "../config/env";

/**
 * How long an account is trusted between two checks with Firebase. A signature
 * check alone accepts a token for its whole hour of life, even once the account
 * is deleted, disabled or signed out everywhere; asking Firebase on every
 * request would cost a round trip each time.
 */
const REVOCATION_CHECK_MS = 60_000;
/** Past this many accounts, the expired checks are swept out. */
const REVOCATION_CACHE_SWEEP = 10_000;
/** What Firebase answers about an account that must lose its access. */
const REFUSED_ACCOUNT_CODES = new Set([
  "auth/id-token-revoked",
  "auth/user-disabled",
  "auth/user-not-found",
]);

@Injectable()
export class FirebaseService implements OnModuleInit {
  private readonly logger = new Logger(FirebaseService.name);
  private app?: App;
  /** Firebase uid → when its account was last confirmed with Firebase. */
  private readonly accountCheckedAt = new Map<string, number>();

  constructor(private config: ConfigService<Env, true>) {}

  onModuleInit() {
    const [existingApp] = getApps();
    if (!existingApp) {
      const credsPath = this.config.get("GOOGLE_APPLICATION_CREDENTIALS", {
        infer: true,
      });
      if (!existsSync(credsPath)) {
        this.logger.warn(
          `Firebase service account file not found at ${credsPath}`,
        );
        return;
      }

      // A placeholder or broken key leaves auth disabled instead of keeping the
      // whole API down.
      try {
        const serviceAccount = JSON.parse(readFileSync(credsPath, "utf-8"));
        this.app = initializeApp({
          credential: cert(serviceAccount),
        });
      } catch (error) {
        this.logger.warn(
          `Firebase service account at ${credsPath} is invalid: ${(error as Error).message}`,
        );
      }
    } else {
      this.app = existingApp;
    }
  }

  get auth(): Auth {
    if (!this.app) {
      throw new Error("Firebase is not configured");
    }

    return getAuth(this.app);
  }

  /**
   * Verifies the token's signature, and at most once per `REVOCATION_CHECK_MS`
   * per account, that Firebase still stands behind it.
   *
   * Only Firebase's verdict on the account refuses a token: when Firebase
   * cannot be reached, the signature is enough, or an outage on its side would
   * sign every player out.
   */
  async verifyToken(token: string): Promise<DecodedIdToken> {
    const decoded = await this.auth.verifyIdToken(token);
    const checkedAt = this.accountCheckedAt.get(decoded.uid);
    if (checkedAt !== undefined && Date.now() - checkedAt < REVOCATION_CHECK_MS) {
      return decoded;
    }

    try {
      await this.auth.verifyIdToken(token, true);
    } catch (error) {
      const code = (error as { code?: string }).code ?? "";
      if (REFUSED_ACCOUNT_CODES.has(code)) {
        this.accountCheckedAt.delete(decoded.uid);
        throw error;
      }
      this.logger.warn(
        `Firebase revocation check failed (${code || (error as Error).message}), token accepted on its signature`,
      );
      return decoded;
    }

    this.rememberCheck(decoded.uid);
    return decoded;
  }

  private rememberCheck(uid: string): void {
    const now = Date.now();
    if (this.accountCheckedAt.size >= REVOCATION_CACHE_SWEEP) {
      for (const [cachedUid, checkedAt] of this.accountCheckedAt) {
        if (now - checkedAt >= REVOCATION_CHECK_MS) this.accountCheckedAt.delete(cachedUid);
      }
    }
    this.accountCheckedAt.set(uid, now);
  }
}
