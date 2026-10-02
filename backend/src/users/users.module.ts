import { Module } from "@nestjs/common";
import { CardsModule } from "../cards/cards.module";
import { PacksModule } from "../packs/packs.module";
import { UsersController } from "./users.controller";
import { UsersService } from "./users.service";

@Module({
  imports: [CardsModule, PacksModule],
  controllers: [UsersController],
  providers: [UsersService],
})
export class UsersModule {}
