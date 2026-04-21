import {
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import {
  MembershipCard,
  Payment,
  PaymentProvider,
  PaymentStage,
  Prisma,
  UserRole,
} from '@prisma/client';
import { isUUID } from 'class-validator';

import { PaymentRepository } from '../payment/payment.repository';
import {
  PAYMENT_COMPLETED_EVENT,
  type PaymentCompletedEvent,
} from '../payment/events/payment-completed.event';
import {
  PAYMENT_FAILED_EVENT,
  type PaymentFailedEvent,
} from '../payment/events/payment-failed.event';
import {
  PaymongoCheckoutResult,
  PaymongoCheckoutService,
} from '../payment/paymongo-checkout.service';
import {
  StartMembershipCardPurchaseDTO,
} from './dto/card.dto';
import { MembershipCardRepository } from './card.repository';

type MembershipCardPurchaseResult = {
  checkout_url: string | null;
  membership_card: MembershipCard;
  message: string;
  payment: Payment;
};
const MEMBERSHIP_CARD_PAYABLE_TYPE =
  'membership_card' as unknown as Payment['payable_type'];
const MEMBERSHIP_CARD_RETURN_QUERY = {
  flow: 'membership-card',
  portal: 'member',
  surface: 'profile',
} as const;

@Injectable()
export class MembershipCardService {
  constructor(
    private readonly repo: MembershipCardRepository,
    private readonly paymentRepo: PaymentRepository,
    private readonly paymongoCheckoutService: PaymongoCheckoutService,
  ) {}

  async purchase(
    userId: string,
    dto: StartMembershipCardPurchaseDTO,
    idempotencyKey: string | undefined,
  ): Promise<MembershipCardPurchaseResult> {
    const normalizedIdempotencyKey =
      this.normalizeAndValidateIdempotencyKey(idempotencyKey);
    const owner = await this.repo.findMembershipOwnerByIdOrThrow(userId);
    this.assertEligibleOwner(owner);

    const existingPayment = await this.paymentRepo.findPaymentByIdempotencyKey(
      normalizedIdempotencyKey,
    );

    if (existingPayment) {
      return this.resumeExistingPurchase(existingPayment, userId);
    }

    const existingCard = await this.repo.findMembershipCardByUserId(userId);
    this.assertCanStartNewPurchase(existingCard);

    if (existingCard) {
      const latestPayment = await this.paymentRepo.findLatestPaymentForPayableStage(
        MEMBERSHIP_CARD_PAYABLE_TYPE,
        existingCard.id,
        PaymentStage.full,
      );
      this.assertNoBlockingPurchase(latestPayment);
    }

    const initiation = await this.repo.createOrRefreshPendingPurchase({
      idempotencyKey: normalizedIdempotencyKey,
      provider: dto.provider,
      source:
        dto.provider === PaymentProvider.cash
          ? 'cash'
          : 'paymongo',
      userId,
    });

    if (dto.provider === PaymentProvider.cash) {
      return {
        checkout_url: null,
        membership_card: initiation.membershipCard,
        message:
          'Membership card cash request submitted. Front-desk staff can verify it from the members panel.',
        payment: initiation.payment,
      };
    }

    const checkoutUrl = await this.startCheckoutForPayment(initiation.payment);
    return {
      checkout_url: checkoutUrl,
      membership_card: initiation.membershipCard,
      message: 'Membership card checkout started.',
      payment: initiation.payment,
    };
  }

  @OnEvent(PAYMENT_COMPLETED_EVENT, { async: true })
  async handlePaymentCompleted(event: PaymentCompletedEvent): Promise<void> {
    if (event.payableType !== MEMBERSHIP_CARD_PAYABLE_TYPE) {
      return;
    }

    const membershipCard = await this.repo.findMembershipCardByIdOrThrow(
      event.payableId,
    );

    if (membershipCard.status === 'active') {
      return;
    }

    const completedAt = new Date();
    await this.repo.activateMembershipCard(membershipCard.id, {
      activatedAt: completedAt,
      verifiedAt: completedAt,
      verifiedBy: event.verifiedBy ?? null,
    });
  }

  @OnEvent(PAYMENT_FAILED_EVENT, { async: true })
  async handlePaymentFailed(event: PaymentFailedEvent): Promise<void> {
    if (event.payableType !== MEMBERSHIP_CARD_PAYABLE_TYPE) {
      return;
    }

    const membershipCard = await this.repo.findMembershipCardByIdOrThrow(
      event.payableId,
    );

    if (membershipCard.status === 'active') {
      return;
    }

    await this.repo.revokeMembershipCard(membershipCard.id, {
      reason: event.reason ?? 'Membership card payment failed.',
      revokedAt: new Date(event.failedAt),
    });
  }

  async hasActiveMembershipCardAccess(userId: string): Promise<boolean> {
    const membershipCard = await this.repo.findMembershipCardByUserId(userId);
    return membershipCard?.status === 'active';
  }

  private assertEligibleOwner(owner: {
    deletedAt: Date | null;
    role: UserRole;
  }): void {
    if (owner.role !== UserRole.member) {
      throw new ForbiddenException({
        type: 'FORBIDDEN',
        title: 'Forbidden',
        status: 403,
        detail: 'Only member accounts can purchase a membership card.',
      });
    }

    if (owner.deletedAt) {
      throw new ConflictException({
        type: 'CONFLICT',
        title: 'Account Not Eligible',
        status: 409,
        detail:
          'This account is archived or pending deletion and cannot start a membership-card purchase.',
      });
    }
  }

  private assertCanStartNewPurchase(
    membershipCard: MembershipCard | null,
  ): void {
    if (membershipCard?.status === 'active') {
      throw new ConflictException({
        type: 'CONFLICT',
        title: 'Membership Card Already Active',
        status: 409,
        detail:
          'This account already has an active membership card. Load a plan instead of buying another card.',
      });
    }
  }

  private assertNoBlockingPurchase(payment: Payment | null): void {
    if (!payment) {
      return;
    }

    if (payment.status === 'awaiting_verification') {
      throw new ConflictException({
        type: 'CONFLICT',
        title: 'Membership Card Verification Pending',
        status: 409,
        detail:
          'A membership-card cash request is already awaiting staff verification for this account.',
      });
    }

    if (payment.status === 'pending' || payment.status === 'processing') {
      throw new ConflictException({
        type: 'CONFLICT',
        title: 'Membership Card Checkout Pending',
        status: 409,
        detail:
          'A membership-card checkout is already in progress for this account. Resume it or let it finish before starting another attempt.',
      });
    }
  }

  private async resumeExistingPurchase(
    payment: Payment,
    userId: string,
  ): Promise<MembershipCardPurchaseResult> {
    if (
      payment.user_id !== userId ||
      payment.payable_type !== MEMBERSHIP_CARD_PAYABLE_TYPE
    ) {
      throw new ConflictException({
        type: 'CONFLICT',
        title: 'Idempotency Key Already Used',
        status: 409,
        detail:
          'This Idempotency-Key is already associated with another payment request.',
      });
    }

    const membershipCard = await this.repo.findMembershipCardByIdOrThrow(
      payment.payable_id,
    );

    if (payment.provider === PaymentProvider.cash) {
      return {
        checkout_url: null,
        membership_card: membershipCard,
        message:
          payment.status === 'awaiting_verification'
            ? 'Membership card cash request is still awaiting staff verification.'
            : 'Membership card cash request already exists for this account.',
        payment,
      };
    }

    if (payment.provider !== PaymentProvider.paymongo) {
      throw new ConflictException({
        type: 'CONFLICT',
        title: 'Payment Provider Mismatch',
        status: 409,
        detail:
          'This Idempotency-Key is already associated with a non-PayMongo payment.',
      });
    }

    if (payment.status === 'failed') {
      throw new ConflictException({
        type: 'CONFLICT',
        title: 'Payment Attempt Already Failed',
        status: 409,
        detail:
          'This Idempotency-Key belongs to a failed membership-card payment attempt. Start a new attempt with a new key.',
      });
    }

    const checkoutUrl = this.extractCheckoutUrl(payment.gateway_metadata);

    return {
      checkout_url:
        checkoutUrl ??
        (await this.startCheckoutForPayment(payment, membershipCard.id)),
      membership_card: membershipCard,
      message: 'Membership card checkout resumed.',
      payment,
    };
  }

  private async startCheckoutForPayment(
    payment: Payment,
    membershipCardId?: string,
  ): Promise<string> {
    const checkout = await this.paymongoCheckoutService.createCheckoutSession({
      amount: this.toMinorAmount(payment.amount),
      cancelQuery: MEMBERSHIP_CARD_RETURN_QUERY,
      description: 'SertFit membership card',
      idempotencyKey: payment.idempotency_key,
      metadata: {
        membership_card_id: membershipCardId ?? payment.payable_id,
        payment_id: payment.id,
      },
      successQuery: MEMBERSHIP_CARD_RETURN_QUERY,
    });

    await this.paymentRepo.updatePayment(
      payment.id,
      this.toCheckoutUpdateInput(checkout),
    );

    return checkout.checkoutUrl;
  }

  private normalizeAndValidateIdempotencyKey(
    idempotencyKey: string | undefined,
  ): string {
    const normalized = idempotencyKey?.trim();

    if (!normalized || !isUUID(normalized, '4')) {
      throw new HttpException(
        {
          type: 'BUSINESS_RULE_VIOLATION',
          title: 'Invalid Idempotency Key',
          status: 422,
          detail: 'Idempotency-Key header must be a valid UUID v4.',
        },
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }

    return normalized;
  }

  private toCheckoutUpdateInput(
    checkout: PaymongoCheckoutResult,
  ): Prisma.PaymentUpdateInput {
    return {
      gateway_metadata: checkout.gatewayMetadata as Prisma.InputJsonValue,
      provider_ref: checkout.providerRef,
      status: 'processing',
    };
  }

  private extractCheckoutUrl(gatewayMetadata: Prisma.JsonValue | null) {
    if (
      gatewayMetadata &&
      typeof gatewayMetadata === 'object' &&
      !Array.isArray(gatewayMetadata)
    ) {
      const checkoutUrl = gatewayMetadata['checkout_url'];
      if (typeof checkoutUrl === 'string' && checkoutUrl.length > 0) {
        return checkoutUrl;
      }
    }

    return null;
  }

  private toMinorAmount(amount: Prisma.Decimal): number {
    return Math.round(Number(amount) * 100);
  }
}
