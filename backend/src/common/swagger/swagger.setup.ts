import type { INestApplication } from "@nestjs/common";
import {
  DocumentBuilder,
  SwaggerModule,
  type OpenAPIObject,
} from "@nestjs/swagger";
import { ApiErrorResponseDto } from "../dto/api-error-response.dto";
import {
  FIREBASE_AUTH_SCHEME,
  FIREBASE_AUTH_SCHEME_DEFINITION,
} from "./api-security";
import { API_TAG_DESCRIPTIONS } from "./api-tags";

/** Where Swagger UI is mounted. The raw document is served at `<path>-json`. */
export const SWAGGER_UI_PATH = "api";

export const API_VERSION = "0.1.0";

/**
 * Written for whoever builds a client against this API — the player frontend
 * and the admin panel first: it is the first thing they read in Swagger UI, so
 * it covers the parts no individual operation can explain on its own.
 */
const API_DESCRIPTION = `
Backend API for maladie-masters: a trading card game whose cards are diseases
imported from Wikipedia. The more a disease's article is read, the rarer its
card.

## Authenticating

Every route except \`GET /health\` expects \`Authorization: Bearer <token>\`,
where the token is a **${FIREBASE_AUTH_SCHEME}** ID token. The first call with a
new account creates the player, with a full pack wallet.

Routes under \`/v1/admin\` additionally require the \`ADMIN\` role, granted by
email (\`ADMINS\` environment variable, or \`POST /v1/admin/admins\`).

## Packs

A player holds up to \`packMaxStored\` packs that refill one every
\`packIntervalMinutes\` minutes, plus any bonus packs an admin granted. The
server computes the wallet on every read: \`nextPackAt\` is the moment to show a
countdown to, there is no need to poll.

## Errors

Every failure returns the same envelope: a machine-readable \`code\` from the
\`ErrorCode\` enum and a human \`message\`. Branch on \`code\`, never on the
message text, which is free to change.

## Conventions

- Identifiers are v4 UUIDs unless documented otherwise.
- Timestamps are ISO 8601 strings in UTC.
- Unknown properties in a request body are rejected, not ignored.
- Listing routes are paginated with \`page\` / \`pageSize\` and return the
  total alongside the items.
`.trim();

function buildConfig(publicUrl?: string): Omit<OpenAPIObject, "paths"> {
  const builder = new DocumentBuilder()
    .setTitle("maladie-masters API")
    .setDescription(API_DESCRIPTION)
    .setVersion(API_VERSION)
    .addBearerAuth(FIREBASE_AUTH_SCHEME_DEFINITION, FIREBASE_AUTH_SCHEME);

  for (const [tag, description] of Object.entries(API_TAG_DESCRIPTIONS)) {
    builder.addTag(tag, description);
  }

  if (publicUrl) {
    builder.addServer(publicUrl, "Configured deployment");
  }

  return builder.build();
}

export function buildOpenApiDocument(
  app: INestApplication,
  publicUrl?: string,
): OpenAPIObject {
  return SwaggerModule.createDocument(app, buildConfig(publicUrl), {
    extraModels: [ApiErrorResponseDto],
    // `PacksController.open` reads as `Packs_open`, which most client
    // generators turn into a usable method name.
    operationIdFactory: (controllerKey, methodKey) =>
      `${controllerKey.replace(/Controller$/, "")}_${methodKey}`,
  });
}

export function setupSwagger(
  app: INestApplication,
  publicUrl?: string,
): OpenAPIObject {
  const document = buildOpenApiDocument(app, publicUrl);

  SwaggerModule.setup(SWAGGER_UI_PATH, app, document, {
    swaggerOptions: {
      persistAuthorization: true,
      tagsSorter: "alpha",
      operationsSorter: "alpha",
      docExpansion: "none",
    },
  });

  return document;
}
