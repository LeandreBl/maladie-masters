import { resolve } from "node:path";
import { config as loadDotenv } from "dotenv";

/**
 * Every environment variable the backend reads, declared in one place.
 *
 * A variable that is set, even to "", is checked by `validator` then turned by
 * `format` into what the code uses. A variable that is not set takes `default`
 * (trusted as is, only formatted), or stops the start-up when it has none.
 *
 * Nothing starts when a value is wrong: every problem is collected and thrown
 * together, with what the variable is for and how to obtain it.
 */
export interface EnvVariable<T = unknown> {
  /** Turns the validated raw string into the value the code uses. */
  format: (value: string) => T;
  /** Raw value used when the variable is not set ("" is a valid default). None: required. */
  default?: string;
  /** What the variable controls. */
  description: string;
  /** How to obtain or choose a value. */
  help: string;
  /** `true` when the raw value is acceptable, otherwise why it is not. */
  validator: (value: string) => true | string;
  /** Never echo the value in errors (passwords, connection strings). */
  secret?: boolean;
}

// --- Validators ---------------------------------------------------------------

const list = (value: string): string[] =>
  value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

const isAnything = (): true => true;

const isNotBlank = (value: string): true | string =>
  value.trim() ? true : "must not be blank";

const isOneOf =
  (choices: readonly string[]) =>
  (value: string): true | string =>
    choices.includes(value) ? true : `must be one of: ${choices.join(", ")}`;

const isBoolean = isOneOf(["true", "false"]);

const isInteger =
  (min: number, max = Number.MAX_SAFE_INTEGER) =>
  (value: string): true | string => {
    const parsed = Number(value);
    return /^\d+$/.test(value.trim()) && parsed >= min && parsed <= max
      ? true
      : `must be an integer between ${min} and ${max}`;
  };

const isUrl =
  (
    protocols: readonly string[],
    { allowEmpty = false, originOnly = false } = {},
  ) =>
  (value: string): true | string => {
    if (allowEmpty && value === "") return true;

    const expected = `must be a ${originOnly ? "scheme://host[:port] origin" : "URL"} (${protocols.join(", ")})`;
    try {
      const url = new URL(value);
      if (!protocols.includes(url.protocol)) return expected;
      if (originOnly && url.origin !== value.replace(/\/$/, ""))
        return expected;
      return true;
    } catch {
      return expected;
    }
  };

const each =
  (validate: (item: string) => true | string, what: string) =>
  (value: string): true | string => {
    for (const item of list(value)) {
      const result = validate(item);
      if (result !== true) return `"${item}" is not a valid ${what}: ${result}`;
    }
    return true;
  };

const EMAIL = /^[^\s@,]+@[^\s@,]+\.[^\s@,]+$/;
const HOST = /^\.?[a-z0-9-]+(\.[a-z0-9-]+)*(:\d+)?$/i;
const PROXY_KEYWORDS = ["loopback", "linklocal", "uniquelocal"];
const IP_OR_SUBNET = /^[0-9a-f:.]+(\/\d{1,3})?$/i;

// --- Formats ------------------------------------------------------------------

const asString = (value: string): string => value;
const asInteger = (value: string): number => Number(value);
const asBoolean = (value: string): boolean => value === "true";

// --- Variables ----------------------------------------------------------------

/** Keyed by the variable's name in the `.env` file and the process environment. */
export const ENV_VARIABLES = {
  NODE_ENV: {
    format: (value) => value as "development" | "production" | "test",
    default: "development",
    description:
      "Runtime mode: production disables pretty logs and Swagger (unless SWAGGER_ENABLED).",
    help: "The Docker image sets production. Leave unset for local development.",
    validator: isOneOf(["development", "production", "test"]),
  },
  PORT: {
    format: asInteger,
    default: "3000",
    description: "Port the HTTP server listens on.",
    help: "Any free port. In Docker it stays 3000; the published host port is BACKEND_PORT.",
    validator: isInteger(1, 65535),
  },
  DATABASE_URL: {
    format: asString,
    description: "PostgreSQL connection string used by Prisma.",
    help:
      "postgresql://USER:PASSWORD@HOST:PORT/DATABASE, password percent-encoded. In Docker, " +
      "docker/start.sh builds it from POSTGRES_USER, POSTGRES_PASSWORD and POSTGRES_DB; locally, " +
      "use the port published by compose (POSTGRES_PORT, 5433 by default).",
    validator: isUrl(["postgresql:", "postgres:"]),
    secret: true,
  },
  REDIS_URL: {
    format: asString,
    default: "redis://localhost:6380",
    description:
      "Redis used for real time: the backend publishes events there and the websocket relay fans them out.",
    help:
      "redis://HOST:PORT, without the password (see REDIS_PASSWORD). In Docker it is " +
      "redis://redis:6379; locally, the port published by compose (REDIS_PORT, 6380 by default). " +
      "Empty disables real time: the API works the same, the fronts just stop updating live.",
    validator: isUrl(["redis:", "rediss:"], { allowEmpty: true }),
  },
  REDIS_PASSWORD: {
    format: asString,
    default: "",
    description: "Password of the Redis server (requirepass).",
    help: "The same REDIS_PASSWORD as the redis service in .env, e.g. `openssl rand -base64 32`.",
    validator: isAnything,
    secret: true,
  },
  GOOGLE_APPLICATION_CREDENTIALS: {
    format: asString,
    default: "/run/secrets/firebase-service-account.json",
    description:
      "Path to the Firebase service account JSON used to verify sign-in tokens.",
    help:
      "Firebase console > Project settings > Service accounts > Generate new private key, " +
      "saved as secrets/firebase-service-account.json (mounted at /run/secrets in Docker).",
    validator: isNotBlank,
  },
  ADMINS: {
    format: (value) => list(value).map((email) => email.toLowerCase()),
    default: "",
    description: "Emails granted the admin role at every boot.",
    help: "Comma-separated emails of the Google accounts that sign in to the admin panel.",
    validator: each(
      (email) => (EMAIL.test(email) ? true : "expected name@domain.tld"),
      "email",
    ),
  },
  FRONTEND_ORIGIN: {
    format: (value) => list(value).map((origin) => origin.replace(/\/$/, "")),
    default: "http://localhost:5173,http://localhost:5174",
    description:
      "Origins allowed by CORS: the player front and the admin panel.",
    help: "Comma-separated origins as the browser shows them, e.g. https://maladie-masters.example.com.",
    validator: (value) =>
      list(value).length === 0
        ? "must list at least one origin"
        : each(
            isUrl(["http:", "https:"], { originOnly: true }),
            "origin",
          )(value),
  },
  BACKEND_ALLOWED_HOSTS: {
    format: (value) =>
      list(value)
        .map((host) => host.toLowerCase())
        .filter((host) => host !== "*"),
    default: "",
    description:
      "Host headers the API answers to; anything else gets a 403. Empty or * disables the check.",
    help:
      "Comma-separated public hostnames of the API, e.g. api.maladie-masters.example.com. " +
      "A leading dot (.example.com) also matches subdomains.",
    validator: each(
      (host) =>
        host === "*" || HOST.test(host) ? true : "expected a hostname",
      "host",
    ),
  },
  TRUST_PROXY: {
    format: (value): boolean | number | string => {
      if (value === "" || value === "false") return false;
      if (/^\d+$/.test(value)) return Number(value);
      return value;
    },
    default: "",
    description:
      "Express 'trust proxy': which X-Forwarded-For hops to trust for the client IP (rate limiting).",
    help:
      "Behind Traefik, 1 (one proxy hop). Only set it when a proxy really rewrites " +
      "X-Forwarded-For, otherwise clients choose their own IP. Also accepts IPs/subnets " +
      "or loopback, linklocal, uniquelocal.",
    validator: (value) =>
      value === "" || value === "false" || /^\d+$/.test(value)
        ? true
        : each(
            (item) =>
              PROXY_KEYWORDS.includes(item) || IP_OR_SUBNET.test(item)
                ? true
                : "expected a hop count, an IP, a subnet or a keyword",
            "proxy",
          )(value),
  },
  WIKIMEDIA_CONTACT: {
    format: (value) => value.trim(),
    default: "",
    description:
      "Contact put in the User-Agent of Wikidata/Wikipedia requests.",
    help:
      "The project URL or an email. Wikimedia asks API clients to identify themselves and " +
      "may throttle anonymous ones: https://meta.wikimedia.org/wiki/User-Agent_policy",
    validator: isAnything,
  },
  DISCORD_APPLICATION_ID: {
    format: (value) => value.trim(),
    default: "",
    description:
      "Discord application ID of the bot that announces legendary drops. Empty: the bot is off.",
    help:
      "https://discord.com/developers/applications > your app > General Information > Application ID. " +
      "The three DISCORD_* variables go together.",
    validator: (value) =>
      value === "" || /^\d{17,20}$/.test(value.trim())
        ? true
        : "must be a Discord snowflake (digits)",
  },
  DISCORD_PUBLIC_KEY: {
    format: (value) => value.trim().toLowerCase(),
    default: "",
    description:
      "Key Discord signs its interactions with; requests that do not verify are refused.",
    help: "Same page as the Application ID: Public Key (64 hex characters).",
    validator: (value) =>
      value === "" || /^[0-9a-f]{64}$/i.test(value.trim())
        ? true
        : "must be 64 hex characters",
  },
  DISCORD_BOT_TOKEN: {
    format: (value) => value.trim(),
    default: "",
    description:
      "Token the bot posts messages and registers its slash commands with.",
    help: "Developer portal > your app > Bot > Reset Token. Never commit it.",
    validator: isAnything,
    secret: true,
  },
  SWAGGER_ENABLED: {
    format: asBoolean,
    default: "false",
    description:
      "Serves Swagger UI in production. It is always served outside production.",
    help: "true or false.",
    validator: isBoolean,
  },
  BACKEND_PUBLIC_URL: {
    format: asString,
    default: "",
    description:
      "Public URL of the API, listed as a server in the OpenAPI document.",
    help: "e.g. https://api.maladie-masters.example.com. Leave empty to omit it.",
    validator: isUrl(["http:", "https:"], { allowEmpty: true }),
  },
  THROTTLE_DEFAULT_PER_MINUTE: {
    format: asInteger,
    default: "300",
    description: "Requests per minute allowed per user (or IP) on every route.",
    help: "A positive integer.",
    validator: isInteger(1),
  },
  THROTTLE_PACK_PER_MINUTE: {
    format: asInteger,
    default: "30",
    description: "Pack openings per minute allowed per user.",
    help: "A positive integer.",
    validator: isInteger(1),
  },
  THROTTLE_IP_PER_MINUTE: {
    format: asInteger,
    default: "1200",
    description:
      "Requests per minute allowed per IP address, all routes and callers together.",
    help:
      "A positive integer, well above THROTTLE_DEFAULT_PER_MINUTE: players behind one " +
      "school or office address share it. Needs TRUST_PROXY behind a reverse proxy.",
    validator: isInteger(1),
  },
} satisfies Record<string, EnvVariable>;

type Variables = typeof ENV_VARIABLES;
export type EnvName = keyof Variables;

/** The validated configuration, as exposed by `ConfigService<Env, true>`. */
export type Env = {
  [N in EnvName]: ReturnType<Variables[N]["format"]>;
};

// --- Loading ------------------------------------------------------------------

export class EnvValidationError extends Error {
  constructor(readonly problems: string[]) {
    super(
      `Invalid environment configuration (${problems.length} problem${problems.length > 1 ? "s" : ""}):\n\n` +
        problems.join("\n\n"),
    );
    this.name = "EnvValidationError";
  }
}

type Parsed<T> = { ok: true; value: T } | { ok: false; problem: string };

function parse<T>(
  name: string,
  definition: EnvVariable<T>,
  source: NodeJS.ProcessEnv,
): Parsed<T> {
  const raw = source[name];

  let reason: true | string;
  let received = "";
  if (raw === undefined) {
    if (definition.default !== undefined) {
      return { ok: true, value: definition.format(definition.default) };
    }
    reason = "is required but not set";
  } else {
    reason = definition.validator(raw);
    if (reason === true) {
      return { ok: true, value: definition.format(raw) };
    }
    received = definition.secret ? " (value hidden)" : ` (got "${raw}")`;
  }

  return {
    ok: false,
    problem:
      `  ✗ ${name}${received}: ${reason}\n` +
      `      description: ${definition.description}\n` +
      `      help:        ${definition.help}`,
  };
}

let dotenvLoaded = false;

/**
 * Loads `.env` from the working directory into `process.env` without
 * overriding what is already set (Docker passes everything as real variables).
 */
function loadDotenvOnce(): void {
  if (dotenvLoaded) return;
  loadDotenv({ path: resolve(process.cwd(), ".env"), quiet: true });
  dotenvLoaded = true;
}

let cached: Env | undefined;

/**
 * Validates the whole environment once and caches it. Throws an
 * `EnvValidationError` listing every wrong variable.
 */
export function getEnv(): Env {
  if (cached) return cached;
  loadDotenvOnce();

  const env: Record<string, unknown> = {};
  const problems: string[] = [];
  for (const [name, definition] of Object.entries(ENV_VARIABLES)) {
    const parsed = parse<unknown>(name, definition, process.env);
    if (parsed.ok) env[name] = parsed.value;
    else problems.push(parsed.problem);
  }

  if (problems.length > 0) throw new EnvValidationError(problems);
  cached = env as Env;
  return cached;
}

/**
 * Validates a single variable, for tools that do not need the rest (the
 * OpenAPI generator runs without a database).
 */
export function getEnvVariable<N extends EnvName>(name: N): Env[N] {
  loadDotenvOnce();
  const parsed = parse<unknown>(name, ENV_VARIABLES[name], process.env);
  if (!parsed.ok) throw new EnvValidationError([parsed.problem]);
  return parsed.value as Env[N];
}

/**
 * `getEnv()` for entry points: prints the report and exits instead of
 * throwing, since a stack trace would only bury the useful part.
 */
export function getEnvOrExit(): Env {
  try {
    return getEnv();
  } catch (error) {
    if (!(error instanceof EnvValidationError)) throw error;
    process.stderr.write(`\n${error.message}\n\n`);
    process.exit(1);
  }
}
