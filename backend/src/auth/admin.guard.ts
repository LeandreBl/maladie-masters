import {
  CanActivate,
  ExecutionContext,
  HttpStatus,
  Injectable,
} from "@nestjs/common";
import { UserRole } from "@prisma/client";
import { AppException } from "../common/app.exception";
import { ErrorCode } from "../common/error-code.enum";

@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();

    if (request.user?.role !== UserRole.ADMIN) {
      throw new AppException(
        ErrorCode.ADMIN_REQUIRED,
        HttpStatus.FORBIDDEN,
        "Admin role required",
      );
    }

    return true;
  }
}
