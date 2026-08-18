import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  BookingStatus,
  CommerceCheckoutHoldKind,
  CommerceCheckoutHoldStatus,
  PaymentProvider,
} from '@prisma/client';
import {
  IsISO8601,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

import { IsOnOrAfter, TrimString } from '../../../common/validators';
import { CommerceCheckoutReturnInputDTO } from '../../../coaching/commerce/dto/checkout-return.dto';

export enum CreateBookingPaymentStage {
  full = 'full',
}

export class CreateBookingDTO extends CommerceCheckoutReturnInputDTO {
  @ApiProperty({
    example: '7e9f96f7-8efe-5598-a978-5cd6ecf73a06',
    description:
      'Database amenity ID. Supports persisted UUID versions, including deterministic UUID v5 values.',
  })
  @IsUUID('all', { message: 'amenity_id must be a valid UUID' })
  amenity_id: string;

  @ApiPropertyOptional({
    example: '7e9f96f7-8efe-5598-a978-5cd6ecf73a06',
    description:
      'Optional coach add-on for venue-first reservations. Coach IDs may be deterministic UUID v5 values.',
  })
  @IsOptional()
  @IsUUID('all', { message: 'coach_id must be a valid UUID' })
  coach_id?: string;

  @ApiProperty({
    example: '2026-03-24T10:00:00.000Z',
  })
  @IsISO8601({}, { message: 'starts_at must be a valid ISO 8601 date string' })
  starts_at: string;

  @ApiProperty({
    example: '2026-03-24T11:00:00.000Z',
  })
  @IsISO8601({}, { message: 'ends_at must be a valid ISO 8601 date string' })
  @IsOnOrAfter('starts_at', 'starts_at', {
    message: 'ends_at must be on or after starts_at',
  })
  ends_at: string;

  @ApiProperty({
    enum: [PaymentProvider.paymongo],
    example: PaymentProvider.paymongo,
  })
  @IsIn([PaymentProvider.paymongo], {
    message: 'provider must be paymongo for self-service venue checkout',
  })
  provider: PaymentProvider;

  @ApiPropertyOptional({
    enum: CreateBookingPaymentStage,
    example: CreateBookingPaymentStage.full,
    description:
      'Self-service facility reservations are paid in full through PayMongo.',
  })
  @IsOptional()
  @IsIn([CreateBookingPaymentStage.full], {
    message: 'payment_stage must be full for new venue bookings',
  })
  payment_stage?: CreateBookingPaymentStage;

  @ApiPropertyOptional({
    example: 'Birthday game booking.',
  })
  @IsOptional()
  @TrimString()
  @IsString({ message: 'notes must be a string' })
  @MaxLength(500, { message: 'notes must not exceed 500 characters' })
  notes?: string;
}

export class BookingCheckoutResponseDTO {
  @ApiPropertyOptional({
    example: '22222222-2222-4222-8222-222222222222',
    nullable: true,
  })
  booking_id?: string | null;

  @ApiPropertyOptional({
    enum: BookingStatus,
    example: BookingStatus.pending,
    nullable: true,
  })
  status?: BookingStatus | CommerceCheckoutHoldStatus;

  @ApiPropertyOptional({
    example: 'https://checkout.paymongo.com/cs_test_123',
    nullable: true,
  })
  checkout_url?: string | null;

  @ApiPropertyOptional({
    example: '44444444-4444-4444-8444-444444444444',
    nullable: true,
  })
  payment_id?: string | null;

  @ApiPropertyOptional({ nullable: true })
  hold_id?: string | null;

  @ApiPropertyOptional({ enum: CommerceCheckoutHoldKind, nullable: true })
  kind?: CommerceCheckoutHoldKind | null;

  @ApiPropertyOptional({ nullable: true })
  expires_at?: string | null;
}

export class ProcessBalanceDTO {
  @ApiProperty({
    enum: [PaymentProvider.paymongo],
    example: PaymentProvider.paymongo,
  })
  @IsIn([PaymentProvider.paymongo], {
    message: 'provider must be paymongo for legacy compatibility only',
  })
  provider: PaymentProvider;
}
