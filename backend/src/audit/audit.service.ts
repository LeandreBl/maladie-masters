import { Injectable } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { pageWindow, type PageQueryDto } from "../common/pagination";
import { PrismaService } from "../prisma/prisma.service";
import { RealtimeService } from "../realtime/realtime.service";

/**
 * The machine names of admin actions. The panel translates them; an unknown
 * one is shown as is, so adding an action never breaks the trail.
 */
export const AuditAction = {
  PacksGranted: "packs.granted",
  PacksRefilled: "packs.refilled",
  CardUnlocked: "card.unlocked",
  CardLocked: "card.locked",
  CardsRemoved: "cards.removed",
  CollectionReset: "collection.reset",
  CollectionsReset: "collections.reset",
  UserDeleted: "user.deleted",
  UserSuspended: "user.suspended",
  UserReactivated: "user.reactivated",
  AdminGranted: "admin.granted",
  AdminRevoked: "admin.revoked",
  CardUpdated: "card.updated",
  SettingsUpdated: "settings.updated",
  SyncStarted: "sync.started",
  RaritiesRecomputed: "rarities.recomputed",
  FamilyCreated: "family.created",
  FamilyUpdated: "family.updated",
  FamilyDeleted: "family.deleted",
  FamiliesResolved: "families.resolved",
} as const;

export type AuditActionName = (typeof AuditAction)[keyof typeof AuditAction];

export interface AuditEntryView {
  id: string;
  action: string;
  actor: { id: string; email: string } | null;
  targetUser: { id: string; email: string; displayName: string | null } | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}

@Injectable()
export class AuditService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeService,
  ) {}

  async record(
    actorId: string,
    action: AuditActionName,
    metadata: Prisma.InputJsonObject = {},
    targetUserId?: string,
  ): Promise<void> {
    await this.prisma.adminAuditEntry.create({
      data: { actorId, action, metadata, targetUserId: targetUserId ?? null },
    });
    // Every admin action ends here: one event keeps every open panel current,
    // whichever operator acted.
    this.realtime.toAdmins({
      type: "audit.recorded",
      data: { action, targetUserId: targetUserId ?? null },
    });
  }

  async page(
    query: PageQueryDto,
    targetUserId?: string,
  ): Promise<{ items: AuditEntryView[]; total: number; page: number; pageSize: number }> {
    const { page, pageSize, skip, take } = pageWindow(query);
    const where = targetUserId ? { targetUserId } : {};

    const [entries, total] = await this.prisma.$transaction([
      this.prisma.adminAuditEntry.findMany({
        where,
        include: {
          actor: { select: { id: true, email: true } },
          targetUser: { select: { id: true, email: true, displayName: true } },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take,
      }),
      this.prisma.adminAuditEntry.count({ where }),
    ]);

    return {
      items: entries.map((entry) => ({
        id: entry.id,
        action: entry.action,
        actor: entry.actor,
        targetUser: entry.targetUser,
        metadata: (entry.metadata ?? {}) as Record<string, unknown>,
        createdAt: entry.createdAt.toISOString(),
      })),
      total,
      page,
      pageSize,
    };
  }
}
