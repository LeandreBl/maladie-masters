import { ApiProperty } from "@nestjs/swagger";
import { IsBoolean } from "class-validator";

export class DiscordAccountDto {
  @ApiProperty({ example: "drhouse" })
  username!: string;

  @ApiProperty({ description: "Whether the player's legendary drops are announced." })
  announce!: boolean;

  @ApiProperty({ format: "date-time" })
  linkedAt!: string;
}

export class DiscordLinkCodeDto {
  @ApiProperty({ example: "K7PQ-3MZA", description: "To type in Discord: `/maladie link code:K7PQ-3MZA`." })
  code!: string;

  @ApiProperty({ format: "date-time" })
  expiresAt!: string;
}

export class DiscordStatusDto {
  @ApiProperty({ description: "False when the server runs without a Discord bot: hide the feature." })
  enabled!: boolean;

  @ApiProperty({
    nullable: true,
    type: String,
    description: "Adds the bot to a server the visitor manages. Null when the bot is off.",
  })
  inviteUrl!: string | null;

  @ApiProperty({ nullable: true, type: DiscordAccountDto })
  account!: DiscordAccountDto | null;

  @ApiProperty({ nullable: true, type: DiscordLinkCodeDto, description: "The code still waiting to be typed, if any." })
  pendingCode!: DiscordLinkCodeDto | null;
}

export class UpdateDiscordDto {
  @ApiProperty()
  @IsBoolean()
  announce!: boolean;
}
