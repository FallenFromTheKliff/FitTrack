import {
  IsBoolean,
  IsInt,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  CommerceCheckoutHoldKind,
  CommerceCheckoutHoldStatus,
  MembershipCardStatus,
  PaymentProvider,
  SubscriptionStatus,
} from '@prisma/client';

import { TrimString } from '../../../common/validators';
import { CommerceCheckoutReturnInputDTO } from '../../../coaching/commerce/dto/checkout-return.dto';
import { MembershipCardResponseDTO } from '../../card/dto/card.dto';
import { PaymentResponseDTO } from '../../payment/dto/payment.dto';

export { PaginationDTO } from './pagination.dto';

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

export class CreateSubscriptionDTO extends CommerceCheckoutReturnInputDTO {
  @ApiProperty({ example: '3f27a1c4-2c31-4e67-9a56-53d9d0c7d4c1' })
  @IsUUID('all', { message: 'plan_id must be a valid UUID' })
  plan_id: string;

  @ApiProperty({ enum: [PaymentProvider.paymongo], example: PaymentProvider.paymongo })
  @IsIn([PaymentProvider.paymongo], {
    message: 'provider must be paymongo for membership checkout',
  })
  provider: PaymentProvider;
}

export class RecordCashMembershipDTO {
  @ApiProperty({ example: '33333333-3333-4333-8333-333333333333' })
  @IsUUID('all', { message: 'member_id must be a valid UUID' })
  member_id: string;

  @ApiProperty({ enum: ['membership_card', 'gym_membership'] })
  @IsIn(['membership_card', 'gym_membership'], {
    message: 'purchase_type must be membership_card or gym_membership',
  })
  purchase_type: 'membership_card' | 'gym_membership';

  @ApiPropertyOptional({ example: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' })
  @IsOptional()
  @IsUUID('all', { message: 'plan_id must be a valid UUID' })
  plan_id?: string;
}

export class OnsiteMembershipCandidateFilterDTO {
  @ApiProperty({ enum: ['grant', 'revoke'], example: 'grant' })
  @IsIn(['grant', 'revoke'], {
    message: 'action must be grant or revoke',
  })
  action: 'grant' | 'revoke';

  @ApiProperty({
    enum: ['membership_card', 'gym_membership'],
    example: 'gym_membership',
  })
  @IsIn(['membership_card', 'gym_membership'], {
    message: 'purchase_type must be membership_card or gym_membership',
  })
  purchase_type: 'membership_card' | 'gym_membership';

  @ApiPropertyOptional({ example: 'Maria Santos' })
  @IsOptional()
  @TrimString()
  @IsString({ message: 'search must be a string' })
  @MaxLength(100, { message: 'search must not exceed 100 characters' })
  search?: string;
}

export class OnsiteMembershipCandidateResponseDTO {
  @ApiProperty({ example: '33333333-3333-4333-8333-333333333333' })
  member_id: string;

  @ApiProperty({ example: 'Maria Santos' })
  display_name: string;

  @ApiPropertyOptional({ example: 'maria.santos@fittrack.com', nullable: true })
  email: string | null;

  @ApiPropertyOptional({ enum: MembershipCardStatus, nullable: true })
  membership_card_status: MembershipCardStatus | null;

  @ApiPropertyOptional({ example: '66666666-6666-4666-8666-666666666666', nullable: true })
  subscription_id: string | null;

  @ApiPropertyOptional({ enum: SubscriptionStatus, nullable: true })
  subscription_status: SubscriptionStatus | null;

  @ApiPropertyOptional({ example: 'Monthly Membership', nullable: true })
  plan_name: string | null;

  @ApiPropertyOptional({ example: '2026-05-01T00:00:00.000Z', nullable: true })
  starts_at: string | null;

  @ApiPropertyOptional({ example: '2026-05-30T00:00:00.000Z', nullable: true })
  expires_at: string | null;
}

export class MembershipAccessCandidatesQueryDTO {
  @ApiProperty({ enum: ['grant', 'revoke'], example: 'grant' })
  @IsIn(['grant', 'revoke'], {
    message: 'action must be grant or revoke',
  })
  action: 'grant' | 'revoke';

  @ApiProperty({
    enum: ['membership_card', 'gym_membership', 'free_day_pass'],
    example: 'gym_membership',
  })
  @IsIn(['membership_card', 'gym_membership', 'free_day_pass'], {
    message:
      'product must be membership_card, gym_membership, or free_day_pass',
  })
  product: 'membership_card' | 'gym_membership' | 'free_day_pass';

  @ApiPropertyOptional({ example: 'Maria Santos' })
  @IsOptional()
  @TrimString()
  @IsString({ message: 'search must be a string' })
  @MaxLength(100, { message: 'search must not exceed 100 characters' })
  search?: string;
}

export class MembershipAccessCandidateResponseDTO {
  @ApiProperty({ example: '33333333-3333-4333-8333-333333333333' })
  member_id: string;

  @ApiProperty({ example: 'Maria Santos' })
  display_name: string;

  @ApiPropertyOptional({ example: 'maria.santos@fittrack.com', nullable: true })
  email: string | null;

  @ApiPropertyOptional({ enum: MembershipCardStatus, nullable: true })
  membership_card_status: MembershipCardStatus | null;

  @ApiPropertyOptional({ example: '66666666-6666-4666-8666-666666666666', nullable: true })
  subscription_id: string | null;

  @ApiPropertyOptional({ enum: SubscriptionStatus, nullable: true })
  subscription_status: SubscriptionStatus | null;

  @ApiPropertyOptional({ example: 'Monthly Membership', nullable: true })
  plan_name: string | null;

  @ApiPropertyOptional({ example: '2026-05-01T00:00:00.000Z', nullable: true })
  starts_at: string | null;

  @ApiPropertyOptional({ example: '2026-05-30T00:00:00.000Z', nullable: true })
  expires_at: string | null;

  @ApiPropertyOptional({ example: '2026-05-30T00:00:00.000Z', nullable: true })
  free_pass_expires_at: string | null;
}

export class SubscriptionCheckoutResponseDTO {
  @ApiPropertyOptional({
    example: 'https://checkout.paymongo.com/cs_test_123',
    nullable: true,
  })
  checkout_url: string | null;

  @ApiPropertyOptional({ example: '11111111-1111-4111-8111-111111111111' })
  hold_id?: string;

  @ApiPropertyOptional({ enum: CommerceCheckoutHoldKind })
  kind?: CommerceCheckoutHoldKind;

  @ApiPropertyOptional({ enum: CommerceCheckoutHoldStatus })
  status?: CommerceCheckoutHoldStatus;

  @ApiPropertyOptional({ example: '2026-08-13T09:15:00.000Z' })
  expires_at?: string;

  @ApiPropertyOptional({ nullable: true })
  payment_id?: string | null;

  @ApiPropertyOptional({ nullable: true })
  subscription_id?: string | null;
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

  @ApiPropertyOptional({ nullable: true })
  plan_name_snapshot: string | null;

  @ApiPropertyOptional({ nullable: true })
  plan_description_snapshot: string | null;

  @ApiPropertyOptional({ nullable: true })
  plan_price_snapshot: string | null;

  @ApiPropertyOptional({ nullable: true })
  plan_currency_snapshot: string | null;

  @ApiPropertyOptional({ nullable: true })
  duration_days_snapshot: number | null;

  @ApiPropertyOptional({ nullable: true })
  access_consumed_at: string | null;
}

export class RevokeMembershipSubscriptionDTO {
  @ApiPropertyOptional({ example: 'Member requested an access reversal.' })
  @IsOptional()
  @TrimString()
  @IsString({ message: 'reason must be a string' })
  @MaxLength(500, { message: 'reason must not exceed 500 characters' })
  reason?: string;
}

export class RevokeMembershipSubscriptionResponseDTO {
  @ApiProperty({ example: 'Gym membership access revoked.' })
  message: string;

  @ApiProperty({ type: CurrentSubscriptionResponseDTO })
  subscription: CurrentSubscriptionResponseDTO;
}

export class GrantFreeDayPassDTO {
  @ApiProperty({ example: '33333333-3333-4333-8333-333333333333' })
  @IsUUID('all', { message: 'member_id must be a valid UUID' })
  member_id: string;
}

export class RevokeFreeDayPassDTO {
  @ApiProperty({ example: 'Member requested an access reversal.' })
  @TrimString()
  @IsString({ message: 'reason must be a string' })
  @IsNotEmpty({ message: 'reason is required' })
  @MaxLength(500, { message: 'reason must not exceed 500 characters' })
  reason: string;
}

export class FreeDayPassLifecycleResponseDTO {
  @ApiProperty({ example: 'Free one-day pass granted.' })
  message: string;

  @ApiProperty({ example: '33333333-3333-4333-8333-333333333333' })
  member_id: string;

  @ApiPropertyOptional({ example: '2026-08-28T10:00:00.000Z', nullable: true })
  granted_at: string | null;

  @ApiPropertyOptional({ example: '2026-08-29T10:00:00.000Z', nullable: true })
  expires_at: string | null;

  @ApiPropertyOptional({ example: null, nullable: true })
  redeemed_at: string | null;

  @ApiPropertyOptional({ example: null, nullable: true })
  revoked_at: string | null;

  @ApiPropertyOptional({ example: null, nullable: true })
  revoke_reason: string | null;
}

export class FreeDayPassEligibilityResponseDTO {
  @ApiProperty({ example: true })
  eligible: boolean;

  @ApiPropertyOptional({ example: null, nullable: true })
  redeemed_at: string | null;

  @ApiPropertyOptional({ example: null, nullable: true })
  granted_at: string | null;

  @ApiPropertyOptional({ example: null, nullable: true })
  expires_at: string | null;

  @ApiPropertyOptional({ example: null, nullable: true })
  revoked_at: string | null;

  @ApiPropertyOptional({ example: null, nullable: true })
  reason: string | null;
}

export class RecordCashMembershipResponseDTO {
  @ApiProperty({ type: PaymentResponseDTO })
  payment: PaymentResponseDTO;

  @ApiPropertyOptional({ type: MembershipCardResponseDTO, nullable: true })
  membership_card: MembershipCardResponseDTO | null;

  @ApiPropertyOptional({ type: CurrentSubscriptionResponseDTO, nullable: true })
  subscription: CurrentSubscriptionResponseDTO | null;

  @ApiProperty({ example: true })
  can_check_in_now: boolean;
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
