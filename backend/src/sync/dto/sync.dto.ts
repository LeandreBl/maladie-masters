import { ApiProperty } from "@nestjs/swagger";
import { SyncRunStatus, SyncTrigger } from "@prisma/client";

export class SyncLogLineDto {
  @ApiProperty({ format: "date-time" })
  at!: string;

  @ApiProperty()
  message!: string;
}

export class SyncRunDto {
  @ApiProperty({ format: "uuid" })
  id!: string;

  @ApiProperty({ enum: SyncRunStatus, enumName: "SyncRunStatus" })
  status!: SyncRunStatus;

  @ApiProperty({ enum: SyncTrigger, enumName: "SyncTrigger" })
  trigger!: SyncTrigger;

  @ApiProperty({ nullable: true, type: String, description: "Email of the admin who launched it." })
  triggeredBy!: string | null;

  @ApiProperty({ nullable: true, type: String, description: "What a running sync is doing." })
  phase!: string | null;

  @ApiProperty({ format: "date-time" })
  startedAt!: string;

  @ApiProperty({ nullable: true, type: String, format: "date-time" })
  finishedAt!: string | null;

  @ApiProperty({ nullable: true, type: Number, description: "Run time in seconds." })
  durationSeconds!: number | null;

  @ApiProperty({ description: "Diseases found in Wikidata." })
  fetched!: number;

  @ApiProperty({ description: "New cards." })
  created!: number;

  @ApiProperty({ description: "Existing cards refreshed." })
  updated!: number;

  @ApiProperty({ description: "Cards no longer found in Wikidata." })
  missing!: number;

  @ApiProperty({ description: "Missing cards found again." })
  restored!: number;

  @ApiProperty({ nullable: true, type: String })
  error!: string | null;
}

export class SyncRunDetailDto extends SyncRunDto {
  @ApiProperty({ type: [SyncLogLineDto] })
  log!: SyncLogLineDto[];
}

export class SyncRunPageDto {
  @ApiProperty({ type: [SyncRunDto] })
  items!: SyncRunDto[];

  @ApiProperty()
  total!: number;

  @ApiProperty()
  page!: number;

  @ApiProperty()
  pageSize!: number;
}

export class SyncStatusDto {
  @ApiProperty({ nullable: true, type: SyncRunDetailDto, description: "The run in progress, if any." })
  running!: SyncRunDetailDto | null;

  @ApiProperty({ nullable: true, type: SyncRunDto })
  lastRun!: SyncRunDto | null;

  @ApiProperty({ description: "Whether the schedule is on." })
  enabled!: boolean;

  @ApiProperty()
  intervalHours!: number;

  @ApiProperty({
    nullable: true,
    type: String,
    format: "date-time",
    description: "When the scheduler will next start a run. Null when the schedule is off.",
  })
  nextScheduledAt!: string | null;

  @ApiProperty({ type: [String], example: ["fr.wikipedia.org", "en.wikipedia.org", "zh.wikipedia.org"] })
  wikipediaHosts!: string[];
}
