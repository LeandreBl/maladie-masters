import { Injectable, Logger } from "@nestjs/common";
import type { DiscordGuild } from "@prisma/client";
import { localizationOf, type LocalizedCard } from "../cards/card-mapper";
import type { AppLocale } from "../common/locale";
import { PrismaService } from "../prisma/prisma.service";
import { DiscordApiError, DiscordApiService, DiscordErrorCode } from "./discord-api.service";
import { discordMessages, escapeMarkdown } from "./discord-messages";

/** A drawn copy, as stored in `PackOpeningCard`. */
export interface AnnouncedCard {
  card: LocalizedCard;
  isShiny: boolean;
}

const LEGENDARY_COLOR = 0xf1c40f;
const SHINY_COLOR = 0xe056fd;
/** Discord caps a message at 10 embeds. */
const MAX_EMBEDS = 10;

/**
 * Posts a player's legendary drops on every server that set a channel and
 * that the player is a member of, with a mention of their Discord account.
 *
 * Runs after the pack is committed and never makes the opening wait or fail:
 * Discord being slow or down only costs the announcement.
 */
@Injectable()
export class DiscordAnnouncerService {
  private readonly logger = new Logger(DiscordAnnouncerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly api: DiscordApiService,
  ) {}

  /** Fire and forget. */
  announceLegendaries(userId: string, cards: AnnouncedCard[]): void {
    if (!this.api.enabled || cards.length === 0) return;
    void this.announce(userId, cards).catch((error: unknown) =>
      this.logger.error(`Legendary announcement for ${userId} failed: ${String(error)}`),
    );
  }

  private async announce(userId: string, cards: AnnouncedCard[]): Promise<void> {
    const account = await this.prisma.discordAccount.findFirst({
      where: { userId, announce: true, user: { suspendedAt: null } },
      include: { user: { select: { locale: true } } },
    });
    if (!account) return;

    // In the player's language, the one they play in, whatever the server's.
    const message = this.message(account.discordUserId, cards, account.user.locale);

    // One membership lookup per server, however many channels it has.
    // Legendaries are rare enough (one pack in ~60) for this to stay well
    // under the rate limits.
    const guilds = await this.prisma.discordGuild.findMany({ include: { channels: true } });
    for (const guild of guilds) {
      try {
        if (!(await this.isMember(guild, account.discordUserId))) continue;
      } catch (error) {
        this.logger.warn(`Membership check on Discord server ${guild.guildId} failed: ${String(error)}`);
        continue;
      }

      for (const channel of guild.channels) {
        try {
          await this.api.postMessage(channel.channelId, message);
        } catch (error) {
          const code = error instanceof DiscordApiError ? error.code : undefined;
          if (code === DiscordErrorCode.UNKNOWN_CHANNEL) {
            await this.forgetChannel(guild.guildId, channel.channelId);
          } else {
            // Missing permissions: left to the server's admins to fix.
            this.logger.warn(`Announcement in Discord channel ${channel.channelId} failed: ${String(error)}`);
          }
        }
      }
    }
  }

  /**
   * Whether the player is on the server. A server that removed the bot
   * answers "unknown guild" or "missing access" here, and will not come back
   * by itself: its rows go, and `/maladie-setup channel` makes new ones.
   */
  private async isMember(guild: DiscordGuild, discordUserId: string): Promise<boolean> {
    try {
      return await this.api.isMember(guild.guildId, discordUserId);
    } catch (error) {
      const code = error instanceof DiscordApiError ? error.code : undefined;
      if (code === DiscordErrorCode.UNKNOWN_GUILD || code === DiscordErrorCode.MISSING_ACCESS) {
        this.logger.warn(`Discord server ${guild.guildId}: the bot was removed, announcements stopped`);
        // The channels go with it (cascade).
        await this.prisma.discordGuild.deleteMany({ where: { guildId: guild.guildId } });
        return false;
      }
      throw error;
    }
  }

  /** A deleted channel; the server row goes with its last channel. */
  private async forgetChannel(guildId: string, channelId: string): Promise<void> {
    this.logger.warn(`Discord channel ${channelId} was deleted, announcements there stopped`);
    await this.prisma.$transaction(async (tx) => {
      await tx.discordChannel.deleteMany({ where: { channelId } });
      if ((await tx.discordChannel.count({ where: { guildId } })) === 0) {
        await tx.discordGuild.deleteMany({ where: { guildId } });
      }
    });
  }

  private message(discordUserId: string, cards: AnnouncedCard[], locale: AppLocale) {
    const t = discordMessages(locale);
    const names = cards.map(({ card }) => escapeMarkdown(localizationOf(card, locale)?.name ?? card.wikidataId));

    return {
      content: t.announce(`<@${discordUserId}>`, names, cards.some(({ isShiny }) => isShiny)),
      // Only the player may be pinged, whatever a card name contains.
      allowed_mentions: { users: [discordUserId] },
      embeds: cards.slice(0, MAX_EMBEDS).map(({ card, isShiny }) => {
        const text = localizationOf(card, locale);
        return {
          title: `${isShiny ? "✦ " : ""}${text?.name ?? card.wikidataId}`.slice(0, 256),
          url: text?.wikipediaUrl ?? `https://www.wikidata.org/wiki/${card.wikidataId}`,
          description: text?.description?.slice(0, 300) ?? undefined,
          color: isShiny ? SHINY_COLOR : LEGENDARY_COLOR,
          thumbnail: card.imageUrl ? { url: card.imageUrl } : undefined,
          footer: { text: `#${card.number} · ${t.legendary}${isShiny ? " ✦ shiny" : ""}` },
        };
      }),
    };
  }
}
