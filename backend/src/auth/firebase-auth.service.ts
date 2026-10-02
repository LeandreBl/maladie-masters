import { HttpStatus, Injectable, Logger } from "@nestjs/common";
import { Prisma, UserRole, type User } from "@prisma/client";
import type { DecodedIdToken } from "firebase-admin/auth";
import { AppException } from "../common/app.exception";
import { ErrorCode } from "../common/error-code.enum";
import { FALLBACK_LOCALE, localeFromAcceptLanguage } from "../common/locale";
import { PrismaService } from "../prisma/prisma.service";
import { RealtimeService } from "../realtime/realtime.service";
import { GameSettingsService } from "../settings/game-settings.service";
import { FirebaseService } from "./firebase.service";

/**
 * `lastSeenAt` feeds the "active players" figures, which count days, not
 * seconds: writing it on every request would cost a row update per call.
 */
const LAST_SEEN_RESOLUTION_MS = 5 * 60_000;

/**
 * Resolves a Firebase ID token into the matching player, creating the player
 * — with a full pack wallet — on first sign-in.
 */
@Injectable()
export class FirebaseAuthService {
  private readonly logger = new Logger(FirebaseAuthService.name);

  constructor(
    private readonly firebase: FirebaseService,
    private readonly prisma: PrismaService,
    private readonly settings: GameSettingsService,
    private readonly realtime: RealtimeService,
  ) {}

  /**
   * `acceptLanguage` only matters on the first sign-in: it picks the new
   * account's language, which the player can change afterwards.
   */
  async authenticate(token: string, acceptLanguage?: string): Promise<User> {
    let decoded: DecodedIdToken;

    try {
      decoded = await this.firebase.verifyToken(token);
    } catch (error) {
      const firebaseError = error as { code?: string; message?: string };
      this.logger.warn(
        `Firebase token verification failed: ${firebaseError.code ?? "unknown"} ${firebaseError.message ?? ""}`,
      );
      throw new AppException(
        ErrorCode.INVALID_TOKEN,
        HttpStatus.UNAUTHORIZED,
        "Invalid Firebase token",
      );
    }

    const email = decoded.email?.toLowerCase();
    if (!email) {
      throw new AppException(
        ErrorCode.INVALID_TOKEN,
        HttpStatus.UNAUTHORIZED,
        "Firebase token does not contain an email",
      );
    }

    // Before any decision taken on the strength of that address: the ADMIN
    // role hangs off it.
    this.assertEmailVerified(decoded, email);

    const role = (await this.isAdminEmail(email))
      ? UserRole.ADMIN
      : UserRole.USER;

    const user = await this.resolveUser(decoded, email, role, acceptLanguage);

    if (user.suspendedAt) {
      throw new AppException(
        ErrorCode.ACCOUNT_SUSPENDED,
        HttpStatus.FORBIDDEN,
        "This account is suspended",
      );
    }

    return user;
  }

  /**
   * Refuses a token whose address is not proven.
   *
   * Without this check, enabling any Firebase provider that does not verify the
   * address — email/password, say — was enough to sign up under an
   * administrator's address and inherit the ADMIN role granted to it.
   * No provider is exempt: the claim is required whatever the sign-in method.
   */
  private assertEmailVerified(decoded: DecodedIdToken, email: string): void {
    if (decoded.email_verified === true) {
      return;
    }

    const provider = decoded.firebase?.sign_in_provider ?? "unknown";
    this.logger.warn(
      `Refused sign-in for ${email}: the token carries no verified email ` +
        `(sign-in provider "${provider}")`,
    );
    throw new AppException(
      ErrorCode.EMAIL_NOT_VERIFIED,
      HttpStatus.FORBIDDEN,
      "This account's email address is not verified",
    );
  }

  /**
   * Finds the player for this Firebase account, or creates it.
   *
   * An address already linked to another Firebase account is refused rather
   * than taken over: linking on the address alone would hand the row — its
   * collection and its role — to whoever presents the same address.
   */
  private async resolveUser(
    decoded: DecodedIdToken,
    email: string,
    role: UserRole,
    acceptLanguage?: string,
    retryOnConflict = true,
  ): Promise<User> {
    const firebaseUid = decoded.uid;
    const byUid = await this.prisma.user.findUnique({ where: { firebaseUid } });

    if (byUid) {
      const stale =
        !byUid.lastSeenAt ||
        Date.now() - byUid.lastSeenAt.getTime() > LAST_SEEN_RESOLUTION_MS;
      if (!stale && byUid.email === email && byUid.role === role) {
        return byUid;
      }

      return this.prisma.user.update({
        where: { id: byUid.id },
        data: { email, role, lastSeenAt: new Date() },
      });
    }

    const byEmail = await this.prisma.user.findUnique({ where: { email } });
    if (byEmail) {
      this.logger.error(
        `Refused sign-in for ${email}: the address is already linked to ` +
          `user ${byEmail.id}. Firebase uid ${firebaseUid} was not granted access.`,
      );
      throw new AppException(
        ErrorCode.EMAIL_ALREADY_LINKED,
        HttpStatus.CONFLICT,
        "This email address is already linked to another account",
      );
    }

    const settings = await this.settings.get();

    try {
      const now = new Date();
      const user = await this.prisma.user.create({
        data: {
          firebaseUid,
          email,
          role,
          locale: localeFromAcceptLanguage(acceptLanguage) ?? FALLBACK_LOCALE,
          displayName: this.displayNameFrom(decoded, email),
          photoUrl: typeof decoded.picture === "string" ? decoded.picture : null,
          // A new player starts with a full wallet.
          packsStored: settings.packMaxStored,
          packsAnchorAt: now,
          lastSeenAt: now,
        },
      });
      this.logger.log(`New player ${email} (${user.id})`);
      this.realtime.toAdmins({ type: "player.joined", data: { userId: user.id } });
      return user;
    } catch (error) {
      // Two first sign-ins racing: the row appeared between the findUnique and
      // the create. Retry once, and the branches above will decide.
      const isUniqueViolation =
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002";

      if (isUniqueViolation && retryOnConflict) {
        return this.resolveUser(decoded, email, role, acceptLanguage, false);
      }

      throw error;
    }
  }

  private displayNameFrom(decoded: DecodedIdToken, email: string): string {
    const name = typeof decoded.name === "string" ? decoded.name.trim() : "";
    return (name || email.split("@")[0] || "Joueur").slice(0, 40);
  }

  private async isAdminEmail(email: string): Promise<boolean> {
    const adminGrant = await this.prisma.adminGrant.findUnique({
      where: { email },
    });

    return !!adminGrant;
  }
}
