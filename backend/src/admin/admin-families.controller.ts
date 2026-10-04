import { Body, Delete, Get, HttpCode, HttpStatus, Patch, Post } from "@nestjs/common";
import type { User } from "@prisma/client";
import { ApiAdminController } from "../auth/api-controller.decorators";
import { CurrentUser } from "../auth/current-user.decorator";
import type { AppLocale } from "../common/locale";
import { ApiLocalized, RequestLocale } from "../common/request-locale.decorator";
import { ApiEndpoint, ApiTag, UuidParam } from "../common/swagger";
import { AdminFamiliesService } from "./admin-families.service";
import {
  AdminFamilyDto,
  FamiliesResolvedDto,
  FamilyPreviewDto,
  FamilyPreviewResultDto,
  SaveFamilyDto,
} from "./dto/admin-families.dto";

@ApiAdminController(ApiTag.AdminFamilies, "v1/admin/families")
export class AdminFamiliesController {
  constructor(private readonly families: AdminFamiliesService) {}

  @Get()
  @ApiEndpoint({
    summary: "List the families",
    description: "Every family, hidden ones included, with its members and how many players completed it.",
    response: "Families returned",
    type: [AdminFamilyDto],
  })
  @ApiLocalized()
  list(@RequestLocale() locale: AppLocale): Promise<AdminFamilyDto[]> {
    return this.families.list(locale);
  }

  @Post("preview")
  @HttpCode(HttpStatus.OK)
  @ApiEndpoint({
    summary: "Preview what rules select",
    description:
      "Runs the rules over the catalog without saving anything: what each rule matches, the members, and one page of the cards in or out. A rule that cannot run is reported and matches nothing.",
    response: "Preview returned",
    type: FamilyPreviewResultDto,
    validation: true,
  })
  @ApiLocalized()
  preview(
    @Body() dto: FamilyPreviewDto,
    @RequestLocale() locale: AppLocale,
  ): Promise<FamilyPreviewResultDto> {
    return this.families.preview(dto, locale);
  }

  @Post("resolve")
  @HttpCode(HttpStatus.OK)
  @ApiEndpoint({
    summary: "Re-resolve every family",
    description:
      "The sync does it after every import; this is for a Wikidata class that changed since. A family whose rules cannot run keeps its members.",
    response: "Families resolved",
    type: FamiliesResolvedDto,
  })
  resolveAll(@CurrentUser() actor: User): Promise<FamiliesResolvedDto> {
    return this.families.resolveAll(actor);
  }

  @Post()
  @ApiEndpoint({
    summary: "Create a family",
    description: "Refused when a rule cannot run (`INVALID_FAMILY_RULE`). The members are resolved straight away.",
    response: "Family created",
    type: AdminFamilyDto,
    created: true,
    validation: true,
  })
  @ApiLocalized()
  create(
    @CurrentUser() actor: User,
    @Body() dto: SaveFamilyDto,
    @RequestLocale() locale: AppLocale,
  ): Promise<AdminFamilyDto> {
    return this.families.create(actor, dto, locale);
  }

  @Get(":id")
  @ApiEndpoint({
    summary: "Get a family",
    response: "Family returned",
    type: AdminFamilyDto,
    notFound: true,
  })
  @ApiLocalized()
  detail(
    @UuidParam("id", "Identifier of the family") id: string,
    @RequestLocale() locale: AppLocale,
  ): Promise<AdminFamilyDto> {
    return this.families.detail(id, locale);
  }

  @Patch(":id")
  @ApiEndpoint({
    summary: "Replace a family's settings and rules",
    description: "Refused when a rule cannot run (`INVALID_FAMILY_RULE`). The members are resolved again.",
    response: "Family updated",
    type: AdminFamilyDto,
    validation: true,
    notFound: true,
  })
  @ApiLocalized()
  update(
    @CurrentUser() actor: User,
    @UuidParam("id", "Identifier of the family") id: string,
    @Body() dto: SaveFamilyDto,
    @RequestLocale() locale: AppLocale,
  ): Promise<AdminFamilyDto> {
    return this.families.update(actor, id, dto, locale);
  }

  @Delete(":id")
  @ApiEndpoint({
    summary: "Delete a family",
    description: "Its bonus leaves every score that had it. The cards are untouched.",
    response: "Family deleted",
    notFound: true,
  })
  remove(
    @CurrentUser() actor: User,
    @UuidParam("id", "Identifier of the family") id: string,
  ): Promise<{ id: string; removed: boolean }> {
    return this.families.remove(actor, id);
  }
}
