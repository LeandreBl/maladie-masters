import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Env } from "../config/env";

const API = "https://discord.com/api/v10";
const TIMEOUT_MS = 10_000;
/** Retries after a 429, waiting what Discord asks each time. */
const RATE_LIMIT_RETRIES = 2;

/**
 * What the bot needs on a channel: View Channel (1 << 10), Send Messages
 * (1 << 11) and Embed Links (1 << 14). Mentioning a user needs nothing more.
 */
export const BOT_PERMISSIONS = String((1 << 10) | (1 << 11) | (1 << 14));

/** Discord's JSON error codes the bot reacts to. */
export const DiscordErrorCode = {
  UNKNOWN_CHANNEL: 10003,
  UNKNOWN_GUILD: 10004,
  UNKNOWN_MEMBER: 10007,
  MISSING_ACCESS: 50001,
  MISSING_PERMISSIONS: 50013,
} as const;

export class DiscordApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: number | undefined,
    message: string,
  ) {
    super(message);
    this.name = "DiscordApiError";
  }
}

/**
 * The few REST calls the bot makes, with the bot token. There is no gateway
 * connection: slash commands reach the API as signed HTTP requests (see
 * DiscordInteractionsController), so the backend stays a plain web service.
 */
@Injectable()
export class DiscordApiService {
  private readonly logger = new Logger(DiscordApiService.name);
  readonly applicationId: string;
  readonly publicKey: string;
  private readonly token: string;

  constructor(config: ConfigService<Env, true>) {
    this.applicationId = config.get("DISCORD_APPLICATION_ID", { infer: true });
    this.publicKey = config.get("DISCORD_PUBLIC_KEY", { infer: true });
    this.token = config.get("DISCORD_BOT_TOKEN", { infer: true });
  }

  /** The bot only runs with its three settings: one alone is a mistake. */
  get enabled(): boolean {
    return Boolean(this.applicationId && this.publicKey && this.token);
  }

  /** The link anyone can follow to add the bot to a server they manage. */
  get inviteUrl(): string | null {
    if (!this.enabled) return null;
    const params = new URLSearchParams({
      client_id: this.applicationId,
      scope: "bot applications.commands",
      permissions: BOT_PERMISSIONS,
    });
    return `https://discord.com/oauth2/authorize?${params.toString()}`;
  }

  /** Replaces every global slash command with `commands`: idempotent. */
  async registerCommands(commands: unknown[]): Promise<void> {
    await this.request("PUT", `/applications/${this.applicationId}/commands`, commands);
  }

  /** False when the user is not (or no longer) on the server. */
  async isMember(guildId: string, userId: string): Promise<boolean> {
    try {
      await this.request("GET", `/guilds/${guildId}/members/${userId}`);
      return true;
    } catch (error) {
      if (error instanceof DiscordApiError && error.code === DiscordErrorCode.UNKNOWN_MEMBER) {
        return false;
      }
      throw error;
    }
  }

  async postMessage(channelId: string, message: unknown): Promise<void> {
    await this.request("POST", `/channels/${channelId}/messages`, message);
  }

  /** Fills in the reply to a deferred interaction. */
  async editInteractionReply(token: string, message: unknown): Promise<void> {
    await this.request(
      "PATCH",
      `/webhooks/${this.applicationId}/${token}/messages/@original`,
      message,
    );
  }

  private async request(method: string, path: string, body?: unknown): Promise<unknown> {
    for (let attempt = 0; ; attempt += 1) {
      const response = await fetch(`${API}${path}`, {
        method,
        headers: {
          Authorization: `Bot ${this.token}`,
          "Content-Type": "application/json",
          "User-Agent": "DiscordBot (maladie-masters, 0.1.0)",
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      const payload = (await response.json().catch(() => null)) as
        | { code?: number; message?: string; retry_after?: number }
        | null;

      if (response.status === 429 && attempt < RATE_LIMIT_RETRIES) {
        const waitMs = Math.ceil((payload?.retry_after ?? 1) * 1000);
        this.logger.warn(`Discord rate limit on ${method} ${path}, retrying in ${waitMs} ms`);
        await new Promise((resolve) => setTimeout(resolve, waitMs));
        continue;
      }
      if (!response.ok) {
        throw new DiscordApiError(
          response.status,
          payload?.code,
          `Discord ${method} ${path} failed: ${response.status} ${payload?.message ?? response.statusText}`,
        );
      }
      return payload;
    }
  }
}
