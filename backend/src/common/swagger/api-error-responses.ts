import { applyDecorators } from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiPayloadTooLargeResponse,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import { ApiErrorResponseDto } from "../dto/api-error-response.dto";

/**
 * Every failure the API returns shares the `ApiErrorResponseDto` body, so the
 * response decorators only differ by status code and wording. They live here
 * rather than on each route: a client can branch on the machine-readable
 * `code` field and never has to parse a message.
 */
export function ApiAuthErrorResponses() {
  return applyDecorators(
    ApiForbiddenResponse({
      description:
        "The account is suspended (`ACCOUNT_SUSPENDED`), or its email is not verified (`EMAIL_NOT_VERIFIED`).",
      type: ApiErrorResponseDto,
    }),
    ApiUnauthorizedResponse({
      description:
        "Missing, malformed or expired bearer token (`MISSING_AUTH_HEADER`, `INVALID_TOKEN`).",
      type: ApiErrorResponseDto,
    }),
  );
}

export function ApiAdminErrorResponses() {
  return applyDecorators(
    ApiAuthErrorResponses(),
    ApiForbiddenResponse({
      description: "The authenticated user is not an admin (`ADMIN_REQUIRED`), or is suspended (`ACCOUNT_SUSPENDED`).",
      type: ApiErrorResponseDto,
    }),
  );
}

export function ApiValidationErrorResponse() {
  return applyDecorators(
    ApiBadRequestResponse({
      description:
        "Request body or query string rejected by validation. Unknown properties are refused too.",
      type: ApiErrorResponseDto,
    }),
  );
}

export function ApiNotFoundErrorResponse() {
  return applyDecorators(
    ApiNotFoundResponse({
      description:
        "The resource does not exist, or the caller is not allowed to see it.",
      type: ApiErrorResponseDto,
    }),
  );
}

export function ApiForbiddenErrorResponse(description: string) {
  return applyDecorators(
    ApiForbiddenResponse({ description, type: ApiErrorResponseDto }),
  );
}

export function ApiPayloadTooLargeErrorResponse() {
  return applyDecorators(
    ApiPayloadTooLargeResponse({
      description:
        "Uploaded file is larger than the configured limit (`PAYLOAD_TOO_LARGE`).",
      type: ApiErrorResponseDto,
    }),
  );
}
