import { Global, Module } from "@nestjs/common";
import { AdminGuard } from "./admin.guard";
import { AuthGuard } from "./auth.guard";
import { FirebaseAuthService } from "./firebase-auth.service";
import { FirebaseService } from "./firebase.service";

@Global()
@Module({
  providers: [FirebaseService, FirebaseAuthService, AuthGuard, AdminGuard],
  exports: [FirebaseService, FirebaseAuthService, AuthGuard, AdminGuard],
})
export class AuthModule {}
