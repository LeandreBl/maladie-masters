import { Param } from "@nestjs/common";
import { ApiParam } from "@nestjs/swagger";
import type { ApiParamOptions } from "@nestjs/swagger";

export const UUID_EXAMPLE = "9ad1e3de-a9af-4e2f-8d3d-4d6f6c85439a";

/**
 * `ApiParamOptions` is a union, and a plain `Omit` over a union keeps only the
 * properties every member shares, which would drop `schema` and `format`.
 * Distributing the omit preserves each member intact.
 */
export type PathParamOptions = ApiParamOptions extends infer Option
  ? Option extends unknown
    ? Omit<Option, "name">
    : never
  : never;

/**
 * Binds a path parameter *and* documents it in one go.
 *
 * `@Param("id")` alone leaves the spec with an untyped, undescribed parameter,
 * and adding `@ApiParam({ name: "id" })` next to it would repeat the name on
 * every route. This applies the swagger metadata to the enclosing method
 * itself, so the name is written once, at the place it is consumed.
 */
export function DocumentedParam(
  name: string,
  options: PathParamOptions,
): ParameterDecorator {
  return (target, propertyKey, parameterIndex) => {
    const descriptor =
      propertyKey === undefined
        ? undefined
        : Object.getOwnPropertyDescriptor(target, propertyKey);

    if (descriptor && propertyKey !== undefined) {
      ApiParam({ name, ...options })(target, propertyKey, descriptor);
    }

    Param(name)(target, propertyKey, parameterIndex);
  };
}

/** A path parameter holding a v4 UUID, which is most of them. */
export function UuidParam(
  name: string,
  description: string,
): ParameterDecorator {
  return DocumentedParam(name, {
    description,
    example: UUID_EXAMPLE,
    schema: { type: "string", format: "uuid" },
  });
}
