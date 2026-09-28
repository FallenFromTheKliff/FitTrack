import {
  IsEnum,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsPositive,
  IsString,
  IsUrl,
  IsUUID,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  PayableType,
  PaymentProvider,
  PaymentStage,
  PaymentStatus,
  UserRole,
  UserStatus,
} from '@prisma/client';

import { TrimString } from '../../../common/validators';
import { DateRangeDTO } from '../../../user/dto/user-dto';
import { PaginationDTO } from '../../subscription/dto/pagination.dto';

export class PaymentHistoryDTO extends DateRangeDTO {}

export class ManualPaymentDTO {
  @ApiProperty({ enum: PayableType, example: PayableType.subscription })
  @IsEnum(PayableType, {
    message: `payable_type must be one of: ${Object.values(PayableType).join(', ')}`,
  })
  payable_type: PayableType;

  @ApiProperty({ example: '3f27a1c4-2c31-4e67-9a56-53d9d0c7d4c1' })
  @IsUUID('all', { message: 'payable_id must be a valid UUID' })
  payable_id: string;

  @ApiProperty({ enum: [PaymentStage.full], example: PaymentStage.full })
  @IsIn([PaymentStage.full], {
    message: 'payment_stage must be full for all new payment records',
  })
  payment_stage: PaymentStage;

  @ApiProperty({ example: 1499 })
  @IsPositive({ message: 'amount must be a positive number' })
  amount: number;

  @ApiProperty({
    example: 'https://cdn.fittrack.test/receipts/or-2026-03-23.png',
  })
  @IsUrl({}, { message: 'screenshot_url must be a valid URL' })
  screenshot_url: string;

  @ApiProperty({ example: 'OR-2026-001' })
  @TrimString()
  @IsString({ message: 'reference_no must be a string' })
  @IsNotEmpty({ message: 'reference_no is required' })
  @MaxLength(100, { message: 'reference_no must not exceed 100 characters' })
  reference_no: string;
}

export class VerifyPaymentDTO {
  @ApiProperty({ enum: ['approve', 'reject'], example: 'approve' })
  @IsString({ message: 'action must be a string' })
  @IsIn(['approve', 'reject'], {
    message: 'action must be one of: approve, reject',
  })
  action: 'approve' | 'reject';

  @ApiPropertyOptional({ example: 'Receipt was unreadable.' })
  @ValidateIf((dto: VerifyPaymentDTO) => dto.action === 'reject')
  @TrimString()
  @IsString({ message: 'rejection_reason must be a string' })
  @IsNotEmpty({ message: 'rejection_reason is required when action is reject' })
  @MaxLength(500, {
    message: 'rejection_reason must not exceed 500 characters',
  })
  rejection_reason?: string;
}

export class PaymentFilterDTO extends PaginationDTO {
  @ApiPropertyOptional({ enum: PaymentStatus })
  @IsOptional()
  @IsEnum(PaymentStatus, {
    message: `status must be one of: ${Object.values(PaymentStatus).join(', ')}`,
  })
  status?: PaymentStatus;

  @ApiPropertyOptional({ enum: PayableType })
  @IsOptional()
  @IsEnum(PayableType, {
    message: `payable_type must be one of: ${Object.values(PayableType).join(', ')}`,
  })
  payable_type?: PayableType;
}

export class PaymentWebhookAckDTO {
  @ApiProperty({ example: 'SUCCESS' })
  message: string;
}

export class PaymentProfileSummaryDTO {
  @ApiPropertyOptional({ example: 'Jamie', nullable: true })
  first_name?: string | null;

  @ApiPropertyOptional({ example: 'Rivera', nullable: true })
  last_name?: string | null;

  @ApiPropertyOptional({ example: '+639171234567', nullable: true })
  phone?: string | null;

  @ApiPropertyOptional({
    example: 'https://cdn.fittrack.test/avatars/member.png',
    nullable: true,
  })
  avatar_url?: string | null;
}

export class PaymentActorSummaryDTO {
  @ApiProperty({ example: '33333333-3333-4333-8333-333333333333' })
  id: string;

  @ApiProperty({ enum: UserRole, example: UserRole.member })
  role: UserRole;

  @ApiProperty({ enum: UserStatus, example: UserStatus.active })
  status: UserStatus;

  @ApiPropertyOptional({ type: PaymentProfileSummaryDTO, nullable: true })
  profile?: PaymentProfileSummaryDTO | null;
}

export class PaymentResponseDTO {
  @ApiProperty({ example: '77777777-7777-4777-8777-777777777777' })
  id: string;

  @ApiProperty({ example: '33333333-3333-4333-8333-333333333333' })
  user_id: string;

  @ApiProperty({ enum: PayableType, example: PayableType.subscription })
  payable_type: PayableType;

  @ApiPropertyOptional({ enum: ['membership_card', 'gym_membership'], nullable: true })
  membership_kind?: 'membership_card' | 'gym_membership' | null;

  @ApiPropertyOptional({ example: 'Monthly Membership', nullable: true })
  membership_item_name?: string | null;

  @ApiPropertyOptional({ example: 'Monthly Membership', nullable: true })
  membership_plan_name?: string | null;

  @ApiProperty({ example: '88888888-8888-4888-8888-888888888888' })
  payable_id: string;

  @ApiProperty({ enum: PaymentStage, example: PaymentStage.full })
  payment_stage: PaymentStage;

  @ApiProperty({ example: '1499' })
  amount: string;

  @ApiProperty({ example: 'PHP' })
  currency: string;

  @ApiProperty({ enum: PaymentProvider, example: PaymentProvider.cash })
  provider: PaymentProvider;

  @ApiPropertyOptional({ example: 'OR-2026-001', nullable: true })
  provider_ref: string | null;

  @ApiPropertyOptional({ example: null, nullable: true })
  gateway_event_id: string | null;

  @ApiProperty({ example: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc' })
  idempotency_key: string;

  @ApiProperty({
    enum: PaymentStatus,
    example: PaymentStatus.awaiting_verification,
  })
  status: PaymentStatus;

  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: true,
    nullable: true,
  })
  gateway_metadata?: Record<string, unknown> | null;

  @ApiPropertyOptional({
    example: 'https://cdn.fittrack.test/receipts/or-2026-03-23.png',
    nullable: true,
  })
  screenshot_url: string | null;

  @ApiPropertyOptional({ example: null, nullable: true })
  rejection_reason: string | null;

  @ApiPropertyOptional({ example: null, nullable: true })
  verified_by: string | null;

  @ApiPropertyOptional({ example: null, nullable: true })
  verified_at: string | null;

  @ApiProperty({ example: '2026-03-24T00:00:00.000Z' })
  created_at: string;

  @ApiProperty({ example: '2026-03-24T00:00:00.000Z' })
  updated_at: string;
}

export class PaymentDetailsResponseDTO extends PaymentResponseDTO {
  @ApiPropertyOptional({ type: PaymentActorSummaryDTO, nullable: true })
  user?: PaymentActorSummaryDTO | null;

  @ApiPropertyOptional({ type: PaymentActorSummaryDTO, nullable: true })
  verifier?: PaymentActorSummaryDTO | null;
}
