import { HttpCode, HttpStatus, Post } from "@nestjs/common";
import { ApiServiceUnavailableResponse } from "@nestjs/swagger";
import type { User } from "@prisma/client";
import { ApiAuthenticatedController } from "../auth/api-controller.decorators";
import { CurrentUser } from "../auth/current-user.decorator";
import { ApiErrorResponseDto } from "../common/dto/api-error-response.dto";
import { ApiEndpoint, ApiTag } from "../common/swagger";
import { RealtimeTicketDto } from "./dto/realtime-ticket.dto";
import { RealtimeService, TICKET_TTL_SECONDS } from "./realtime.service";

@ApiAuthenticatedController(ApiTag.Realtime, "v1/realtime")
export class RealtimeController {
  constructor(private readonly realtime: RealtimeService) {}

  @Post("ticket")
  @HttpCode(HttpStatus.OK)
  @ApiEndpoint({
    summary: "Get a ticket for the websocket relay",
    description: [
      `Valid ${TICKET_TTL_SECONDS} seconds, for one connection. The socket receives the caller's own events,`,
      "the ones for everyone and, for an admin, the admin feed. Ask for a new ticket on every reconnect:",
      "the relay closes the socket when the player's rights change.",
    ].join(" "),
    response: "Ticket issued",
    type: RealtimeTicketDto,
  })
  @ApiServiceUnavailableResponse({
    description: "Redis is not configured or unreachable (`REALTIME_UNAVAILABLE`).",
    type: ApiErrorResponseDto,
  })
  ticket(@CurrentUser() user: User): Promise<RealtimeTicketDto> {
    return this.realtime.issueTicket(user);
  }
}
