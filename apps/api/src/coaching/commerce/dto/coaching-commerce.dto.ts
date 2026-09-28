import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  CommerceCheckoutHoldKind,
  CommerceCheckoutHoldStatus,
} from '@prisma/client';

export const COMMERCE_CHECKOUT_HOLD_STATES = [
  'pending',
  'succeeded',
  'expired',
  'failed',
] as const;

export class CoachingCheckoutResponseDTO {
  @ApiPropertyOptional({
    example: '33333333-3333-4333-8333-333333333333',
    nullable: true,
  })
  appointment_id?: string | null;

  @ApiPropertyOptional({ nullable: true })
  booking_id?: string | null;

  @ApiPropertyOptional({ nullable: true })
  membership_card_id?: string | null;

  @ApiPropertyOptional({ nullable: true })
  subscription_id?: string | null;

  @ApiPropertyOptional({
    example: 'https://checkout.paymongo.com/cs_test_123',
    nullable: true,
  })
  checkout_url: string | null;

  @ApiProperty({ example: '2026-08-13T09:15:00.000Z' })
  expires_at: string;

  @ApiProperty({ example: '11111111-1111-4111-8111-111111111111' })
  hold_id: string;

  @ApiProperty({ enum: CommerceCheckoutHoldKind })
  kind: CommerceCheckoutHoldKind;

  @ApiPropertyOptional({
    example: '44444444-4444-4444-8444-444444444444',
    nullable: true,
  })
  payment_id: string | null;

  @ApiPropertyOptional({
    example: '55555555-5555-4555-8555-555555555555',
    nullable: true,
  })
  recurring_plan_id?: string | null;

  @ApiProperty({ enum: CommerceCheckoutHoldStatus })
  status: CommerceCheckoutHoldStatus;
}

export class CommerceCheckoutHoldStatusResponseDTO {
  @ApiPropertyOptional({ nullable: true })
  appointment_id: string | null;

  @ApiPropertyOptional({ nullable: true })
  checkout_url: string | null;

  @ApiPropertyOptional({ nullable: true })
  booking_id: string | null;

  @ApiProperty({ example: '2026-08-13T09:15:00.000Z' })
  expires_at: string;

  @ApiPropertyOptional({ nullable: true })
  failure_reason: string | null;

  @ApiProperty({ example: '11111111-1111-4111-8111-111111111111' })
  hold_id: string;

  @ApiProperty({ enum: CommerceCheckoutHoldKind })
  kind: CommerceCheckoutHoldKind;

  @ApiPropertyOptional({ nullable: true })
  membership_card_id: string | null;

  @ApiPropertyOptional({ nullable: true })
  payment_id: string | null;

  @ApiPropertyOptional({ nullable: true })
  recurring_plan_id: string | null;

  @ApiProperty({ enum: COMMERCE_CHECKOUT_HOLD_STATES, example: 'pending' })
  state: (typeof COMMERCE_CHECKOUT_HOLD_STATES)[number];

  @ApiPropertyOptional({ nullable: true })
  subscription_id: string | null;
}
