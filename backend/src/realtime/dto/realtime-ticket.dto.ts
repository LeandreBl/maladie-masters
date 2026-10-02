import { ApiProperty } from "@nestjs/swagger";

export class RealtimeTicketDto {
  @ApiProperty({
    description:
      "Single-use pass for the websocket relay: open `<relay>/ws?ticket=<ticket>` before it expires.",
  })
  ticket!: string;

  @ApiProperty({ format: "date-time" })
  expiresAt!: string;
}
