import { applyDecorators, type Type } from "@nestjs/common";
import {
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
} from "@nestjs/swagger";
import {
  ApiForbiddenErrorResponse,
  ApiNotFoundErrorResponse,
  ApiValidationErrorResponse,
} from "./api-error-responses";

/** A response DTO, or the same DTO wrapped in an array for a collection. */
export type ApiResponseType = Type<unknown> | [Type<unknown>];

export interface ApiEndpointOptions {
  /** Operation title, shown as the one-line label in Swagger UI. */
  summary: string;
  /** Longer prose under the summary: behaviour and side effects, not shapes. */
  description?: string;
  /** Body of the success response. Omit it for routes that return nothing. */
  type?: ApiResponseType;
  /** What the success response means, e.g. "Pack opened". */
  response?: string;
  /** Document the success as `201 Created` rather than `200 OK`. */
  created?: boolean;
  /** Add the `400` response. Set it on any route taking a body or a query. */
  validation?: boolean;
  /** Add the `404` response. Set it on any route resolving a path parameter. */
  notFound?: boolean;
  /** Add a `403` response with this wording, for rules beyond the guards. */
  forbidden?: string;
}

/**
 * One decorator per route instead of the four it used to take. It carries the
 * operation prose, the success response and the error responses the route can
 * actually produce, so the spec stays complete without every controller
 * repeating the same `@ApiOkResponse` / `@ApiNotFoundResponse` stack.
 *
 * Authentication errors are not listed here: the controller decorators declare
 * them once for every route they cover.
 */
export function ApiEndpoint({
  summary,
  description,
  type,
  response,
  created = false,
  validation = false,
  notFound = false,
  forbidden,
}: ApiEndpointOptions) {
  const success = { description: response ?? summary, type };
  const decorators = [
    ApiOperation({ summary, description }),
    created ? ApiCreatedResponse(success) : ApiOkResponse(success),
  ];

  if (validation) {
    decorators.push(ApiValidationErrorResponse());
  }

  if (notFound) {
    decorators.push(ApiNotFoundErrorResponse());
  }

  if (forbidden) {
    decorators.push(ApiForbiddenErrorResponse(forbidden));
  }

  return applyDecorators(...decorators);
}
