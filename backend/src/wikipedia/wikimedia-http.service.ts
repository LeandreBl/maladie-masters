import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Env } from "../config/env";

const MAX_ATTEMPTS = 5;
const REQUEST_TIMEOUT_MS = 90_000;
const MAX_RETRY_DELAY_MS = 60_000;

/** An answer that retrying will not change: a 4xx, or an API error body. */
export class WikimediaRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WikimediaRequestError";
  }
}

const sleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * HTTP access to Wikidata and Wikipedia, following the Wikimedia API etiquette:
 * a descriptive User-Agent with a contact, one request at a time, and backing
 * off on 429, 5xx and `maxlag` rather than retrying straight away.
 *
 * https://meta.wikimedia.org/wiki/User-Agent_policy
 */
@Injectable()
export class WikimediaHttpService {
  private readonly logger = new Logger(WikimediaHttpService.name);
  readonly userAgent: string;

  constructor(config: ConfigService<Env, true>) {
    const contact = config.get("WIKIMEDIA_CONTACT", { infer: true });
    if (!contact) {
      this.logger.warn(
        "WIKIMEDIA_CONTACT is not set: Wikimedia asks API clients to identify a contact (URL or email) in their User-Agent, and may throttle anonymous ones.",
      );
    }
    this.userAgent = `maladie-masters/0.1 (${contact || "contact not configured"}) node-fetch`;
  }

  async getJson<T>(
    url: string,
    params: Record<string, string>,
    accept = "application/json",
  ): Promise<T> {
    const target = new URL(url);
    for (const [key, value] of Object.entries(params)) {
      target.searchParams.set(key, value);
    }

    let lastError: unknown;

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
      try {
        const response = await fetch(target, {
          headers: {
            "User-Agent": this.userAgent,
            "Api-User-Agent": this.userAgent,
            Accept: accept,
          },
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        });

        if (response.status === 429 || response.status >= 500) {
          lastError = new Error(`${target.host} answered ${response.status}`);
          await this.backOff(attempt, response.headers.get("retry-after"));
          continue;
        }

        if (!response.ok) {
          throw new WikimediaRequestError(
            `${target.host} answered ${response.status}: ${(await response.text()).slice(0, 200)}`,
          );
        }

        const body = (await response.json()) as T & {
          error?: { code?: string; info?: string };
        };

        // The action API reports replication lag as a 200 with an error body.
        if (body.error?.code === "maxlag") {
          lastError = new Error(
            `${target.host} is lagging: ${body.error.info ?? ""}`,
          );
          await this.backOff(attempt, response.headers.get("retry-after"));
          continue;
        }
        if (body.error) {
          throw new WikimediaRequestError(
            `${target.host} API error ${body.error.code}: ${body.error.info ?? ""}`,
          );
        }

        return body;
      } catch (error) {
        if (error instanceof WikimediaRequestError) {
          throw error;
        }
        // Network failure or timeout: worth another attempt.
        lastError = error;
        if (attempt < MAX_ATTEMPTS) {
          await this.backOff(attempt, null);
        }
      }
    }

    throw lastError instanceof Error
      ? lastError
      : new Error(`Request to ${target.host} failed`);
  }

  private async backOff(attempt: number, retryAfter: string | null) {
    const announced = Number(retryAfter) * 1000;
    const delay = Math.min(
      MAX_RETRY_DELAY_MS,
      Number.isFinite(announced) && announced > 0
        ? announced
        : 2 ** attempt * 1000,
    );
    this.logger.warn(`Wikimedia request failed, retrying in ${delay} ms`);
    await sleep(delay);
  }
}
