import { Module } from "@nestjs/common";
import { WikipediaModule } from "../wikipedia/wikipedia.module";
import { FamiliesService } from "./families.service";
import { FamilyMatcherService } from "./family-matcher.service";

/**
 * Families without routes: used by the collection (bonus points), the packs
 * (families a pack completes), the sync (new cards may belong) and the admin
 * routes.
 */
@Module({
  imports: [WikipediaModule],
  providers: [FamiliesService, FamilyMatcherService],
  exports: [FamiliesService, FamilyMatcherService],
})
export class FamiliesCoreModule {}
