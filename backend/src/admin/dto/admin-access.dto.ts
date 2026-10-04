import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsEmail, IsOptional, IsUUID } from "class-validator";
import { PageQueryDto } from "../../common/pagination";

export class AdminEmailDto {
  @ApiProperty({ example: "admin@example.com" })
  @IsEmail()
  email!: string;
}

export class AdminGrantDto {
  @ApiProperty({ format: "email" })
  email!: string;

  @ApiProperty({ format: "date-time" })
  createdAt!: string;

  @ApiProperty({ description: "Whether a player has signed in with this address." })
  hasSignedIn!: boolean;

  @ApiProperty({
    description: "Granted by the ADMINS variable: the panel can neither revoke it nor delete its account.",
  })
  bootstrap!: boolean;
}

export class AdminRemovalDto {
  @ApiProperty({ format: "email" }) email!: string;
  @ApiProperty() removed!: boolean;
}

class AuditActorDto {
  @ApiProperty({ format: "uuid" }) id!: string;
  @ApiProperty({ format: "email" }) email!: string;
}

class AuditTargetDto extends AuditActorDto {
  @ApiProperty({ nullable: true, type: String }) displayName!: string | null;
}

export class AuditEntryDto {
  @ApiProperty({ format: "uuid" }) id!: string;

  @ApiProperty({ example: "packs.granted" })
  action!: string;

  @ApiProperty({ nullable: true, type: AuditActorDto })
  actor!: AuditActorDto | null;

  @ApiProperty({ nullable: true, type: AuditTargetDto })
  targetUser!: AuditTargetDto | null;

  @ApiProperty({ type: "object", additionalProperties: true })
  metadata!: Record<string, unknown>;

  @ApiProperty({ format: "date-time" }) createdAt!: string;
}

export class AuditPageDto {
  @ApiProperty({ type: [AuditEntryDto] }) items!: AuditEntryDto[];
  @ApiProperty() total!: number;
  @ApiProperty() page!: number;
  @ApiProperty() pageSize!: number;
}

export class AuditQueryDto extends PageQueryDto {
  @ApiPropertyOptional({ format: "uuid", description: "Only the actions on this player." })
  @IsOptional()
  @IsUUID()
  targetUserId?: string;
}
