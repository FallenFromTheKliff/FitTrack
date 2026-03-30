import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MasteryRank } from '@prisma/client';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

import { TrimString } from '../../../common/validators/trim-string.decorator';

export class MasteryFilterDTO {
  @ApiPropertyOptional({ example: 'legs' })
  @IsOptional()
  @TrimString()
  @IsString({ message: 'muscle_group must be a string' })
  @MaxLength(100, {
    message: 'muscle_group must not exceed 100 characters',
  })
  muscle_group?: string;

  @ApiPropertyOptional({ enum: MasteryRank, example: MasteryRank.gold })
  @IsOptional()
  @IsEnum(MasteryRank, {
    message: `rank must be one of: ${Object.values(MasteryRank).join(', ')}`,
  })
  rank?: MasteryRank;
}

export class MuscleMasteryResponseDTO {
  @ApiProperty({ example: '11111111-1111-4111-8111-111111111111' })
  id: string;

  @ApiProperty({ example: '22222222-2222-4222-8222-222222222222' })
  user_id: string;

  @ApiProperty({ example: 'legs' })
  muscle_group: string;

  @ApiProperty({ example: '12500.00' })
  total_volume_kg: string;

  @ApiProperty({ example: 950 })
  xp_points: number;

  @ApiProperty({ enum: MasteryRank, example: MasteryRank.silver })
  rank: MasteryRank;

  @ApiProperty({ example: 'Silver' })
  rank_display: string;

  @ApiPropertyOptional({
    type: String,
    example: '2026-03-27T03:00:00.000Z',
    nullable: true,
  })
  last_ranked_at: string | null;

  @ApiProperty({ example: '2026-03-27T02:00:00.000Z' })
  created_at: string;

  @ApiProperty({ example: '2026-03-27T03:00:00.000Z' })
  updated_at: string;
}

export class LeaderboardEntryResponseDTO {
  @ApiProperty({ example: 1 })
  rank_position: number;

  @ApiProperty({ example: '22222222-2222-4222-8222-222222222222' })
  user_id: string;

  @ApiProperty({ example: 'Fit Track' })
  display_name: string;

  @ApiPropertyOptional({
    type: String,
    example: 'https://cdn.fittrack.test/avatars/user-1.png',
    nullable: true,
  })
  avatar_url: string | null;

  @ApiProperty({ example: 2750 })
  total_xp: number;
}
