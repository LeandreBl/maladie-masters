import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth, type Auth, type DecodedIdToken } from "firebase-admin/auth";
import { existsSync, readFileSync } from "fs";
import type { Env } from "../config/env";

@Injectable()
export class FirebaseService implements OnModuleInit {
  private readonly logger = new Logger(FirebaseService.name);
  private app?: App;

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

  async verifyToken(token: string): Promise<DecodedIdToken> {
    return this.auth.verifyIdToken(token);
  }
}
