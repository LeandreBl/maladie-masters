import { applyDecorators, createParamDecorator, type ExecutionContext } from "@nestjs/common";
import { ApiPropertyOptional, ApiQuery } from "@nestjs/swagger";
import { IsIn, IsOptional } from "class-validator";
import {
  FALLBACK_LOCALE,
  LOCALES,
  localeFromAcceptLanguage,
  parseLocale,
  type AppLocale,
} from "./locale";

/**
 * The language to serve a request in:
 *
 * 1. `?lang=` — an explicit choice, such as the admin panel's language toggle;
 * 2. the account's language — what a player's app relies on;
 * 3. `Accept-Language`, for a request with no account behind it;
 * 4. English.
 */
export function resolveRequestLocale(request: {
  query?: Record<string, unknown>;
  user?: { locale?: string } | null;
  headers?: Record<string, unknown>;
}): AppLocale {
  return (
    parseLocale(request.query?.lang) ??
    parseLocale(request.user?.locale) ??
    localeFromAcceptLanguage(request.headers?.["accept-language"]) ??
    FALLBACK_LOCALE
  );
}

export const RequestLocale = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AppLocale =>
    resolveRequestLocale(context.switchToHttp().getRequest()),
);

/**
 * Documents `?lang=` on a route that has no query DTO to carry it. Routes with
 * one extend `LocaleQueryDto` instead.
 */
export function ApiLocalized() {
  return applyDecorators(
    ApiQuery({
      name: "lang",
      required: false,
      enum: LOCALES,
      description:
        "Language of the card names and articles. Defaults to the account's language; a card with no article in it falls back to English.",
    }),
  );
}

/** `?lang=`, accepted by every query DTO (see `RequestLocale`). */
export class LocaleQueryDto {
  @ApiPropertyOptional({
    enum: LOCALES,
    enumName: "Locale",
    description:
      "Language of the card names and articles. Defaults to the account's language; a card with no article in it falls back to English.",
  })
  @IsOptional()
  @IsIn(LOCALES)
  lang?: AppLocale;
}
