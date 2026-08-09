import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BookingStatus, PaymentProvider } from '@prisma/client';
import {
  IsEnum,
  IsISO8601,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  MaxLength,
  ValidateIf,
} from 'class-validator';

import { IsOnOrAfter, TrimString } from '../../../common/validators';

export enum CreateBookingPaymentStage {
  downpayment = 'downpayment',
  full = 'full',
}

export class CreateBookingDTO {
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
    enum: PaymentProvider,
    example: PaymentProvider.paymongo,
  })
  @IsEnum(PaymentProvider, {
    message: `provider must be one of: ${Object.values(PaymentProvider).join(', ')}`,
  })
  provider: PaymentProvider;

  @ApiPropertyOptional({
    enum: CreateBookingPaymentStage,
    example: CreateBookingPaymentStage.full,
    description:
      'Self-service facility reservations are paid in full through PayMongo. The legacy downpayment value is retained only for internal compatibility and is rejected for member/coach requests.',
  })
  @IsOptional()
  @IsEnum(CreateBookingPaymentStage, {
    message: `payment_stage must be one of: ${Object.values(CreateBookingPaymentStage).join(', ')}`,
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
  @ApiProperty({
    example: '22222222-2222-4222-8222-222222222222',
  })
  booking_id: string;

  @ApiProperty({
    enum: BookingStatus,
    example: BookingStatus.pending,
  })
  status: BookingStatus;

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
}

export class ProcessBalanceDTO {
  @ApiProperty({
    enum: PaymentProvider,
    example: PaymentProvider.paymongo,
  })
  @IsEnum(PaymentProvider, {
    message: `provider must be one of: ${Object.values(PaymentProvider).join(', ')}`,
  })
  provider: PaymentProvider;

  @ApiPropertyOptional({
    example: 'https://cdn.fittrack.test/receipts/or-2026-03-23.png',
  })
  @ValidateIf(
    (dto: ProcessBalanceDTO) =>
      dto.provider === PaymentProvider.cash &&
      typeof dto.screenshot_url === 'string' &&
      dto.screenshot_url.trim().length > 0,
  )
  @IsUrl({}, { message: 'screenshot_url must be a valid URL' })
  screenshot_url?: string;

  @ApiPropertyOptional({
    example: 'OR-2026-001',
  })
  @ValidateIf((dto: ProcessBalanceDTO) => dto.provider === PaymentProvider.cash)
  @TrimString()
  @IsString({ message: 'reference_no must be a string' })
  @IsNotEmpty({ message: 'reference_no is required' })
  @MaxLength(100, { message: 'reference_no must not exceed 100 characters' })
  reference_no?: string;
}
