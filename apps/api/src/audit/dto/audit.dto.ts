import { Type } from 'class-transformer';
import {
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UserRole, UserStatus } from '@prisma/client';

import { IsOnOrAfter, TrimString } from '../../common/validators';

export class PaginationDTO {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'page must be an integer' })
  @Min(1, { message: 'page must be at least 1' })
  page?: number = 1;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'limit must be an integer' })
  @Min(1, { message: 'limit must be at least 1' })
  @Max(100, { message: 'limit must not exceed 100' })
  limit?: number = 20;
}

export class AuditFilterDTO extends PaginationDTO {
  @ApiPropertyOptional({ example: 'User' })
  @IsOptional()
  @TrimString()
  @IsString({ message: 'entity must be a string' })
  @MaxLength(100, { message: 'entity must not exceed 100 characters' })
  entity?: string;

  @ApiPropertyOptional({
    example: '11111111-1111-4111-8111-111111111111',
  })
  @IsOptional()
  @IsUUID('4', { message: 'entity_id must be a valid UUID' })
  entity_id?: string;

  @ApiPropertyOptional({
    example: '22222222-2222-4222-8222-222222222222',
  })
  @IsOptional()
  @IsUUID('4', { message: 'user_id must be a valid UUID' })
  user_id?: string;

  @ApiPropertyOptional({ example: 'USER_STATUS_CHANGED' })
  @IsOptional()
  @TrimString()
  @IsString({ message: 'action must be a string' })
  @MaxLength(100, { message: 'action must not exceed 100 characters' })
  action?: string;

  @ApiPropertyOptional({ example: '2026-03-01' })
  @IsOptional()
  @IsISO8601({}, { message: 'start_date must be a valid ISO 8601 date string' })
  start_date?: string;

  @ApiPropertyOptional({ example: '2026-03-31' })
  @IsOptional()
  @IsISO8601({}, { message: 'end_date must be a valid ISO 8601 date string' })
  @IsOnOrAfter('start_date', 'start_date', {
    message: 'end_date must be on or after start_date',
  })
  end_date?: string;
}

export class AuditActorProfileResponseDTO {
  @ApiPropertyOptional({ example: 'Maria', nullable: true })
  first_name: string | null;

  @ApiPropertyOptional({ example: 'Santos', nullable: true })
  last_name: string | null;
}

export class AuditActorResponseDTO {
  @ApiProperty({
    example: '22222222-2222-4222-8222-222222222222',
  })
  id: string;

  @ApiProperty({ enum: UserRole, example: UserRole.admin })
  role: UserRole;

  @ApiProperty({ enum: UserStatus, example: UserStatus.active })
  status: UserStatus;

  @ApiPropertyOptional({
    type: () => AuditActorProfileResponseDTO,
    nullable: true,
  })
  profile: AuditActorProfileResponseDTO | null;
}

export class AuditLogResponseDTO {
  @ApiProperty({
    example: '33333333-3333-4333-8333-333333333333',
  })
  id: string;

  @ApiPropertyOptional({
    example: '22222222-2222-4222-8222-222222222222',
    nullable: true,
  })
  user_id: string | null;

  @ApiProperty({
    type: () => AuditActorResponseDTO,
    nullable: true,
  })
  actor: AuditActorResponseDTO | null;

  @ApiProperty({ example: 'USER_STATUS_CHANGED' })
  action: string;

  @ApiProperty({ example: 'User' })
  entity: string;

  @ApiProperty({ example: '11111111-1111-4111-8111-111111111111' })
  entity_id: string;

  @ApiPropertyOptional({
    type: Object,
    additionalProperties: true,
    nullable: true,
  })
  before: unknown;

  @ApiPropertyOptional({
    type: Object,
    additionalProperties: true,
    nullable: true,
  })
  after: unknown;

  @ApiPropertyOptional({
    example: '127.0.0.1',
    nullable: true,
  })
  ip_address: string | null;

  @ApiProperty({ example: '2026-03-28T03:00:00.000Z' })
  created_at: string;
}
