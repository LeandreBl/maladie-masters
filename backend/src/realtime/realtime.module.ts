import { Global, Module } from "@nestjs/common";
import { RealtimeService } from "./realtime.service";

/**
 * The publisher, global so any service can report an event. The ticket route
 * lives in `RealtimeApiModule`: the sync CLI publishes too, without serving
 * HTTP.
 */
@Global()
@Module({
  providers: [RealtimeService],
  exports: [RealtimeService],
})
export class RealtimeModule {}
