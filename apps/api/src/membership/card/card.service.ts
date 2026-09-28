import {
  ConflictException,
  ForbiddenException,
  GoneException,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import {
  MembershipCard,
  NotificationType,
  Payment,
  PaymentProvider,
  UserRole,
} from '@prisma/client';
import { isUUID } from 'class-validator';

import { NotificationsService } from '../../notifications/notifications.service';
import { ACCOUNT_ACTIVITY_EVENT } from '../../user/events/account-activity.event';
import {
  CoachingCommerceService,
  CoachingCheckoutResponse,
} from '../../coaching/commerce/coaching-commerce.service';
import {
  PAYMENT_COMPLETED_EVENT,
  type PaymentCompletedEvent,
} from '../payment/events/payment-completed.event';
import {
  PAYMENT_FAILED_EVENT,
  type PaymentFailedEvent,
} from '../payment/events/payment-failed.event';
import { StartMembershipCardPurchaseDTO } from './dto/card.dto';
import { MembershipCardRepository } from './card.repository';

const MEMBERSHIP_CARD_PAYABLE_TYPE =
  'membership_card' as unknown as Payment['payable_type'];

function getProfileDisplayName(
  profile?: {
    first_name?: string | null;
    last_name?: string | null;
  } | null,
) {
  return [profile?.first_name, profile?.last_name]
    .filter((value): value is string => Boolean(value?.trim()))
    .join(' ')
    .trim();
}

@Injectable()
export class MembershipCardService {
  constructor(
    private readonly repo: MembershipCardRepository,
    private readonly commerceCheckoutService: CoachingCommerceService,
    private readonly notificationsService: NotificationsService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async purchase(
    userId: string,
    dto: StartMembershipCardPurchaseDTO,
    idempotencyKey: string | undefined,
  ): Promise<CoachingCheckoutResponse> {
    const normalizedIdempotencyKey =
      this.normalizeAndValidateIdempotencyKey(idempotencyKey);
    const owner = await this.repo.findMembershipOwnerByIdOrThrow(userId);
    this.assertEligibleOwner(owner);

    if (dto.provider === PaymentProvider.cash) {
      throw this.buildRetiredCashPurchaseException();
    }

    const existingCard = await this.repo.findMembershipCardByUserId(userId);
    this.assertCanStartNewPurchase(existingCard);
    const price = await this.repo.getMembershipCardPrice();
    return this.commerceCheckoutService.createMembershipCardCheckout({
      amount: price,
      idempotencyKey: normalizedIdempotencyKey,
      returnTarget: dto.return_target ?? 'web',
      ...(dto.return_url !== undefined ? { returnUrl: dto.return_url } : {}),
      userId,
    });
  }

  @OnEvent(PAYMENT_COMPLETED_EVENT, { async: true })
  async handlePaymentCompleted(event: PaymentCompletedEvent): Promise<void> {
    if (event.payableType !== MEMBERSHIP_CARD_PAYABLE_TYPE) {
      return;
    }

    const membershipCard =
      await this.repo.findMembershipCardWithUserProfileByIdOrThrow(
        event.payableId,
      );

    const hasTrustedActivationMarker =
      typeof event.membershipCardActivationCommitted === 'boolean';

    if (!hasTrustedActivationMarker || membershipCard.status !== 'active') {
      return;
    }

    const completedAt = new Date();

    await this.notificationsService.dispatch(
      membershipCard.user_id,
      NotificationType.payment_confirmed,
      {
        title: 'Payment confirmed',
        body: this.buildPaymentConfirmedBody(event.amount),
        data: {
          amount: event.amount,
          kind: 'membership_card_payment_confirmed',
          membership_card_id: membershipCard.id,
          payment_id: event.paymentId,
        },
        email: {
          subject: 'Payment confirmed for your membership card',
          html: this.buildPaymentConfirmedHtml(event.amount),
        },
      },
    );

    if (event.verifiedBy) {
      await this.eventEmitter.emitAsync(ACCOUNT_ACTIVITY_EVENT, {
        action: 'membership_card_granted',
        actorId: event.verifiedBy,
        occurredAt: completedAt.toISOString(),
        targetName: getProfileDisplayName(membershipCard.user.profile),
        targetRole: UserRole.member,
        targetUserId: membershipCard.user_id,
      });
    }
  }

  @OnEvent(PAYMENT_FAILED_EVENT, { async: true })
  async handlePaymentFailed(event: PaymentFailedEvent): Promise<void> {
    if (event.payableType !== MEMBERSHIP_CARD_PAYABLE_TYPE) {
      return;
    }

    const membershipCard = await this.repo.findMembershipCardByIdOrThrow(
      event.payableId,
    );

    if (
      membershipCard.status === 'active' ||
      membershipCard.status === 'revoked'
    ) {
      return;
    }

    await this.repo.revokeMembershipCard(membershipCard.id, {
      reason: event.reason ?? 'Membership card payment failed.',
      revokedAt: new Date(event.failedAt),
    });
  }

  async hasActiveMembershipCardAccess(userId: string): Promise<boolean> {
    return this.repo.hasActiveMembershipCardAccess(userId);
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


  private buildPaymentConfirmedBody(amount: string): string {
    return `We confirmed your Membership Card payment. Amount received: PHP ${amount}. Your card unlocks Brodigy and premium app features; it does not grant gym entry.`;
  }

  private buildPaymentConfirmedHtml(amount: string): string {
    return `
      <div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;padding:24px">
        <h2 style="color:#1a1a1a">Payment confirmed</h2>
        <p style="color:#555">We confirmed your Membership Card payment.</p>
        <p style="color:#555">Amount received: <strong>PHP ${amount}</strong>.</p>
        <p style="color:#555">Your Membership Card unlocks Brodigy and premium app features; it does not grant gym entry.</p>
        <hr style="border:none;border-top:1px solid #eee;margin-top:24px"/>
        <p style="color:#aaa;font-size:12px;text-align:center">FitTrack</p>
      </div>
    `;
  }

  private buildRetiredCashPurchaseException(): GoneException {
    return new GoneException({
      type: 'GONE',
      title: 'Membership Card Cash Purchase Retired',
      status: 410,
      detail:
        'Member cash membership-card requests are retired. Authorized admin or staff users must grant membership-card access from the members directory.',
    });
  }
}
