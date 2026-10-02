import {
  HttpStatus,
  Injectable,
  Logger,
  type OnApplicationBootstrap,
} from "@nestjs/common";
import type { KeyObject } from "node:crypto";
import { AppException } from "../common/app.exception";
import { ErrorCode } from "../common/error-code.enum";
import { PrismaService } from "../prisma/prisma.service";
import { DiscordApiService } from "./discord-api.service";
import {
  COMMAND_PLAYER,
  COMMAND_SETUP,
  DISCORD_COMMANDS,
  OPTION_CHANNEL,
  OPTION_CODE,
  SUB_CHANNEL,
  SUB_LINK,
  SUB_LIST,
  SUB_OFF,
  SUB_UNLINK,
} from "./discord-commands";
import { DiscordLinkService } from "./discord-link.service";
import { discordMessages, escapeMarkdown, localeFromDiscord } from "./discord-messages";
import { discordPublicKey, isValidDiscordSignature } from "./discord-signature";

/** Interaction and response types, from Discord's documentation. */
const PING = 1;
const APPLICATION_COMMAND = 2;
const PONG = 1;
const CHANNEL_MESSAGE = 4;
const DEFERRED_CHANNEL_MESSAGE = 5;
/** Only the user who typed the command sees the reply. */
const EPHEMERAL = 1 << 6;

interface DiscordUser {
  id: string;
  username: string;
  global_name?: string | null;
}

interface CommandOption {
  name: string;
  type: number;
  value?: unknown;
  options?: CommandOption[];
}

/** The fields of an interaction the bot reads. */
export interface Interaction {
  type: number;
  token: string;
  guild_id?: string;
  channel_id?: string;
  locale?: string;
  guild_locale?: string;
  member?: { user: DiscordUser };
  user?: DiscordUser;
  data?: { name: string; options?: CommandOption[] };
}

export type InteractionResponse = { type: number; data?: Record<string, unknown> };

const reply = (content: string): InteractionResponse => ({
  type: CHANNEL_MESSAGE,
  data: { content, flags: EPHEMERAL, allowed_mentions: { parse: [] } },
});

/**
 * Answers the slash commands Discord forwards to the API. Discord waits 3
 * seconds for the answer: anything slower (posting in another channel) is
 * deferred and completed through the interaction's webhook.
 */
@Injectable()
export class DiscordInteractionsService implements OnApplicationBootstrap {
  private readonly logger = new Logger(DiscordInteractionsService.name);
  private readonly key: KeyObject | null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly api: DiscordApiService,
    private readonly links: DiscordLinkService,
  ) {
    this.key = api.enabled ? discordPublicKey(api.publicKey) : null;
  }

  /** Keeps Discord's command list in step with the code, without blocking the boot. */
  onApplicationBootstrap(): void {
    if (!this.api.enabled) {
      this.logger.log("Discord bot disabled (set DISCORD_APPLICATION_ID, DISCORD_PUBLIC_KEY, DISCORD_BOT_TOKEN)");
      return;
    }
    void this.api
      .registerCommands(DISCORD_COMMANDS)
      .then(() => this.logger.log("Discord slash commands registered"))
      .catch((error: unknown) => this.logger.error(`Registering Discord commands failed: ${String(error)}`));
  }

  /** Parses and authenticates the raw request; Discord expects a 401 otherwise. */
  verify(rawBody: Buffer | undefined, signature: unknown, timestamp: unknown): Interaction {
    if (!this.key || !rawBody || !isValidDiscordSignature(this.key, signature, timestamp, rawBody)) {
      throw new AppException(
        ErrorCode.INVALID_DISCORD_SIGNATURE,
        HttpStatus.UNAUTHORIZED,
        "Invalid request signature",
      );
    }
    return JSON.parse(rawBody.toString("utf8")) as Interaction;
  }

  async handle(interaction: Interaction): Promise<InteractionResponse> {
    if (interaction.type === PING) return { type: PONG };
    if (interaction.type !== APPLICATION_COMMAND || !interaction.data) {
      return reply("?");
    }

    const user = interaction.member?.user ?? interaction.user;
    const t = discordMessages(localeFromDiscord(interaction.locale));
    const sub = interaction.data.options?.[0];
    const option = (name: string) => sub?.options?.find((candidate) => candidate.name === name)?.value;
    if (!user || !sub) return reply("?");

    if (interaction.data.name === COMMAND_PLAYER) {
      if (sub.name === SUB_LINK) {
        const name = user.global_name ?? user.username;
        const account = await this.links.redeem(option(OPTION_CODE), user.id, user.username);
        return reply(account ? t.linked(escapeMarkdown(name)) : t.invalidCode);
      }
      if (sub.name === SUB_UNLINK) {
        return reply((await this.links.unlinkDiscordUser(user.id)) ? t.unlinked : t.notLinked);
      }
    }

    if (interaction.data.name === COMMAND_SETUP) {
      const guildId = interaction.guild_id;
      if (!guildId) return reply(t.guildOnly);

      if (sub.name === SUB_LIST) {
        const channels = await this.prisma.discordChannel.findMany({
          where: { guildId },
          orderBy: { createdAt: "asc" },
        });
        return reply(t.channelList(channels.map((channel) => channel.channelId)));
      }
      if (sub.name === SUB_OFF) {
        const channelId = option(OPTION_CHANNEL);
        if (channelId === undefined) {
          // The channels go with the server row (cascade).
          const deleted = await this.prisma.discordGuild.deleteMany({ where: { guildId } });
          return reply(deleted.count > 0 ? t.setupOff : t.setupWasOff);
        }
        const removed = await this.removeChannel(guildId, String(channelId));
        return reply(removed ? t.channelRemoved(String(channelId)) : t.channelNotListed(String(channelId)));
      }
      if (sub.name === SUB_CHANNEL) {
        const channelId = String(option(OPTION_CHANNEL) ?? interaction.channel_id ?? "");
        if (!channelId) return reply("?");
        const existing = await this.prisma.discordChannel.findUnique({ where: { channelId } });
        if (existing) return reply(t.setupAlready(channelId));
        void this.setupChannel(interaction, guildId, channelId, user.id);
        return { type: DEFERRED_CHANNEL_MESSAGE, data: { flags: EPHEMERAL } };
      }
    }

    return reply("?");
  }

  /**
   * Posts a welcome in the chosen channel before saving it: if the bot cannot
   * write there, the admin learns it now rather than at the first legendary.
   */
  private async setupChannel(
    interaction: Interaction,
    guildId: string,
    channelId: string,
    setupBy: string,
  ): Promise<void> {
    const replyLocale = localeFromDiscord(interaction.locale);
    // The welcome is for the whole server. Community servers report their
    // language; others only the admin's.
    const guildLocale = localeFromDiscord(interaction.guild_locale, interaction.locale);
    const t = discordMessages(replyLocale);

    let content: string;
    try {
      await this.api.postMessage(channelId, {
        content: discordMessages(guildLocale).setupWelcome,
        allowed_mentions: { parse: [] },
      });
      // One row per server, one per channel: adding the same channel twice
      // (two admins at once) lands on the same row instead of a duplicate.
      await this.prisma.$transaction([
        this.prisma.discordGuild.upsert({
          where: { guildId },
          create: { guildId },
          update: {},
        }),
        this.prisma.discordChannel.upsert({
          where: { channelId },
          create: { channelId, guildId, setupBy },
          update: {},
        }),
      ]);
      this.logger.log(`Discord server ${guildId} announces in channel ${channelId}`);
      content = t.setupDone(channelId);
    } catch (error) {
      this.logger.warn(`Discord setup on ${guildId} failed: ${String(error)}`);
      content = t.setupFailed(channelId);
    }

    await this.api
      .editInteractionReply(interaction.token, { content, allowed_mentions: { parse: [] } })
      .catch((error: unknown) => this.logger.warn(`Discord reply failed: ${String(error)}`));
  }

  /** Drops one channel, and the server row with its last channel. */
  private async removeChannel(guildId: string, channelId: string): Promise<boolean> {
    return this.prisma.$transaction(async (tx) => {
      const deleted = await tx.discordChannel.deleteMany({ where: { guildId, channelId } });
      if (deleted.count === 0) return false;
      if ((await tx.discordChannel.count({ where: { guildId } })) === 0) {
        await tx.discordGuild.deleteMany({ where: { guildId } });
      }
      return true;
    });
  }
}
