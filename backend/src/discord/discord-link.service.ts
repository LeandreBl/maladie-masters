import { HttpStatus, Injectable, Logger } from "@nestjs/common";
import type { DiscordAccount } from "@prisma/client";
import { AppException } from "../common/app.exception";
import { ErrorCode } from "../common/error-code.enum";
import { PrismaService } from "../prisma/prisma.service";
import { DiscordApiService } from "./discord-api.service";
import {
  formatLinkCode,
  generateLinkCode,
  LINK_CODE_TTL_MS,
  normalizeLinkCode,
} from "./discord-link-code";
import type { DiscordLinkCodeDto, DiscordStatusDto } from "./dto/discord.dto";

/**
 * Ties a player to a Discord account. The proof goes from the site to
 * Discord: the signed-in player gets a code, and only the Discord user who
 * types it in `/maladie link` is linked. Nobody can get someone else
 * mentioned by entering their Discord ID.
 */
@Injectable()
export class DiscordLinkService {
  private readonly logger = new Logger(DiscordLinkService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly api: DiscordApiService,
  ) {}

  async status(userId: string): Promise<DiscordStatusDto> {
    const [account, pending] = await Promise.all([
      this.prisma.discordAccount.findUnique({ where: { userId } }),
      this.prisma.discordLinkCode.findFirst({ where: { userId, expiresAt: { gt: new Date() } } }),
    ]);
    return {
      enabled: this.api.enabled,
      inviteUrl: this.api.inviteUrl,
      account: account
        ? { username: account.username, announce: account.announce, linkedAt: account.linkedAt.toISOString() }
        : null,
      pendingCode: pending
        ? { code: formatLinkCode(pending.code), expiresAt: pending.expiresAt.toISOString() }
        : null,
    };
  }

  /** A new code, replacing the previous one. */
  async createCode(userId: string): Promise<DiscordLinkCodeDto> {
    if (!this.api.enabled) {
      throw new AppException(
        ErrorCode.DISCORD_DISABLED,
        HttpStatus.SERVICE_UNAVAILABLE,
        "The Discord bot is not configured on this server",
      );
    }
    const expiresAt = new Date(Date.now() + LINK_CODE_TTL_MS);
    // A collision on the unique code is one in a trillion: retry rather than
    // fail the player.
    for (let attempt = 0; ; attempt += 1) {
      const code = generateLinkCode();
      try {
        await this.prisma.discordLinkCode.upsert({
          where: { userId },
          create: { userId, code, expiresAt },
          update: { code, expiresAt, createdAt: new Date() },
        });
        return { code: formatLinkCode(code), expiresAt: expiresAt.toISOString() };
      } catch (error) {
        if (attempt >= 2) throw error;
      }
    }
  }

  async setAnnounce(userId: string, announce: boolean): Promise<DiscordStatusDto> {
    const updated = await this.prisma.discordAccount.updateMany({
      where: { userId },
      data: { announce },
    });
    if (updated.count === 0) {
      throw new AppException(
        ErrorCode.DISCORD_NOT_LINKED,
        HttpStatus.NOT_FOUND,
        "No Discord account is linked",
      );
    }
    return this.status(userId);
  }

  async unlink(userId: string): Promise<DiscordStatusDto> {
    await this.prisma.discordAccount.deleteMany({ where: { userId } });
    return this.status(userId);
  }

  /**
   * Spends a code typed in Discord. A Discord account belongs to one player
   * at a time: linking it again moves it to the player who owns the new code.
   * Null when the code is unknown or expired.
   */
  async redeem(
    input: unknown,
    discordUserId: string,
    username: string,
  ): Promise<DiscordAccount | null> {
    const code = normalizeLinkCode(input);
    if (!code) return null;

    return this.prisma.$transaction(async (tx) => {
      const pending = await tx.discordLinkCode.findUnique({ where: { code } });
      if (!pending) return null;
      await tx.discordLinkCode.delete({ where: { userId: pending.userId } });
      if (pending.expiresAt <= new Date()) return null;

      await tx.discordAccount.deleteMany({
        where: { discordUserId, NOT: { userId: pending.userId } },
      });
      const account = await tx.discordAccount.upsert({
        where: { userId: pending.userId },
        create: { userId: pending.userId, discordUserId, username },
        update: { discordUserId, username, announce: true, linkedAt: new Date() },
      });
      this.logger.log(`Player ${pending.userId} linked to Discord user ${discordUserId}`);
      return account;
    });
  }

  /** `/maladie unlink`, from Discord's side. False when nothing was linked. */
  async unlinkDiscordUser(discordUserId: string): Promise<boolean> {
    const deleted = await this.prisma.discordAccount.deleteMany({ where: { discordUserId } });
    return deleted.count > 0;
  }
}
