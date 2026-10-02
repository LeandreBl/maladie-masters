import { Module } from "@nestjs/common";
import { RealtimeController } from "./realtime.controller";

@Module({
  controllers: [RealtimeController],
})
export class RealtimeApiModule {}
