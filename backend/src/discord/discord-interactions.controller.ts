import { Controller, Headers, HttpCode, HttpStatus, Post, Req, type RawBodyRequest } from "@nestjs/common";
import { ApiExcludeController } from "@nestjs/swagger";
import { SkipThrottle } from "@nestjs/throttler";
import type { Request } from "express";
import { DiscordInteractionsService, type InteractionResponse } from "./discord-interactions.service";

/**
 * The "Interactions Endpoint URL" of the Discord application: Discord POSTs
 * every slash command here, signed with the application's key. It is public
 * by nature, so the signature is the authentication. Only the per-IP ceiling
 * applies (`@SkipThrottle()` skips `default` alone): all of Discord's traffic
 * comes from a handful of addresses, far below it, while a flood of forged
 * requests from one address still meets it.
 *
 * Kept out of the OpenAPI document: only Discord calls it.
 */
@ApiExcludeController()
@SkipThrottle()
@Controller("v1/discord")
export class DiscordInteractionsController {
  constructor(private readonly interactions: DiscordInteractionsService) {}

  @Post("interactions")
  @HttpCode(HttpStatus.OK)
  handle(
    @Req() request: RawBodyRequest<Request>,
    @Headers("x-signature-ed25519") signature: string | undefined,
    @Headers("x-signature-timestamp") timestamp: string | undefined,
  ): Promise<InteractionResponse> {
    const interaction = this.interactions.verify(request.rawBody, signature, timestamp);
    return this.interactions.handle(interaction);
  }
}
