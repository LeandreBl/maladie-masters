import { HttpStatus, Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { UserRole, type User } from "@prisma/client";
import { AuditAction, AuditService } from "../audit/audit.service";
import { AppException } from "../common/app.exception";
import { ErrorCode } from "../common/error-code.enum";
import type { Env } from "../config/env";
import { PrismaService } from "../prisma/prisma.service";
import { RealtimeService } from "../realtime/realtime.service";
import type { AdminGrantDto, AdminRemovalDto } from "./dto/admin-access.dto";

/**
 * Admin grants, keyed by email so an address can be promoted before its owner
 * ever signs in. The `ADMINS` variable seeds them at boot, so a fresh install
 * is never without an admin.
 *
 * Those grants are the root of trust: the panel cannot revoke them, nor delete
 * their accounts. Otherwise one hijacked admin account could lock the owners
 * out — until the next boot, which would quietly hand the rights back.
 */
@Injectable()
export class AdminAccessService implements OnModuleInit {
  private readonly logger = new Logger(AdminAccessService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<Env, true>,
    private readonly audit: AuditService,
    private readonly realtime: RealtimeService,
  ) {}

  async onModuleInit() {
    const emails = this.bootstrapEmails();
    if (emails.size === 0) return;

    await Promise.all([...emails].map((email) => this.grant(email)));
    this.logger.log(`Bootstrap admins ensured for ${[...emails].join(", ")}`);
  }

  async list(): Promise<AdminGrantDto[]> {
    const grants = await this.prisma.adminGrant.findMany({
      orderBy: { email: "asc" },
    });
    const users = await this.prisma.user.findMany({
      where: { email: { in: grants.map((grant) => grant.email) } },
      select: { email: true },
    });
    const signedIn = new Set(users.map((user) => user.email));

    return grants.map((grant) => ({
      email: grant.email,
      createdAt: grant.createdAt.toISOString(),
      hasSignedIn: signedIn.has(grant.email),
      bootstrap: this.isBootstrap(grant.email),
    }));
  }

  /** Whether `email` is listed in `ADMINS`, hence out of the panel's reach. */
  isBootstrap(email: string): boolean {
    const normalized = this.normalize(email);
    return !!normalized && this.bootstrapEmails().has(normalized);
  }

  /** Refuses an action that would take an `ADMINS` address its rights. */
  assertNotBootstrap(email: string): void {
    if (this.isBootstrap(email)) {
      throw new AppException(
        ErrorCode.BOOTSTRAP_ADMIN_PROTECTED,
        HttpStatus.FORBIDDEN,
        "This admin is granted by the ADMINS variable: remove it from there",
      );
    }
  }

  async add(actor: User, email: string): Promise<AdminGrantDto> {
    const normalized = this.normalize(email);
    if (!normalized) {
      throw new AppException(
        ErrorCode.USER_NOT_FOUND,
        HttpStatus.BAD_REQUEST,
        "Invalid admin email",
      );
    }

    const grant = await this.grant(normalized);
    await this.audit.record(actor.id, AuditAction.AdminGranted, { email: normalized });
    const user = await this.prisma.user.findUnique({ where: { email: normalized } });
    // A connected player gets the admin feed on reconnection.
    if (user) this.realtime.disconnect(user.id);
    return {
      email: grant.email,
      createdAt: grant.createdAt.toISOString(),
      hasSignedIn: !!user,
      bootstrap: this.isBootstrap(grant.email),
    };
  }

  async remove(actor: User, email: string): Promise<AdminRemovalDto> {
    const normalized = this.normalize(email) ?? "";
    const [grant, count] = await Promise.all([
      this.prisma.adminGrant.findUnique({ where: { email: normalized } }),
      this.prisma.adminGrant.count(),
    ]);

    if (!grant) {
      throw new AppException(
        ErrorCode.ADMIN_GRANT_NOT_FOUND,
        HttpStatus.NOT_FOUND,
        "Admin grant not found",
      );
    }
    this.assertNotBootstrap(normalized);
    if (count <= 1) {
      throw new AppException(
        ErrorCode.LAST_ADMIN_REMOVAL_FORBIDDEN,
        HttpStatus.FORBIDDEN,
        "Cannot remove the last admin",
      );
    }

    await this.prisma.$transaction([
      this.prisma.adminGrant.delete({ where: { email: normalized } }),
      this.prisma.user.updateMany({
        where: { email: normalized },
        data: { role: UserRole.USER },
      }),
    ]);
    await this.audit.record(actor.id, AuditAction.AdminRevoked, { email: normalized });
    // An open admin socket would keep receiving the admin feed otherwise.
    const user = await this.prisma.user.findUnique({
      where: { email: normalized },
      select: { id: true },
    });
    if (user) this.realtime.disconnect(user.id);
    return { email: normalized, removed: true };
  }

  private async grant(email: string) {
    const [grant] = await this.prisma.$transaction([
      this.prisma.adminGrant.upsert({
        where: { email },
        update: {},
        create: { email },
      }),
      this.prisma.user.updateMany({
        where: { email },
        data: { role: UserRole.ADMIN, suspendedAt: null, suspendedReason: null },
      }),
    ]);
    return grant;
  }

  private bootstrapEmails(): Set<string> {
    return new Set(
      this.config
        .get("ADMINS", { infer: true })
        .map((email) => this.normalize(email))
        .filter((email): email is string => !!email),
    );
  }

  private normalize(email?: string | null): string | null {
    return email?.trim().toLowerCase() || null;
  }
}
