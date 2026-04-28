import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  PaymentStatus,
  SalePaymentMethod,
  SaleSource,
  SaleStatus,
} from '@prisma/client';

import { TrimString } from '../../../common/validators';
import { DateRangeDTO } from '../../../user/dto/user-dto';

export class CreateSaleItemDTO {
  @ApiProperty({ example: '11111111-1111-4111-8111-111111111111' })
  @IsUUID('all', { message: 'product_id must be a valid UUID' })
  product_id: string;

  @ApiProperty({ example: 2 })
  @Type(() => Number)
  @IsInt({ message: 'quantity must be an integer' })
  @Min(1, { message: 'quantity must be at least 1' })
  quantity: number;

  @ApiPropertyOptional({ example: 1299.0, nullable: true })
  @IsOptional()
  @Type(() => Number)
  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: 'unit_price must be a valid price with up to 2 decimals' },
  )
  @Min(0.01, { message: 'unit_price must be greater than 0' })
  unit_price?: number;
}

export class CreateSaleDTO {
  @ApiPropertyOptional({ example: 'Walk-in Customer', nullable: true })
  @IsOptional()
  @TrimString()
  @IsString({ message: 'customer_name must be a string' })
  @MaxLength(255, {
    message: 'customer_name must not exceed 255 characters',
  })
  customer_name?: string;

  @ApiPropertyOptional({
    example: '22222222-2222-4222-8222-222222222222',
    nullable: true,
  })
  @IsOptional()
  @IsUUID('all', { message: 'customer_user_id must be a valid UUID' })
  customer_user_id?: string;

  @ApiPropertyOptional({
    example: 'Counter sale paid in cash after a quick stock check.',
    nullable: true,
  })
  @IsOptional()
  @TrimString()
  @IsString({ message: 'notes must be a string' })
  @MaxLength(500, { message: 'notes must not exceed 500 characters' })
  notes?: string;

  @ApiProperty({ enum: SalePaymentMethod, example: SalePaymentMethod.cash })
  @IsEnum(SalePaymentMethod, {
    message: `payment_method must be one of: ${Object.values(SalePaymentMethod).join(', ')}`,
  })
  payment_method: SalePaymentMethod;

  @ApiProperty({
    type: CreateSaleItemDTO,
    isArray: true,
    example: [
      {
        product_id: '11111111-1111-4111-8111-111111111111',
        quantity: 2,
      },
    ],
  })
  @IsArray({ message: 'items must be an array' })
  @ArrayMinSize(1, { message: 'items must contain at least 1 item' })
  @ValidateNested({ each: true })
  @Type(() => CreateSaleItemDTO)
  items: CreateSaleItemDTO[];
}

export class SaleFilterDTO extends DateRangeDTO {}

export class SaleStaffSummaryResponseDTO {
  @ApiProperty({ example: '33333333-3333-4333-8333-333333333333' })
  id: string;

  @ApiPropertyOptional({ example: 'Morgan', nullable: true })
  first_name: string | null;

  @ApiPropertyOptional({ example: 'Reyes', nullable: true })
  last_name: string | null;
}

export class SaleItemProductSummaryResponseDTO {
  @ApiProperty({ example: '11111111-1111-4111-8111-111111111111' })
  id: string;

  @ApiProperty({ example: 'Whey Protein Isolate' })
  name: string;

  @ApiPropertyOptional({
    example: 'https://cdn.fittrack.test/images/whey.png',
    nullable: true,
  })
  image_url: string | null;
}

export class SaleTransactionItemResponseDTO {
  @ApiProperty({ example: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' })
  id: string;

  @ApiProperty({ example: '11111111-1111-4111-8111-111111111111' })
  product_id: string;

  @ApiProperty({ example: 2 })
  quantity: number;

  @ApiProperty({ example: '1499.00' })
  unit_price: string;

  @ApiProperty({ example: '2998.00' })
  subtotal: string;

  @ApiPropertyOptional({
    type: SaleItemProductSummaryResponseDTO,
    nullable: true,
  })
  product: SaleItemProductSummaryResponseDTO | null;
}

export class SaleTransactionSummaryResponseDTO {
  @ApiProperty({ example: '77777777-7777-4777-8777-777777777777' })
  id: string;

  @ApiPropertyOptional({ example: 'Walk-in Customer', nullable: true })
  customer_name: string | null;

  @ApiPropertyOptional({
    example: '22222222-2222-4222-8222-222222222222',
    nullable: true,
  })
  customer_user_id: string | null;

  @ApiPropertyOptional({
    example: 'Counter sale paid in cash after a quick stock check.',
    nullable: true,
  })
  notes: string | null;

  @ApiProperty({ example: '2998.00' })
  total_amount: string;

  @ApiProperty({ enum: SaleSource, example: SaleSource.manual })
  source: SaleSource;

  @ApiProperty({ enum: SalePaymentMethod, example: SalePaymentMethod.cash })
  payment_method: SalePaymentMethod;

  @ApiPropertyOptional({ example: null, nullable: true })
  payment_id: string | null;

  @ApiProperty({ example: '33333333-3333-4333-8333-333333333333' })
  processed_by: string;

  @ApiProperty({ enum: SaleStatus, example: SaleStatus.completed })
  status: SaleStatus;

  @ApiPropertyOptional({
    type: SaleStaffSummaryResponseDTO,
    nullable: true,
  })
  staff: SaleStaffSummaryResponseDTO | null;

  @ApiProperty({ example: 3 })
  items_count: number;

  @ApiProperty({ example: '2026-03-27T05:00:00.000Z' })
  created_at: string;

  @ApiProperty({ example: '2026-03-27T05:00:00.000Z' })
  updated_at: string;
}

export class SaleTransactionDetailResponseDTO extends SaleTransactionSummaryResponseDTO {
  @ApiProperty({
    type: SaleTransactionItemResponseDTO,
    isArray: true,
  })
  items: SaleTransactionItemResponseDTO[];
}

export class SaleCheckoutResponseDTO {
  @ApiProperty({ example: '77777777-7777-4777-8777-777777777777' })
  sale_id: string;

  @ApiProperty({ example: '99999999-9999-4999-8999-999999999999' })
  payment_id: string;

  @ApiProperty({ enum: SaleStatus, example: SaleStatus.pending })
  status: SaleStatus;

  @ApiProperty({ enum: PaymentStatus, example: PaymentStatus.processing })
  payment_status: PaymentStatus;

  @ApiPropertyOptional({
    example: 'https://checkout.paymongo.com/fittrack-sale',
    nullable: true,
  })
  checkout_url: string | null;
}
