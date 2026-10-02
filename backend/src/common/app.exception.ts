import { HttpException, HttpStatus } from "@nestjs/common";
import { ErrorCode } from "./error-code.enum";

export class AppException extends HttpException {
  constructor(
    public readonly errorCode: ErrorCode,
    public readonly statusCode: HttpStatus,
    message: string,
  ) {
    super({ code: errorCode, message }, statusCode);
  }
}
