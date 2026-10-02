import {
  HttpStatus,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { UserRole, type User } from "@prisma/client";
import Redis from "ioredis";
import { randomBytes } from "node:crypto";
import { AppException } from "../common/app.exception";
import { ErrorCode } from "../common/error-code.enum";
import type { Env } from "../config/env";
import {
  RealtimeChannel,
  TICKET_KEY_PREFIX,
  type RealtimeControl,
  type RealtimeEvent,
  type RealtimeMessage,
  type RealtimeTicket,
} from "./realtime-events";

/**
 * Long enough for the front to open the socket right after asking, short enough
 * that a ticket caught in a log is worthless. The relay also deletes it on use.
 */
export const TICKET_TTL_SECONDS = 30;

/**
 * Publishes real-time events to Redis, where `websocket-relay` picks them up.
 *
 * Publishing never fails the caller: an event is a hint that something
 * changed, and the action it reports has already been committed. When Redis is
 * down, or `REDIS_URL` is empty, events are dropped and the fronts catch up on
 * their next reload.
 */
@Injectable()
export class RealtimeService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RealtimeService.name);
  private redis: Redis | null = null;
  private reachable = false;

  constructor(private readonly config: ConfigService<Env, true>) {}

  onModuleInit(): void {
    const url = this.config.get("REDIS_URL", { infer: true });
    if (!url) {
      this.logger.warn("REDIS_URL is empty: real time is disabled");
      return;
    }

    // The password is passed as an option rather than inside the URL: a
    // base64-generated password contains `/`, `+` and `=`, which make the URL
    // invalid or silently truncate the value.
    this.redis = new Redis(url, {
      password: this.config.get("REDIS_PASSWORD", { infer: true }) || undefined,
      // Fail fast while disconnected instead of queueing: an event published
      // minutes late is worse than none, and the queue would grow unbounded.
      enableOfflineQueue: false,
      maxRetriesPerRequest: 1,
    });
    this.redis.on("ready", () => {
      this.reachable = true;
      this.logger.log("Connected to Redis");
    });
    // ioredis retries forever and reports every failed attempt: only the
    // transition is worth a line.
    this.redis.on("error", (error) => {
      if (this.reachable) {
        this.logger.warn(`Redis unreachable, real-time events are dropped: ${error.message}`);
      }
      this.reachable = false;
    });
  }

  onModuleDestroy(): void {
    this.redis?.disconnect();
    this.redis = null;
  }

  toUser(userId: string, event: RealtimeEvent): void {
    this.publish(RealtimeChannel.user(userId), event);
  }

  toAdmins(event: RealtimeEvent): void {
    this.publish(RealtimeChannel.admins, event);
  }

  toEveryone(event: RealtimeEvent): void {
    this.publish(RealtimeChannel.everyone, event);
  }

  /** Closes a player's sockets so they reconnect with their current rights. */
  disconnect(userId: string): void {
    const order: RealtimeControl = { type: "disconnect", userId };
    this.send(RealtimeChannel.control, order);
  }

  /**
   * A single-use pass for the websocket relay.
   *
   * The relay cannot verify a Firebase token on its own, and calling the API
   * for it would make every connection cost a request. The API vouches for the
   * player once, here, and the relay reads the answer from Redis.
   */
  async issueTicket(user: User): Promise<{ ticket: string; expiresAt: string }> {
    if (!this.redis || !this.reachable) {
      throw new AppException(
        ErrorCode.REALTIME_UNAVAILABLE,
        HttpStatus.SERVICE_UNAVAILABLE,
        "Real time is unavailable",
      );
    }

    const ticket = randomBytes(32).toString("base64url");
    const value: RealtimeTicket = {
      userId: user.id,
      admin: user.role === UserRole.ADMIN,
    };
    await this.redis.set(
      `${TICKET_KEY_PREFIX}${ticket}`,
      JSON.stringify(value),
      "EX",
      TICKET_TTL_SECONDS,
    );

    return {
      ticket,
      expiresAt: new Date(Date.now() + TICKET_TTL_SECONDS * 1000).toISOString(),
    };
  }

  private publish(channel: string, event: RealtimeEvent): void {
    const message: RealtimeMessage = { ...event, at: new Date().toISOString() };
    this.send(channel, message);
  }

  private send(channel: string, payload: unknown): void {
    if (!this.redis || !this.reachable) return;
    this.redis
      .publish(channel, JSON.stringify(payload))
      .catch((error: unknown) =>
        this.logger.debug(`Dropped a real-time message on ${channel}: ${String(error)}`),
      );
  }
}
