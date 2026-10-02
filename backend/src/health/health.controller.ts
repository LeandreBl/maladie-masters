import { Controller, Get } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { ApiEndpoint, ApiTag } from "../common/swagger";
import { HealthResponseDto } from "./dto/health-response.dto";

@ApiTags(ApiTag.Health)
@Controller()
export class HealthController {
  @Get("health")
  @ApiEndpoint({
    summary: "Health check",
    description:
      "Unauthenticated. Answers as soon as the process is serving traffic; it does not probe PostgreSQL.",
    response: "Service is healthy",
    type: HealthResponseDto,
  })
  health(): HealthResponseDto {
    return { status: "ok" };
  }
}
