import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  MembershipCardSource,
  MembershipCardStatus,
  PaymentProvider,
} from '@prisma/client';
import { IsEnum } from 'class-validator';

import { PaymentResponseDTO } from '../../payment/dto/payment.dto';

export class StartMembershipCardPurchaseDTO {
  @ApiProperty({ enum: PaymentProvider, example: PaymentProvider.paymongo })
  @IsEnum(PaymentProvider, {
    message: `provider must be one of: ${Object.values(PaymentProvider).join(', ')}`,
  })
  provider: PaymentProvider;
}

export class MembershipCardResponseDTO {
  @ApiProperty({ enum: MembershipCardStatus, example: MembershipCardStatus.active })
  status: MembershipCardStatus;

  @ApiPropertyOptional({
    enum: MembershipCardSource,
    example: MembershipCardSource.cash,
    nullable: true,
  })
  source?: MembershipCardSource | null;

  @ApiPropertyOptional({
    example: '2026-04-10T08:00:00.000Z',
    nullable: true,
  })
  purchased_at?: string | null;

  @ApiPropertyOptional({
    example: '2026-04-10T08:05:00.000Z',
    nullable: true,
  })
  verified_at?: string | null;

  @ApiPropertyOptional({
    example: '2026-04-10T08:05:00.000Z',
    nullable: true,
  })
  activated_at?: string | null;

  @ApiPropertyOptional({
    example: '2026-04-10T08:10:00.000Z',
    nullable: true,
  })
  revoked_at?: string | null;

  @ApiPropertyOptional({ example: 'Rejected via members panel.', nullable: true })
  revoke_reason?: string | null;

  @ApiPropertyOptional({
    example: '2026-04-10T08:05:00.000Z',
    nullable: true,
  })
  updated_at?: string | null;
}

export class MembershipCardPurchaseResponseDTO {
  @ApiProperty({ example: 'Membership card checkout started.' })
  message: string;

  @ApiPropertyOptional({
    example: 'https://checkout.paymongo.com/...',
    nullable: true,
  })
  checkout_url?: string | null;

  @ApiProperty({ type: MembershipCardResponseDTO })
  membership_card: MembershipCardResponseDTO;

  @ApiProperty({ type: PaymentResponseDTO })
  payment: PaymentResponseDTO;
}
