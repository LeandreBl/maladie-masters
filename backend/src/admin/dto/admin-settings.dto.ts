import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  Max,
  Min,
  ValidateNested,
} from "class-validator";

const weight = () => [Type(() => Number), IsNumber({ allowNaN: false, allowInfinity: false }), Min(0), Max(1000)];
const applyAll =
  (decorators: PropertyDecorator[]): PropertyDecorator =>
  (target, key) => {
    for (const decorator of decorators) decorator(target, key);
  };

/** A slot's weights, as received: each between 0 and 1000. */
export class RarityWeightsDto {
  @ApiProperty() @applyAll(weight()) COMMON!: number;
  @ApiProperty() @applyAll(weight()) UNCOMMON!: number;
  @ApiProperty() @applyAll(weight()) RARE!: number;
  @ApiProperty() @applyAll(weight()) EPIC!: number;
  @ApiProperty() @applyAll(weight()) LEGENDARY!: number;
}

export class RarityOddsDto {
  @ApiProperty() COMMON!: number;
  @ApiProperty() UNCOMMON!: number;
  @ApiProperty() RARE!: number;
  @ApiProperty() EPIC!: number;
  @ApiProperty() LEGENDARY!: number;
}

export class PackSlotDto {
  @ApiProperty({ minimum: 1, maximum: 15, example: 3, description: "Slots of this kind in a pack." })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(15)
  count!: number;

  @ApiProperty({
    type: RarityOddsDto,
    description: "Relative weight of each rarity for one slot of this kind. They need not add up to 100.",
  })
  @ValidateNested()
  @Type(() => RarityWeightsDto)
  weights!: RarityWeightsDto;
}

export class GameSettingsDto {
  @ApiProperty({ example: 10 }) packIntervalMinutes!: number;
  @ApiProperty({ example: 10 }) packMaxStored!: number;

  @ApiProperty({
    type: [PackSlotDto],
    description: "The booster, from the common slots to the rare slot. See `DEFAULT_PACK_SLOTS`.",
  })
  packSlots!: PackSlotDto[];

  @ApiProperty({ example: 5, description: "Total of the slots' `count`." })
  cardsPerPack!: number;

  @ApiProperty({ example: 10000, description: "A drawn card comes out shiny one time in N, any rarity." })
  shinyOneIn!: number;

  @ApiProperty({ description: "Percent of the catalog, from the most viewed." }) shareLegendary!: number;
  @ApiProperty() shareEpic!: number;
  @ApiProperty() shareRare!: number;
  @ApiProperty() shareUncommon!: number;

  @ApiProperty() syncEnabled!: boolean;
  @ApiProperty() syncIntervalHours!: number;
  @ApiProperty() pageviewsWindowDays!: number;

  @ApiProperty({
    type: RarityOddsDto,
    description: "Share of each rarity among dropped cards, in percent.",
  })
  expectedDropPct!: RarityOddsDto;

  @ApiProperty({
    type: RarityOddsDto,
    description: "Chance that a pack holds at least one card of each rarity, in percent: 100 / value is \"one pack in N\".",
  })
  packHitPct!: RarityOddsDto;

  @ApiProperty({ format: "date-time" }) updatedAt!: string;
}

const int = (min: number, max: number) => [
  IsOptional(),
  Type(() => Number),
  IsInt(),
  Min(min),
  Max(max),
];
const num = (min: number, max: number) => [
  IsOptional(),
  Type(() => Number),
  IsNumber({ allowNaN: false, allowInfinity: false }),
  Min(min),
  Max(max),
];
export class UpdateGameSettingsDto {
  @ApiPropertyOptional({ minimum: 1, maximum: 1440 })
  @applyAll(int(1, 1440))
  packIntervalMinutes?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: 100 })
  @applyAll(int(1, 100))
  packMaxStored?: number;

  @ApiPropertyOptional({
    type: [PackSlotDto],
    description: "Replaces the whole booster. At most 15 cards in all; every slot needs one weight above zero.",
  })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => PackSlotDto)
  packSlots?: PackSlotDto[];

  @ApiPropertyOptional({ minimum: 1, maximum: 1000000, description: "One drawn card in N comes out shiny." })
  @applyAll(int(1, 1_000_000))
  shinyOneIn?: number;

  @ApiPropertyOptional({ minimum: 0, maximum: 100 })
  @applyAll(num(0, 100))
  shareLegendary?: number;

  @ApiPropertyOptional({ minimum: 0, maximum: 100 })
  @applyAll(num(0, 100))
  shareEpic?: number;

  @ApiPropertyOptional({ minimum: 0, maximum: 100 })
  @applyAll(num(0, 100))
  shareRare?: number;

  @ApiPropertyOptional({ minimum: 0, maximum: 100 })
  @applyAll(num(0, 100))
  shareUncommon?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  syncEnabled?: boolean;

  @ApiPropertyOptional({ minimum: 1, maximum: 720 })
  @applyAll(int(1, 720))
  syncIntervalHours?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: 60 })
  @applyAll(int(1, 60))
  pageviewsWindowDays?: number;
}
