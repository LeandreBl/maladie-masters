import { Injectable } from "@nestjs/common";
import { CollectionService } from "../cards/collection.service";
import { PacksService } from "../packs/packs.service";
import { PrismaService } from "../prisma/prisma.service";
import type { MeDto, UpdateMeDto } from "./dto/me.dto";

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly packs: PacksService,
    private readonly collection: CollectionService,
  ) {}

  async me(userId: string): Promise<MeDto> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });
    const [packs, collection] = await Promise.all([
      this.packs.wallet(userId),
      this.collection.summary(userId),
    ]);

    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      photoUrl: user.photoUrl,
      role: user.role,
      locale: user.locale,
      createdAt: user.createdAt.toISOString(),
      packs,
      collection,
    };
  }

  async update(userId: string, dto: UpdateMeDto): Promise<MeDto> {
    if (dto.displayName !== undefined || dto.locale !== undefined) {
      await this.prisma.user.update({
        where: { id: userId },
        data: { displayName: dto.displayName, locale: dto.locale },
      });
    }
    return this.me(userId);
  }
}
