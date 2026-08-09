import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AmenityType, EquipmentStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  MaxLength,
  Min,
  ValidateIf,
  ValidationArguments,
  ValidationOptions,
  registerDecorator,
} from 'class-validator';

import { TrimString } from '../../../common/validators';

const FACILITY_FLOOR_IDS = ['floor-1', 'floor-2', 'floor-3'] as const;
const VENUE_IMAGE_FITS = ['cover', 'contain'] as const;

function ReservableAmenityHourlyRate(validationOptions?: ValidationOptions) {
  return (object: object, propertyName: string | symbol) => {
    registerDecorator({
      name: 'ReservableAmenityHourlyRate',
      target: object.constructor,
      propertyName: propertyName.toString(),
      options: validationOptions,
      validator: {
        validate(value: unknown, args?: ValidationArguments): boolean {
          const dto = args?.object as { is_reservable?: boolean } | undefined;
          if (dto?.is_reservable !== true) return true;
          return (
            typeof value === 'number' && Number.isFinite(value) && value > 0
          );
        },
        defaultMessage(): string {
          return 'hourly_rate is required and must be greater than 0 when is_reservable is true';
        },
      },
    });
  };
}

export class CreateAmenityDTO {
  @ApiProperty({ example: 'Main Court' })
  @TrimString()
  @IsString({ message: 'name must be a string' })
  @IsNotEmpty({ message: 'name is required' })
  @MaxLength(100, { message: 'name must not exceed 100 characters' })
  name: string;

  @ApiProperty({ enum: AmenityType, example: AmenityType.basketball_court })
  @IsEnum(AmenityType, {
    message: `type must be one of: ${Object.values(AmenityType).join(', ')}`,
  })
  type: AmenityType;

  @ApiPropertyOptional({ enum: EquipmentStatus, nullable: true })
  @IsOptional()
  @IsEnum(EquipmentStatus, {
    message: `status must be one of: ${Object.values(EquipmentStatus).join(', ')}`,
  })
  status?: EquipmentStatus;

  @ApiPropertyOptional({
    example: 'Full-size basketball court with scoreboard access.',
  })
  @IsOptional()
  @TrimString()
  @IsString({ message: 'description must be a string' })
  @MaxLength(500, { message: 'description must not exceed 500 characters' })
  description?: string;

  @ApiPropertyOptional({ example: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'capacity must be an integer' })
  @Min(1, { message: 'capacity must be at least 1' })
  capacity?: number;

  @ApiPropertyOptional({ example: 800, default: 0 })
  @ValidateIf(
    (dto: { is_reservable?: boolean }, value: unknown) =>
      dto.is_reservable === true || value !== undefined,
  )
  @Type(() => Number)
  @IsNumber({}, { message: 'hourly_rate must be a number' })
  @Min(0, { message: 'hourly_rate must be at least 0' })
  @ReservableAmenityHourlyRate()
  hourly_rate?: number;

  @ApiPropertyOptional({ example: false, default: false })
  @IsOptional()
  @IsBoolean({ message: 'requires_subscription must be a boolean value' })
  requires_subscription?: boolean;

  @ApiPropertyOptional({ example: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'minimum_hours must be an integer' })
  @Min(1, { message: 'minimum_hours must be at least 1' })
  minimum_hours?: number;

  @ApiPropertyOptional({ example: 'basketball' })
  @IsOptional()
  @TrimString()
  @IsString({ message: 'icon_key must be a string' })
  @MaxLength(100, { message: 'icon_key must not exceed 100 characters' })
  icon_key?: string;

  @ApiPropertyOptional({
    example: 'https://cdn.fittrack.test/facilities/main-court.jpg',
    nullable: true,
  })
  @IsOptional()
  @TrimString()
  @IsUrl({}, { message: 'image_url must be a valid URL' })
  @MaxLength(500, { message: 'image_url must not exceed 500 characters' })
  image_url?: string;

  @ApiPropertyOptional({ enum: VENUE_IMAGE_FITS, default: 'cover' })
  @IsOptional()
  @IsIn(VENUE_IMAGE_FITS, { message: 'image_fit must be cover or contain' })
  image_fit?: (typeof VENUE_IMAGE_FITS)[number];

  @ApiPropertyOptional({ default: 0.5, minimum: 0, maximum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'image_focal_x must be a number' })
  @Min(0, { message: 'image_focal_x must be at least 0' })
  @Max(1, { message: 'image_focal_x must be at most 1' })
  image_focal_x?: number;

  @ApiPropertyOptional({ default: 0.5, minimum: 0, maximum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'image_focal_y must be a number' })
  @Min(0, { message: 'image_focal_y must be at least 0' })
  @Max(1, { message: 'image_focal_y must be at most 1' })
  image_focal_y?: number;

  @ApiPropertyOptional({ default: 1, minimum: 1, maximum: 4 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'image_crop_zoom must be a number' })
  @Min(1, { message: 'image_crop_zoom must be at least 1' })
  @Max(4, { message: 'image_crop_zoom must be at most 4' })
  image_crop_zoom?: number;

  @ApiPropertyOptional({ example: 9, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'grid_column must be an integer' })
  @Min(1, { message: 'grid_column must be at least 1' })
  grid_column?: number;

  @ApiPropertyOptional({ example: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'grid_row must be an integer' })
  @Min(1, { message: 'grid_row must be at least 1' })
  grid_row?: number;

  @ApiPropertyOptional({ example: 6, default: 2 })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'grid_width must be an integer' })
  @Min(1, { message: 'grid_width must be at least 1' })
  grid_width?: number;

  @ApiPropertyOptional({ example: 4, default: 2 })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'grid_height must be an integer' })
  @Min(1, { message: 'grid_height must be at least 1' })
  grid_height?: number;

  @ApiPropertyOptional({ example: true, default: true })
  @IsOptional()
  @IsBoolean({ message: 'is_reservable must be a boolean value' })
  is_reservable?: boolean;

  @ApiPropertyOptional({ example: 3, default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'display_order must be an integer' })
  @Min(0, { message: 'display_order must be at least 0' })
  display_order?: number;

  @ApiPropertyOptional({ example: 'floor-1', enum: FACILITY_FLOOR_IDS })
  @IsOptional()
  @TrimString()
  @IsString({ message: 'floor_id must be a string' })
  @IsIn(FACILITY_FLOOR_IDS, {
    message: `floor_id must be one of: ${FACILITY_FLOOR_IDS.join(', ')}`,
  })
  floor_id?: (typeof FACILITY_FLOOR_IDS)[number];
}

export class UpdateAmenityDTO {
  @ApiPropertyOptional({ example: 'Main Court' })
  @IsOptional()
  @TrimString()
  @IsString({ message: 'name must be a string' })
  @MaxLength(100, { message: 'name must not exceed 100 characters' })
  name?: string;

  @ApiPropertyOptional({
    enum: AmenityType,
    example: AmenityType.basketball_court,
  })
  @IsOptional()
  @IsEnum(AmenityType, {
    message: `type must be one of: ${Object.values(AmenityType).join(', ')}`,
  })
  type?: AmenityType;

  @ApiPropertyOptional({ enum: EquipmentStatus, nullable: true })
  @IsOptional()
  @IsEnum(EquipmentStatus, {
    message: `status must be one of: ${Object.values(EquipmentStatus).join(', ')}`,
  })
  status?: EquipmentStatus;

  @ApiPropertyOptional({
    example: 'Full-size basketball court with scoreboard access.',
  })
  @IsOptional()
  @TrimString()
  @IsString({ message: 'description must be a string' })
  @MaxLength(500, { message: 'description must not exceed 500 characters' })
  description?: string;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'capacity must be an integer' })
  @Min(1, { message: 'capacity must be at least 1' })
  capacity?: number;

  @ApiPropertyOptional({ example: 800 })
  @ValidateIf(
    (dto: { is_reservable?: boolean }, value: unknown) =>
      dto.is_reservable === true || value !== undefined,
  )
  @Type(() => Number)
  @IsNumber({}, { message: 'hourly_rate must be a number' })
  @Min(0, { message: 'hourly_rate must be at least 0' })
  @ReservableAmenityHourlyRate()
  hourly_rate?: number;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean({ message: 'requires_subscription must be a boolean value' })
  requires_subscription?: boolean;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean({ message: 'is_active must be a boolean value' })
  is_active?: boolean;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean({ message: 'is_mapped must be a boolean value' })
  is_mapped?: boolean;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'minimum_hours must be an integer' })
  @Min(1, { message: 'minimum_hours must be at least 1' })
  minimum_hours?: number;

  @ApiPropertyOptional({ example: 'basketball' })
  @IsOptional()
  @TrimString()
  @IsString({ message: 'icon_key must be a string' })
  @MaxLength(100, { message: 'icon_key must not exceed 100 characters' })
  icon_key?: string;

  @ApiPropertyOptional({
    example: 'https://cdn.fittrack.test/facilities/main-court.jpg',
    nullable: true,
  })
  @IsOptional()
  @TrimString()
  @IsUrl({}, { message: 'image_url must be a valid URL' })
  @MaxLength(500, { message: 'image_url must not exceed 500 characters' })
  image_url?: string;

  @ApiPropertyOptional({ enum: VENUE_IMAGE_FITS })
  @IsOptional()
  @IsIn(VENUE_IMAGE_FITS, { message: 'image_fit must be cover or contain' })
  image_fit?: (typeof VENUE_IMAGE_FITS)[number];

  @ApiPropertyOptional({ minimum: 0, maximum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'image_focal_x must be a number' })
  @Min(0, { message: 'image_focal_x must be at least 0' })
  @Max(1, { message: 'image_focal_x must be at most 1' })
  image_focal_x?: number;

  @ApiPropertyOptional({ minimum: 0, maximum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'image_focal_y must be a number' })
  @Min(0, { message: 'image_focal_y must be at least 0' })
  @Max(1, { message: 'image_focal_y must be at most 1' })
  image_focal_y?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: 4 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'image_crop_zoom must be a number' })
  @Min(1, { message: 'image_crop_zoom must be at least 1' })
  @Max(4, { message: 'image_crop_zoom must be at most 4' })
  image_crop_zoom?: number;

  @ApiPropertyOptional({ example: 9 })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'grid_column must be an integer' })
  @Min(1, { message: 'grid_column must be at least 1' })
  grid_column?: number;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'grid_row must be an integer' })
  @Min(1, { message: 'grid_row must be at least 1' })
  grid_row?: number;

  @ApiPropertyOptional({ example: 6 })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'grid_width must be an integer' })
  @Min(1, { message: 'grid_width must be at least 1' })
  grid_width?: number;

  @ApiPropertyOptional({ example: 4 })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'grid_height must be an integer' })
  @Min(1, { message: 'grid_height must be at least 1' })
  grid_height?: number;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean({ message: 'is_reservable must be a boolean value' })
  is_reservable?: boolean;

  @ApiPropertyOptional({ example: 3 })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'display_order must be an integer' })
  @Min(0, { message: 'display_order must be at least 0' })
  display_order?: number;

  @ApiPropertyOptional({ example: 'floor-1', enum: FACILITY_FLOOR_IDS })
  @IsOptional()
  @TrimString()
  @IsString({ message: 'floor_id must be a string' })
  @IsIn(FACILITY_FLOOR_IDS, {
    message: `floor_id must be one of: ${FACILITY_FLOOR_IDS.join(', ')}`,
  })
  floor_id?: (typeof FACILITY_FLOOR_IDS)[number];
}

export class CreateAmenityFeedbackDTO {
  @ApiProperty({ example: 5 })
  @Type(() => Number)
  @IsInt({ message: 'rating must be an integer' })
  @Min(1, { message: 'rating must be at least 1' })
  @Max(5, { message: 'rating must not exceed 5' })
  rating: number;

  @ApiPropertyOptional({
    example:
      'The court lighting was great and the lane markings were easy to follow.',
  })
  @IsOptional()
  @TrimString()
  @IsString({ message: 'comment must be a string' })
  @MaxLength(1500, { message: 'comment must not exceed 1500 characters' })
  comment?: string;
}
