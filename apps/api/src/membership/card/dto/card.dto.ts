import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  CommerceCheckoutHoldKind,
  CommerceCheckoutHoldStatus,
  MembershipCardSource,
  MembershipCardStatus,
  PaymentProvider,
} from '@prisma/client';
import { IsIn } from 'class-validator';

import { PaymentResponseDTO } from '../../payment/dto/payment.dto';
import { CommerceCheckoutReturnInputDTO } from '../../../coaching/commerce/dto/checkout-return.dto';

export class StartMembershipCardPurchaseDTO extends CommerceCheckoutReturnInputDTO {
  @ApiProperty({ enum: [PaymentProvider.paymongo], example: PaymentProvider.paymongo })
  @IsIn([PaymentProvider.paymongo], {
    message: 'provider must be paymongo for membership-card checkout',
  })
  provider: PaymentProvider;
}

export class MembershipCardResponseDTO {
  @ApiProperty({
    enum: MembershipCardStatus,
    example: MembershipCardStatus.active,
  })
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

  @ApiPropertyOptional({
    example: 'Rejected via members panel.',
    nullable: true,
  })
  revoke_reason?: string | null;

  @ApiPropertyOptional({
    example: '2026-04-10T08:05:00.000Z',
    nullable: true,
  })
  updated_at?: string | null;
}

export class MembershipCardPurchaseResponseDTO {
  @ApiPropertyOptional({ example: 'Membership card checkout started.' })
  message?: string;

  @ApiPropertyOptional({
    example: 'https://checkout.paymongo.com/...',
    nullable: true,
  })
  checkout_url?: string | null;

  @ApiPropertyOptional({ type: MembershipCardResponseDTO, nullable: true })
  membership_card?: MembershipCardResponseDTO | null;

  @ApiPropertyOptional({ type: PaymentResponseDTO, nullable: true })
  payment?: PaymentResponseDTO | null;

  @ApiProperty({ example: '11111111-1111-4111-8111-111111111111' })
  hold_id: string;

  @ApiProperty({ enum: CommerceCheckoutHoldKind })
  kind: CommerceCheckoutHoldKind;

  @ApiProperty({ enum: CommerceCheckoutHoldStatus })
  status: CommerceCheckoutHoldStatus;

  @ApiProperty({ example: '2026-08-13T09:15:00.000Z' })
  expires_at: string;

  @ApiPropertyOptional({ nullable: true })
  payment_id: string | null;

  @ApiPropertyOptional({ nullable: true })
  membership_card_id?: string | null;
}
