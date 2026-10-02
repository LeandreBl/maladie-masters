import { Body, Delete, Get, Post, Query } from "@nestjs/common";
import type { User } from "@prisma/client";
import { ApiAdminController } from "../auth/api-controller.decorators";
import { CurrentUser } from "../auth/current-user.decorator";
import { AuditService } from "../audit/audit.service";
import { ApiEndpoint, ApiTag, DocumentedParam } from "../common/swagger";
import { AdminAccessService } from "./admin-access.service";
import {
  AdminEmailDto,
  AdminGrantDto,
  AdminRemovalDto,
  AuditPageDto,
  AuditQueryDto,
} from "./dto/admin-access.dto";

@ApiAdminController(ApiTag.AdminAccess, "v1/admin")
export class AdminAccessController {
  constructor(
    private readonly access: AdminAccessService,
    private readonly audit: AuditService,
  ) {}

  @Get("admins")
  @ApiEndpoint({
    summary: "List admin grants",
    response: "Admin grants returned",
    type: [AdminGrantDto],
  })
  list(): Promise<AdminGrantDto[]> {
    return this.access.list();
  }

  @Post("admins")
  @ApiEndpoint({
    summary: "Grant the admin role to an email",
    description:
      "Idempotent. An existing player is promoted — and unsuspended — at once, otherwise the role applies on first sign-in.",
    response: "Admin grant created or already present",
    type: AdminGrantDto,
    created: true,
    validation: true,
  })
  add(@CurrentUser() actor: User, @Body() dto: AdminEmailDto): Promise<AdminGrantDto> {
    return this.access.add(actor, dto.email);
  }

  @Delete("admins/:email")
  @ApiEndpoint({
    summary: "Revoke the admin role from an email",
    response: "Admin grant removed",
    type: AdminRemovalDto,
    notFound: true,
    forbidden: "Removing it would leave no admin (`LAST_ADMIN_REMOVAL_FORBIDDEN`).",
  })
  remove(
    @CurrentUser() actor: User,
    @DocumentedParam("email", {
      description: "Email address the grant is keyed by.",
      example: "admin@example.com",
      schema: { type: "string", format: "email" },
    })
    email: string,
  ): Promise<AdminRemovalDto> {
    return this.access.remove(actor, email);
  }

  @Get("audit")
  @ApiEndpoint({
    summary: "The audit trail of admin actions",
    response: "Entries returned",
    type: AuditPageDto,
    validation: true,
  })
  auditTrail(@Query() query: AuditQueryDto): Promise<AuditPageDto> {
    return this.audit.page(query, query.targetUserId);
  }
}
