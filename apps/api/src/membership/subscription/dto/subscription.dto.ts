import {
  IsEnum,
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { PaymentProvider, SubscriptionStatus } from '@prisma/client';

import { TrimString } from '../../../common/validators';

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

export class CreatePlanDTO {
  @ApiProperty({ example: 'Monthly Membership' })
  @TrimString()
  @IsString({ message: 'name must be a string' })
  @IsNotEmpty({ message: 'name is required' })
  @MaxLength(100, { message: 'name must not exceed 100 characters' })
  name: string;

  @ApiPropertyOptional({ example: 'Access to gym equipment and locker area.' })
  @IsOptional()
  @TrimString()
  @IsString({ message: 'description must be a string' })
  description?: string;

  @ApiProperty({ example: 1499 })
  @IsNumber({}, { message: 'price must be a number' })
  @IsPositive({ message: 'price must be a positive number' })
  price: number;

  @ApiProperty({ example: 30 })
  @IsInt({ message: 'duration_days must be an integer' })
  @Min(1, { message: 'duration_days must be at least 1' })
  duration_days: number;

  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: true,
    example: { locker_access: true, guest_passes: 2 },
  })
  @IsOptional()
  @IsObject({ message: 'features must be an object' })
  features?: Record<string, unknown>;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @IsInt({ message: 'sort_order must be an integer' })
  @Min(0, { message: 'sort_order must be at least 0' })
  sort_order?: number;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean({ message: 'includes_coaching must be a boolean value' })
  includes_coaching?: boolean;
}

export class UpdatePlanDTO {
  @ApiPropertyOptional({ example: 'Monthly Membership' })
  @IsOptional()
  @TrimString()
  @IsString({ message: 'name must be a string' })
  @MaxLength(100, { message: 'name must not exceed 100 characters' })
  name?: string;

  @ApiPropertyOptional({ example: 'Access to gym equipment and locker area.' })
  @IsOptional()
  @TrimString()
  @IsString({ message: 'description must be a string' })
  description?: string;

  @ApiPropertyOptional({ example: 1499 })
  @IsOptional()
  @IsNumber({}, { message: 'price must be a number' })
  @IsPositive({ message: 'price must be a positive number' })
  price?: number;

  @ApiPropertyOptional({ example: 30 })
  @IsOptional()
  @IsInt({ message: 'duration_days must be an integer' })
  @Min(1, { message: 'duration_days must be at least 1' })
  duration_days?: number;

  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: true,
    example: { locker_access: true, guest_passes: 2 },
  })
  @IsOptional()
  @IsObject({ message: 'features must be an object' })
  features?: Record<string, unknown>;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @IsInt({ message: 'sort_order must be an integer' })
  @Min(0, { message: 'sort_order must be at least 0' })
  sort_order?: number;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean({ message: 'includes_coaching must be a boolean value' })
  includes_coaching?: boolean;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean({ message: 'is_active must be a boolean value' })
  is_active?: boolean;
}

export class CancelSubscriptionDTO {
  @ApiPropertyOptional({ example: 'Moving out of town.' })
  @IsOptional()
  @TrimString()
  @IsString({ message: 'reason must be a string' })
  @MaxLength(500, { message: 'reason must not exceed 500 characters' })
  reason?: string;
}

export class CreateSubscriptionDTO {
  @ApiProperty({ example: '3f27a1c4-2c31-4e67-9a56-53d9d0c7d4c1' })
  @IsUUID('4', { message: 'plan_id must be a valid UUID' })
  plan_id: string;

  @ApiProperty({ enum: PaymentProvider, example: PaymentProvider.paymongo })
  @IsEnum(PaymentProvider, {
    message: `provider must be one of: ${Object.values(PaymentProvider).join(', ')}`,
  })
  provider: PaymentProvider;
}

export class SubscriptionCheckoutResponseDTO {
  @ApiProperty({
    example: 'https://checkout.paymongo.com/cs_test_123',
  })
  checkout_url: string;
}

export class MembershipPlanResponseDTO {
  @ApiProperty({ example: '3f27a1c4-2c31-4e67-9a56-53d9d0c7d4c1' })
  id: string;

  @ApiProperty({ example: 'Monthly Membership' })
  name: string;

  @ApiPropertyOptional({ example: 'Access to gym equipment and locker area.' })
  description: string | null;

  @ApiProperty({ example: '1499' })
  price: string;

  @ApiProperty({ example: 'PHP' })
  currency: string;

  @ApiProperty({ example: 30 })
  duration_days: number;

  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: true,
    example: { locker_access: true, guest_passes: 2 },
  })
  features: Record<string, unknown>;

  @ApiProperty({ example: 0 })
  sort_order: number;

  @ApiProperty({ example: false })
  includes_coaching: boolean;

  @ApiProperty({ example: true })
  is_active: boolean;

  @ApiProperty({ example: '2026-03-24T00:00:00.000Z' })
  created_at: string;

  @ApiProperty({ example: '2026-03-24T00:00:00.000Z' })
  updated_at: string;
}

export class CurrentSubscriptionResponseDTO {
  @ApiProperty({ example: '66666666-6666-4666-8666-666666666666' })
  id: string;

  @ApiProperty({ example: '33333333-3333-4333-8333-333333333333' })
  user_id: string;

  @ApiProperty({ example: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' })
  plan_id: string;

  @ApiPropertyOptional({ example: 'payment-1', nullable: true })
  payment_id: string | null;

  @ApiProperty({ enum: SubscriptionStatus, example: SubscriptionStatus.active })
  status: SubscriptionStatus;

  @ApiPropertyOptional({
    example: '2026-03-25T00:00:00.000Z',
    nullable: true,
  })
  starts_at: string | null;

  @ApiPropertyOptional({
    example: '2026-04-24T00:00:00.000Z',
    nullable: true,
  })
  expires_at: string | null;

  @ApiPropertyOptional({ example: null, nullable: true })
  warned_7d_at: string | null;

  @ApiPropertyOptional({ example: null, nullable: true })
  warned_3d_at: string | null;

  @ApiPropertyOptional({ example: null, nullable: true })
  warned_1d_at: string | null;

  @ApiPropertyOptional({ example: null, nullable: true })
  cancelled_at: string | null;

  @ApiPropertyOptional({ example: null, nullable: true })
  cancellation_reason: string | null;

  @ApiProperty({ example: '2026-03-24T00:00:00.000Z' })
  created_at: string;

  @ApiProperty({ example: '2026-03-24T00:00:00.000Z' })
  updated_at: string;

  @ApiProperty({ type: MembershipPlanResponseDTO })
  plan: MembershipPlanResponseDTO;
}

export class MembershipOperationsDashboardItemDTO {
  @ApiProperty({ example: '66666666-6666-4666-8666-666666666666' })
  id: string;

  @ApiProperty({ example: '22222222-2222-4222-8222-222222222222' })
  user_id: string;

  @ApiProperty({ example: 'Casey Reyes' })
  member_name: string;

  @ApiProperty({ example: 'Monthly Membership' })
  plan_name: string;

  @ApiProperty({ enum: SubscriptionStatus, example: SubscriptionStatus.active })
  status: SubscriptionStatus;

  @ApiPropertyOptional({
    example: '2026-05-10T00:00:00.000Z',
    nullable: true,
  })
  starts_at: string | null;

  @ApiPropertyOptional({
    example: '2026-06-09T00:00:00.000Z',
    nullable: true,
  })
  expires_at: string | null;
}

export class MembershipOperationsDashboardResponseDTO {
  @ApiProperty({ example: '2026-05-13T00:00:00.000Z' })
  generated_at: string;

  @ApiProperty({ example: 284 })
  total_active_members_count: number;

  @ApiProperty({ example: 12 })
  recently_activated_count: number;

  @ApiProperty({ type: MembershipOperationsDashboardItemDTO, isArray: true })
  recently_activated: MembershipOperationsDashboardItemDTO[];

  @ApiProperty({ example: 9 })
  expiring_membership_count: number;

  @ApiProperty({ type: MembershipOperationsDashboardItemDTO, isArray: true })
  expiring_memberships: MembershipOperationsDashboardItemDTO[];
}

export class MembershipCatalogSettingsResponseDTO {
  @ApiProperty({ example: '400.00' })
  membership_card_price: string;

  @ApiProperty({ example: '2026-05-14T12:00:00.000Z' })
  updated_at: string;
}

export class UpdateMembershipCatalogSettingsDTO {
  @ApiProperty({ example: 400 })
  @IsNumber({}, { message: 'membership_card_price must be a number' })
  @IsPositive({ message: 'membership_card_price must be a positive number' })
  membership_card_price: number;
}
