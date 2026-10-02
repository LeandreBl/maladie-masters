import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from "@nestjs/common";
import { Response } from "express";
import { AppException } from "./app.exception";
import { ErrorCode } from "./error-code.enum";

type HttpErrorLike = {
  status?: unknown;
  statusCode?: unknown;
  message?: unknown;
};

@Catch()
export class AppExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    if (exception instanceof AppException) {
      const body = exception.getResponse() as {
        code: string;
        message: string;
      };

      response.status(exception.getStatus()).json({
        code: body.code,
        message: body.message,
      });
      return;
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();
      const message =
        typeof body === "string"
          ? body
          : this.stringifyMessage(
              (body as Record<string, unknown>).message ?? "Error",
            );

      response.status(status).json({
        code: ErrorCode.UNKNOWN_ERROR,
        message,
      });
      return;
    }

    const httpError = this.parseHttpError(exception);
    if (httpError) {
      response.status(httpError.status).json({
        code: httpError.code,
        message: httpError.message,
      });
      return;
    }

    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      code: ErrorCode.INTERNAL_ERROR,
      message: "Internal server error",
    });
  }

  private parseHttpError(exception: unknown) {
    if (!exception || typeof exception !== "object") {
      return null;
    }

    const error = exception as HttpErrorLike;
    const status =
      this.statusCode(error.status) ?? this.statusCode(error.statusCode);
    if (!status) {
      return null;
    }

    const isPayloadTooLarge = status === HttpStatus.PAYLOAD_TOO_LARGE;

    return {
      status,
      code: isPayloadTooLarge
        ? ErrorCode.PAYLOAD_TOO_LARGE
        : ErrorCode.UNKNOWN_ERROR,
      message:
        typeof error.message === "string"
          ? error.message
          : isPayloadTooLarge
            ? "Payload too large"
            : "Error",
    };
  }

  private stringifyMessage(message: unknown) {
    if (Array.isArray(message)) {
      return message.join("; ");
    }

    return typeof message === "string" ? message : "Error";
  }

  private statusCode(value: unknown) {
    return typeof value === "number" && value >= 400 && value < 600
      ? value
      : null;
  }
}
