import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { RelationshipStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

import { TrimString } from '../../../common/validators';
import { PaginationDTO } from '../../../user/dto/user-dto';

const UPDATABLE_RELATIONSHIP_STATUSES = [
  RelationshipStatus.active,
  RelationshipStatus.paused,
  RelationshipStatus.terminated,
] as const;

export class RequestRelationshipDTO {
  @ApiProperty({ example: '22222222-2222-4222-8222-222222222222' })
  @IsUUID('4', { message: 'coach_id must be a valid UUID' })
  coach_id: string;

  @ApiPropertyOptional({ example: 'Looking for boxing coaching twice a week.' })
  @IsOptional()
  @TrimString()
  @IsString({ message: 'notes must be a string' })
  @MaxLength(500, { message: 'notes must not exceed 500 characters' })
  notes?: string;
}

export class UpdateRelationshipDTO {
  @ApiProperty({
    enum: UPDATABLE_RELATIONSHIP_STATUSES,
    example: RelationshipStatus.active,
  })
  @IsIn(UPDATABLE_RELATIONSHIP_STATUSES, {
    message: `status must be one of: ${UPDATABLE_RELATIONSHIP_STATUSES.join(', ')}`,
  })
  status: (typeof UPDATABLE_RELATIONSHIP_STATUSES)[number];

  @ApiPropertyOptional({ example: 'Member confirmed the weekly schedule.' })
  @IsOptional()
  @TrimString()
  @IsString({ message: 'notes must be a string' })
  @MaxLength(500, { message: 'notes must not exceed 500 characters' })
  notes?: string;
}

export class CreateReviewDTO {
  @ApiProperty({ example: '33333333-3333-4333-8333-333333333333' })
  @IsUUID('4', { message: 'appointment_id must be a valid UUID' })
  appointment_id: string;

  @ApiProperty({ example: 5 })
  @Type(() => Number)
  @IsInt({ message: 'rating must be an integer' })
  @Min(1, { message: 'rating must be at least 1' })
  @Max(5, { message: 'rating must not exceed 5' })
  rating: number;

  @ApiPropertyOptional({ example: 'Very clear guidance and a great session.' })
  @IsOptional()
  @TrimString()
  @IsString({ message: 'comment must be a string' })
  @MaxLength(1000, { message: 'comment must not exceed 1000 characters' })
  comment?: string;
}

export class CoachClientFilterDTO extends PaginationDTO {}

export class RelationshipUserProfileResponseDTO {
  @ApiPropertyOptional({ example: 'Maria', nullable: true })
  first_name: string | null;

  @ApiPropertyOptional({ example: 'Santos', nullable: true })
  last_name: string | null;

  @ApiPropertyOptional({
    example: 'https://cdn.fittrack.test/avatars/maria-santos.png',
    nullable: true,
  })
  avatar_url: string | null;
}

export class RelationshipCoachSummaryResponseDTO {
  @ApiProperty({ example: '22222222-2222-4222-8222-222222222222' })
  id: string;

  @ApiPropertyOptional({ example: 'Strength and conditioning', nullable: true })
  specialization: string | null;

  @ApiProperty({ example: true })
  is_available_for_booking: boolean;

  @ApiProperty({ type: RelationshipUserProfileResponseDTO })
  profile: RelationshipUserProfileResponseDTO;
}

export class RelationshipMemberSummaryResponseDTO {
  @ApiProperty({ example: '44444444-4444-4444-8444-444444444444' })
  id: string;

  @ApiProperty({ type: RelationshipUserProfileResponseDTO })
  profile: RelationshipUserProfileResponseDTO;
}

export class RelationshipResponseDTO {
  @ApiProperty({ example: '55555555-5555-4555-8555-555555555555' })
  id: string;

  @ApiProperty({ example: '22222222-2222-4222-8222-222222222222' })
  coach_id: string;

  @ApiProperty({ example: '44444444-4444-4444-8444-444444444444' })
  member_id: string;

  @ApiProperty({
    enum: RelationshipStatus,
    example: RelationshipStatus.pending,
  })
  status: RelationshipStatus;

  @ApiPropertyOptional({
    example: 'Looking for boxing coaching twice a week.',
    nullable: true,
  })
  notes: string | null;

  @ApiPropertyOptional({ example: '2026-04-01T08:00:00.000Z', nullable: true })
  started_at: string | null;

  @ApiPropertyOptional({ example: '2026-05-01T08:00:00.000Z', nullable: true })
  ended_at: string | null;

  @ApiProperty({ example: '2026-03-25T08:00:00.000Z' })
  created_at: string;

  @ApiProperty({ example: '2026-03-25T08:00:00.000Z' })
  updated_at: string;

  @ApiProperty({ type: RelationshipCoachSummaryResponseDTO })
  coach: RelationshipCoachSummaryResponseDTO;

  @ApiProperty({ type: RelationshipMemberSummaryResponseDTO })
  member: RelationshipMemberSummaryResponseDTO;
}

export class CoachingReviewResponseDTO {
  @ApiProperty({ example: '66666666-6666-4666-8666-666666666666' })
  id: string;

  @ApiProperty({ example: '22222222-2222-4222-8222-222222222222' })
  coach_id: string;

  @ApiProperty({ example: '44444444-4444-4444-8444-444444444444' })
  reviewer_id: string;

  @ApiProperty({ example: '33333333-3333-4333-8333-333333333333' })
  appointment_id: string;

  @ApiProperty({ example: 5 })
  rating: number;

  @ApiPropertyOptional({
    example: 'Very clear guidance and a great session.',
    nullable: true,
  })
  comment: string | null;

  @ApiProperty({ example: '4.75' })
  coach_average_rating: string;

  @ApiProperty({ example: 12 })
  coach_rating_count: number;

  @ApiProperty({ example: '2026-03-25T08:00:00.000Z' })
  created_at: string;

  @ApiProperty({ example: '2026-03-25T08:00:00.000Z' })
  updated_at: string;
}
