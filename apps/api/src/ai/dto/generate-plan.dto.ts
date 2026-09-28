import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

import { TrimString } from '../../common/validators';

export class GeneratePlanDTO {
  @ApiProperty({ example: 8 })
  @Type(() => Number)
  @IsInt({ message: 'duration_weeks must be an integer' })
  @Min(1, { message: 'duration_weeks must be at least 1' })
  @Max(52, { message: 'duration_weeks must not exceed 52' })
  duration_weeks: number;

  @ApiProperty({ example: 4 })
  @Type(() => Number)
  @IsInt({ message: 'days_per_week must be an integer' })
  @Min(1, { message: 'days_per_week must be at least 1' })
  @Max(7, { message: 'days_per_week must not exceed 7' })
  days_per_week: number;

  @ApiPropertyOptional({
    example: 'I prefer dumbbells, lower-impact cardio, and 60-minute sessions.',
    nullable: true,
  })
  @IsOptional()
  @TrimString()
  @IsString({ message: 'preferences must be a string' })
  @MaxLength(500, { message: 'preferences must not exceed 500 characters' })
  preferences?: string;
}
