import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { PackSource, Rarity } from "@prisma/client";
import { CardDto } from "../../cards/dto/card.dto";

export class PackWalletDto {
  @ApiProperty({ description: "Packs that can be opened right now: natural + bonus." })
  available!: number;

  @ApiProperty({ description: "Packs from the timer, up to `maxStored`." })
  natural!: number;

  @ApiProperty({ description: "Packs granted by an admin, on top of the cap." })
  bonus!: number;

  @ApiProperty({ example: 10 })
  maxStored!: number;

  @ApiProperty({ example: 10 })
  intervalMinutes!: number;

  @ApiProperty({
    nullable: true,
    type: String,
    format: "date-time",
    description: "When the next natural pack arrives. Null while the wallet is full.",
  })
  nextPackAt!: string | null;

  @ApiProperty({
    nullable: true,
    type: String,
    format: "date-time",
    description: "When the natural packs reach the cap. Null while already there.",
  })
  fullAt!: string | null;

  @ApiProperty({
    format: "date-time",
    description: "The server's clock, to correct a client countdown for drift.",
  })
  serverTime!: string;
}

export class DroppedCardDto {
  @ApiProperty({ description: "Position in the pack, from 0. The last slot is the guaranteed one." })
  slot!: number;

  @ApiProperty({ enum: Rarity, enumName: "Rarity", description: "Rarity at the time of the drop." })
  rarity!: Rarity;

  @ApiProperty({ description: "First copy of this card for the player." })
  isNew!: boolean;

  @ApiProperty({
    description: "A shiny copy: one drawn card in `shinyOneIn` (10,000 by default), any rarity. Show it with its special effect.",
  })
  isShiny!: boolean;

  @ApiProperty({ type: CardDto })
  card!: CardDto;
}

export class PackOpeningDto {
  @ApiProperty({ format: "uuid" })
  id!: string;

  @ApiProperty({ enum: PackSource, enumName: "PackSource" })
  source!: PackSource;

  @ApiProperty({ format: "date-time" })
  openedAt!: string;

  @ApiProperty({ type: [DroppedCardDto] })
  cards!: DroppedCardDto[];

  @ApiPropertyOptional({
    type: PackWalletDto,
    description: "The wallet after the opening. Only on `POST /v1/me/packs/open`.",
  })
  wallet?: PackWalletDto;
}

export class PackHistoryPageDto {
  @ApiProperty({ type: [PackOpeningDto] })
  items!: PackOpeningDto[];

  @ApiProperty()
  total!: number;

  @ApiProperty()
  page!: number;

  @ApiProperty()
  pageSize!: number;
}
