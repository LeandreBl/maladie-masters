import {
  CanActivate,
  ExecutionContext,
  HttpStatus,
  Injectable,
} from "@nestjs/common";
import { AppException } from "../common/app.exception";
import { ErrorCode } from "../common/error-code.enum";
import { FirebaseAuthService } from "./firebase-auth.service";

/**
 * Resolves the `Authorization: Bearer` Firebase ID token into the player and
 * puts it on `request.user`. Suspended players are refused here, on every
 * route, so a suspension takes effect on the very next request.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly firebaseAuth: FirebaseAuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization;

    if (!authHeader?.startsWith("Bearer ")) {
      throw new AppException(
        ErrorCode.MISSING_AUTH_HEADER,
        HttpStatus.UNAUTHORIZED,
        "Missing or invalid authorization header",
      );
    }

    const token = authHeader.slice("Bearer ".length).trim();
    if (!token) {
      throw new AppException(
        ErrorCode.MISSING_AUTH_HEADER,
        HttpStatus.UNAUTHORIZED,
        "Missing or invalid authorization header",
      );
    }

    request.user = await this.firebaseAuth.authenticate(
      token,
      request.headers["accept-language"],
    );
    return true;
  }
}
