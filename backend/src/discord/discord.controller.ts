import { Body, Delete, Get, Patch, Post } from "@nestjs/common";
import { ApiServiceUnavailableResponse } from "@nestjs/swagger";
import type { User } from "@prisma/client";
import { ApiAuthenticatedController } from "../auth/api-controller.decorators";
import { CurrentUser } from "../auth/current-user.decorator";
import { ApiErrorResponseDto } from "../common/dto/api-error-response.dto";
import { ApiEndpoint, ApiTag } from "../common/swagger";
import { DiscordLinkService } from "./discord-link.service";
import { DiscordLinkCodeDto, DiscordStatusDto, UpdateDiscordDto } from "./dto/discord.dto";

@ApiAuthenticatedController(ApiTag.Discord, "v1/me/discord")
export class DiscordController {
  constructor(private readonly links: DiscordLinkService) {}

  @Get()
  @ApiEndpoint({
    summary: "Get the caller's Discord link",
    description: "Also gives the link that adds the bot to a server, and whether the bot runs at all.",
    response: "Discord status returned",
    type: DiscordStatusDto,
  })
  status(@CurrentUser() user: User): Promise<DiscordStatusDto> {
    return this.links.status(user.id);
  }

  @Post("link-code")
  @ApiEndpoint({
    summary: "Get a code to link a Discord account",
    description:
      "Valid 10 minutes, and replaces the previous code. The player types it in Discord: `/maladie link code:XXXX-XXXX`.",
    response: "Code created",
    type: DiscordLinkCodeDto,
    created: true,
  })
  @ApiServiceUnavailableResponse({
    description: "The bot is not configured on this server (`DISCORD_DISABLED`).",
    type: ApiErrorResponseDto,
  })
  createCode(@CurrentUser() user: User): Promise<DiscordLinkCodeDto> {
    return this.links.createCode(user.id);
  }

  @Patch()
  @ApiEndpoint({
    summary: "Turn the caller's legendary announcements on or off",
    response: "Discord status returned",
    type: DiscordStatusDto,
    validation: true,
    notFound: true,
  })
  update(@CurrentUser() user: User, @Body() dto: UpdateDiscordDto): Promise<DiscordStatusDto> {
    return this.links.setAnnounce(user.id, dto.announce);
  }

  @Delete()
  @ApiEndpoint({
    summary: "Unlink the caller's Discord account",
    response: "Discord status returned",
    type: DiscordStatusDto,
  })
  unlink(@CurrentUser() user: User): Promise<DiscordStatusDto> {
    return this.links.unlink(user.id);
  }
}
