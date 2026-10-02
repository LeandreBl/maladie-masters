import { Global, Module } from "@nestjs/common";
import { GameSettingsService } from "./game-settings.service";

@Global()
@Module({
  providers: [GameSettingsService],
  exports: [GameSettingsService],
})
export class SettingsModule {}
