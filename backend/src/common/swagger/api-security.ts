import type { DocumentBuilder } from "@nestjs/swagger";

/**
 * `SecuritySchemeObject` is not re-exported from the package root, so it is
 * recovered from the builder method that consumes it.
 */
type SecuritySchemeDefinition = NonNullable<
  Parameters<DocumentBuilder["addBearerAuth"]>[0]
>;

export const FIREBASE_AUTH_SCHEME = "firebase";

export const FIREBASE_AUTH_SCHEME_DEFINITION: SecuritySchemeDefinition = {
  type: "http",
  scheme: "bearer",
  bearerFormat: "JWT",
  description: [
    "Firebase ID token of a signed-in player, sent as `Authorization: Bearer <token>`.",
    "Obtained by the frontend from the Firebase SDK after sign-in.",
  ].join(" "),
};
