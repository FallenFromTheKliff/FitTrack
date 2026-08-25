import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AppointmentStatus,
  BookingStatus,
  CommerceCheckoutHoldKind,
  CommerceCheckoutHoldStatus,
  CommerceCheckoutHold,
  MembershipCardSource,
  MembershipCardStatus,
  PayableType,
  Payment,
  PaymentProvider,
  PaymentStage,
  PaymentStatus,
  Prisma,
  RecurringCoachingBillingCycleStatus,
  RecurringCoachingFrequency,
  RecurringCoachingPlanStatus,
  RelationshipStatus,
  SubscriptionStatus,
  UserStatus,
} from '@prisma/client';
import { randomBytes } from 'node:crypto';

import {
  BaseRepository,
  PaginatedResult,
} from '../../common/base-repository/base-repository';
import { PrismaService } from '../../prisma/prisma.service';
import { CoachAvailabilityService } from '../../coaching/availability/coach-availability.service';
import { lockAndAssertVenueCoachWindow } from '../../coaching/commerce/venue-coach-scheduling';
import { getAmenityBookingBlockReason } from '../../bookings/amenity/amenity-reservability';
import { PaymentFilterDTO, PaymentHistoryDTO } from './dto/payment.dto';

type PaymentWithRelations = Prisma.PaymentGetPayload<{
  include: {
    user: { include: { profile: true } };
    verifier: { include: { profile: true } };
  };
}>;

type SubscriptionPaymentContext = {
  id: string;
  user_id: string;
};

type BookingPaymentContext = {
  id: string;
  user_id: string;
};

type CoachingPaymentContext = {
  id: string;
  user_id: string;
};

type RecurringCoachingPaymentContext = {
  id: string;
  user_id: string;
};

export type PaymongoMembershipCardWebhookInput = {
  gatewayEventId: string;
  gatewayMetadata: Prisma.InputJsonValue;
  verifiedAt: Date;
};

export type PaymongoMembershipCardFailureInput = {
  gatewayEventId: string;
  gatewayMetadata: Prisma.InputJsonValue;
  rejectionReason: string;
};

export type PaymongoMembershipCardTransition = {
  payment: Payment;
  transitioned: boolean;
  membershipCardStateChanged: boolean;
};

export type PaymongoCommerceCheckoutTransition = {
  payment: Payment;
  productCreated: boolean;
  productId: string | null;
  productKind: CommerceCheckoutHoldKind | null;
  transitioned: boolean;
};

export type PaymongoCommerceCheckoutFailureInput = {
  gatewayEventId: string;
  gatewayMetadata: Prisma.InputJsonValue;
  rejectionReason: string;
};

export type CommerceCheckoutReconciliationContext = {
  hold: CommerceCheckoutHold;
  payment: Payment;
};

@Injectable()
export class PaymentRepository extends BaseRepository {
  constructor(prisma: PrismaService) {
    super(prisma);
  }

  private readonly paymentInclude = {
    user: { include: { profile: true } },
    verifier: { include: { profile: true } },
  } as const;

  async findCommerceCheckoutForReconciliationOrThrow(
    holdId: string,
    requesterId: string,
  ): Promise<CommerceCheckoutReconciliationContext> {
    const hold = await this.prisma.commerceCheckoutHold.findUnique({
      where: { id: holdId },
      include: { payment: true },
    });

    if (!hold) {
      throw new NotFoundException({
        type: 'NOT_FOUND',
        title: 'Checkout Hold Not Found',
        status: 404,
        detail: `Checkout hold with id "${holdId}" does not exist.`,
      });
    }

    if (hold.user_id !== requesterId) {
      throw new ForbiddenException({
        type: 'FORBIDDEN',
        title: 'Forbidden',
        status: 403,
        detail: 'You can only reconcile your own checkout.',
      });
    }

    if (
      !hold.payment ||
      hold.payment_id !== hold.payment.id ||
      hold.payment.payable_type !== PayableType.commerce_checkout_hold ||
      hold.payment.payable_id !== hold.id ||
      hold.payment.provider !== PaymentProvider.paymongo ||
      hold.payment.user_id !== hold.user_id
    ) {
      throw this.invalidCheckoutHold(hold.id, 'a valid PayMongo payment link');
    }

    return { hold, payment: hold.payment };
  }

  getMyPayments(
    userId: string,
    dto: PaymentHistoryDTO,
  ): Promise<PaginatedResult<Payment>> {
    return this.paginateByUserIdWithDateRange<Payment>(
      this.prisma.payment,
      userId,
      {
        start_date: dto.start_date,
        end_date: dto.end_date,
        dateField: 'created_at',
      },
      { orderBy: { created_at: 'desc' } },
      { page: dto.page, limit: dto.limit },
    );
  }

  async completeOpenMembershipCardPaymentsForActiveCards(
    userId: string,
  ): Promise<void> {
    await this.prisma.$executeRaw`
      UPDATE payments AS payment
      SET
        status = 'completed',
        verified_at = COALESCE(
          payment.verified_at,
          membership_card.verified_at,
          membership_card.activated_at,
          NOW()
        ),
        verified_by = COALESCE(payment.verified_by, membership_card.verified_by),
        rejection_reason = NULL,
        updated_at = NOW()
      FROM membership_cards AS membership_card
      WHERE
        payment.payable_type = 'membership_card'
        AND payment.payable_id = membership_card.id
        AND payment.user_id = ${userId}
        AND payment.provider = 'cash'
        AND payment.status IN ('pending', 'processing', 'awaiting_verification')
        AND membership_card.status = 'active'
    `;
  }

  async completePaymongoMembershipCardPayment(
    paymentId: string,
    input: PaymongoMembershipCardWebhookInput,
  ): Promise<PaymongoMembershipCardTransition> {
    return this.transaction(async (tx) => {
      const payment = await tx.payment.findUnique({
        where: { id: paymentId },
      });

      if (!payment) {
        throw new NotFoundException({
          type: 'NOT_FOUND',
          title: 'Payment Not Found',
          status: 404,
          detail: `Payment with id "${paymentId}" does not exist.`,
        });
      }

      if (
        payment.payable_type !== PayableType.membership_card ||
        payment.provider !== PaymentProvider.paymongo
      ) {
        return {
          payment,
          transitioned: false,
          membershipCardStateChanged: false,
        };
      }

      const paymentTransition = await tx.payment.updateMany({
        where: {
          id: paymentId,
          payable_type: PayableType.membership_card,
          provider: PaymentProvider.paymongo,
          status: {
            in: [PaymentStatus.pending, PaymentStatus.processing],
          },
        },
        data: {
          status: PaymentStatus.completed,
          verified_at: input.verifiedAt,
          gateway_event_id: input.gatewayEventId,
          gateway_metadata: input.gatewayMetadata,
          rejection_reason: null,
        },
      });

      const currentPayment = await tx.payment.findUnique({
        where: { id: paymentId },
      });

      if (!currentPayment) {
        throw new NotFoundException({
          type: 'NOT_FOUND',
          title: 'Payment Not Found',
          status: 404,
          detail: `Payment with id "${paymentId}" does not exist.`,
        });
      }

      if (paymentTransition.count === 0) {
        return {
          payment: currentPayment,
          transitioned: false,
          membershipCardStateChanged: false,
        };
      }

      const card = await tx.membershipCard.findUnique({
        where: { id: payment.payable_id },
      });

      if (!card) {
        throw new NotFoundException({
          type: 'NOT_FOUND',
          title: 'Membership Card Not Found',
          status: 404,
          detail: `MembershipCard with id "${payment.payable_id}" does not exist.`,
        });
      }

      const cardTransition = await tx.membershipCard.updateMany({
        where: {
          id: card.id,
          user_id: payment.user_id,
          source: MembershipCardSource.paymongo,
          status: MembershipCardStatus.pending_verification,
        },
        data: {
          activated_at: input.verifiedAt,
          revoke_reason: null,
          revoked_at: null,
          revoked_by: null,
          status: MembershipCardStatus.active,
          verified_at: input.verifiedAt,
          verified_by: null,
        },
      });

      if (cardTransition.count > 0) {
        const owner = await tx.user.findUnique({
          where: { id: payment.user_id },
          select: { id: true, qr_code_token: true, status: true },
        });

        if (
          owner &&
          (owner.status === UserStatus.pending || !owner.qr_code_token)
        ) {
          await tx.user.update({
            where: { id: owner.id },
            data: {
              ...(owner.status === UserStatus.pending
                ? { status: UserStatus.active }
                : {}),
              ...(!owner.qr_code_token
                ? { qr_code_token: randomBytes(32).toString('hex') }
                : {}),
            },
          });
        }
      }

      return {
        payment: currentPayment,
        transitioned: true,
        membershipCardStateChanged: cardTransition.count > 0,
      };
    });
  }

  async failPaymongoMembershipCardPayment(
    paymentId: string,
    input: PaymongoMembershipCardFailureInput,
  ): Promise<PaymongoMembershipCardTransition> {
    return this.transaction(async (tx) => {
      const payment = await tx.payment.findUnique({
        where: { id: paymentId },
      });

      if (!payment) {
        throw new NotFoundException({
          type: 'NOT_FOUND',
          title: 'Payment Not Found',
          status: 404,
          detail: `Payment with id "${paymentId}" does not exist.`,
        });
      }

      if (
        payment.payable_type !== PayableType.membership_card ||
        payment.provider !== PaymentProvider.paymongo
      ) {
        return {
          payment,
          transitioned: false,
          membershipCardStateChanged: false,
        };
      }

      const paymentTransition = await tx.payment.updateMany({
        where: {
          id: paymentId,
          payable_type: PayableType.membership_card,
          provider: PaymentProvider.paymongo,
          status: {
            in: [PaymentStatus.pending, PaymentStatus.processing],
          },
        },
        data: {
          status: PaymentStatus.failed,
          gateway_event_id: input.gatewayEventId,
          gateway_metadata: input.gatewayMetadata,
          rejection_reason: input.rejectionReason,
        },
      });

      const currentPayment = await tx.payment.findUnique({
        where: { id: paymentId },
      });

      if (!currentPayment) {
        throw new NotFoundException({
          type: 'NOT_FOUND',
          title: 'Payment Not Found',
          status: 404,
          detail: `Payment with id "${paymentId}" does not exist.`,
        });
      }

      if (paymentTransition.count === 0) {
        return {
          payment: currentPayment,
          transitioned: false,
          membershipCardStateChanged: false,
        };
      }

      const cardTransition = await tx.membershipCard.updateMany({
        where: {
          id: payment.payable_id,
          user_id: payment.user_id,
          source: MembershipCardSource.paymongo,
          status: MembershipCardStatus.pending_verification,
        },
        data: {
          activated_at: null,
          revoke_reason: input.rejectionReason,
          revoked_at: new Date(),
          status: MembershipCardStatus.revoked,
        },
      });

      return {
        payment: currentPayment,
        transitioned: true,
        membershipCardStateChanged: cardTransition.count > 0,
      };
    });
  }

  /**
   * Completes a full PayMongo checkout and creates exactly one paid product
   * record in the same transaction. Holds are the only payable rows allowed
   * to reach this path for new commerce flows.
   */
  async completePaymongoCommerceCheckout(
    paymentId: string,
    input: PaymongoMembershipCardWebhookInput,
  ): Promise<PaymongoCommerceCheckoutTransition> {
    return this.transaction(async (tx) => {
      const payment = await tx.payment.findUnique({
        where: { id: paymentId },
      });
      if (!payment) {
        throw new NotFoundException({
          type: 'NOT_FOUND',
          title: 'Payment Not Found',
          status: 404,
          detail: `Payment with id "${paymentId}" does not exist.`,
        });
      }

      if (
        payment.payable_type !== PayableType.commerce_checkout_hold ||
        payment.provider !== PaymentProvider.paymongo
      ) {
        return {
          payment,
          productCreated: false,
          productId: null,
          productKind: null,
          transitioned: false,
        };
      }

      const hold = await tx.commerceCheckoutHold.findUnique({
        where: { id: payment.payable_id },
      });
      if (!hold) {
        throw new NotFoundException({
          type: 'NOT_FOUND',
          title: 'Checkout Hold Not Found',
          status: 404,
          detail: `Checkout hold with id "${payment.payable_id}" does not exist.`,
        });
      }

      if (
        payment.status !== PaymentStatus.pending &&
        payment.status !== PaymentStatus.processing
      ) {
        return {
          payment,
          productCreated: hold.status === CommerceCheckoutHoldStatus.consumed,
          productId: this.checkoutProductId(hold),
          productKind: hold.kind,
          transitioned: false,
        };
      }

      const now = input.verifiedAt;
      if (
        hold.status !== CommerceCheckoutHoldStatus.held ||
        hold.expires_at <= now
      ) {
        await tx.commerceCheckoutHold.updateMany({
          where: {
            id: hold.id,
            status: CommerceCheckoutHoldStatus.held,
          },
          data: {
            failure_reason: 'Checkout hold expired before payment completed.',
            released_at: now,
            status: CommerceCheckoutHoldStatus.expired,
          },
        });
        const expiredPayment = await tx.payment.update({
          where: { id: payment.id },
          data: {
            gateway_event_id: input.gatewayEventId,
            gateway_metadata: input.gatewayMetadata,
            rejection_reason: 'Checkout hold expired before payment completed.',
            status: PaymentStatus.failed,
          },
        });
        return {
          payment: expiredPayment,
          productCreated: false,
          productId: null,
          productKind: hold.kind,
          transitioned: true,
        };
      }

      const paymentTransition = await tx.payment.updateMany({
        where: {
          id: payment.id,
          payable_type: PayableType.commerce_checkout_hold,
          provider: PaymentProvider.paymongo,
          status: { in: [PaymentStatus.pending, PaymentStatus.processing] },
        },
        data: {
          gateway_event_id: input.gatewayEventId,
          gateway_metadata: input.gatewayMetadata,
          rejection_reason: null,
          status: PaymentStatus.completed,
          verified_at: input.verifiedAt,
        },
      });

      if (paymentTransition.count === 0) {
        const current = await tx.payment.findUniqueOrThrow({
          where: { id: payment.id },
        });
        return {
          payment: current,
          productCreated: false,
          productId: this.checkoutProductId(hold),
          productKind: hold.kind,
          transitioned: false,
        };
      }

      const productId = await this.createPaidCommerceProduct(tx, hold, payment);
      const consumedHold = await tx.commerceCheckoutHold.update({
        where: { id: hold.id },
        data: {
          consumed_at: now,
          status: CommerceCheckoutHoldStatus.consumed,
          ...(hold.kind === CommerceCheckoutHoldKind.one_time
            ? { appointment_id: productId }
            : {}),
          ...(hold.kind === CommerceCheckoutHoldKind.monthly
            ? { recurring_plan_id: productId }
            : {}),
          ...(hold.kind === CommerceCheckoutHoldKind.venue
            ? { booking_id: productId }
            : {}),
          ...(hold.kind === CommerceCheckoutHoldKind.subscription
            ? { subscription_id: productId }
            : {}),
          ...(hold.kind === CommerceCheckoutHoldKind.membership_card
            ? { membership_card_id: productId }
            : {}),
        },
      });
      const completedPayment = await tx.payment.findUniqueOrThrow({
        where: { id: payment.id },
      });

      return {
        payment: completedPayment,
        productCreated: true,
        productId: this.checkoutProductId(consumedHold) ?? productId,
        productKind: hold.kind,
        transitioned: true,
      };
    });
  }

  async failPaymongoCommerceCheckout(
    paymentId: string,
    input: PaymongoCommerceCheckoutFailureInput,
  ): Promise<PaymongoCommerceCheckoutTransition> {
    return this.transaction(async (tx) => {
      const payment = await tx.payment.findUnique({ where: { id: paymentId } });
      if (!payment) {
        throw new NotFoundException({
          type: 'NOT_FOUND',
          title: 'Payment Not Found',
          status: 404,
          detail: `Payment with id "${paymentId}" does not exist.`,
        });
      }
      if (
        payment.payable_type !== PayableType.commerce_checkout_hold ||
        payment.provider !== PaymentProvider.paymongo
      ) {
        return {
          payment,
          productCreated: false,
          productId: null,
          productKind: null,
          transitioned: false,
        };
      }

      const hold = await tx.commerceCheckoutHold.findUnique({
        where: { id: payment.payable_id },
      });
      const paymentTransition = await tx.payment.updateMany({
        where: {
          id: payment.id,
          status: { in: [PaymentStatus.pending, PaymentStatus.processing] },
        },
        data: {
          gateway_event_id: input.gatewayEventId,
          gateway_metadata: input.gatewayMetadata,
          rejection_reason: input.rejectionReason,
          status: PaymentStatus.failed,
        },
      });
      if (hold) {
        await tx.commerceCheckoutHold.updateMany({
          where: {
            id: hold.id,
            status: CommerceCheckoutHoldStatus.held,
          },
          data: {
            failure_reason: input.rejectionReason,
            released_at: new Date(),
            status: CommerceCheckoutHoldStatus.failed,
          },
        });
      }
      const current = await tx.payment.findUniqueOrThrow({
        where: { id: payment.id },
      });
      return {
        payment: current,
        productCreated: false,
        productId: null,
        productKind: hold?.kind ?? null,
        transitioned: paymentTransition.count > 0,
      };
    });
  }

  private async createPaidCommerceProduct(
    tx: Prisma.TransactionClient,
    hold: CommerceCheckoutHold,
    payment: Payment,
  ): Promise<string> {
    const paidAt = payment.verified_at ?? new Date();

    if (hold.kind === CommerceCheckoutHoldKind.one_time) {
      if (!hold.coach_id || !hold.scheduled_at || !hold.duration_minutes) {
        throw this.invalidCheckoutHold(hold.id, 'one-time coaching fields');
      }

      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${hold.coach_id + ':' + CoachAvailabilityService.toGymDateKey(hold.scheduled_at)}, 0))`;
      await CoachAvailabilityService.assertAvailableWithClient(tx, {
        coachId: hold.coach_id,
        durationMinutes: hold.duration_minutes,
        excludeHoldIds: [hold.id],
        startsAt: hold.scheduled_at,
        now: paidAt,
      });
      const coach = await tx.coachProfile.findUniqueOrThrow({
        where: { id: hold.coach_id },
        select: { gym_commission_pct: true },
      });
      const gymRevenue = payment.amount
        .mul(new Prisma.Decimal(coach.gym_commission_pct))
        .div(100)
        .toDecimalPlaces(2);
      const appointment = await tx.coachAppointment.create({
        data: {
          balance_amount: new Prisma.Decimal(0),
          balance_paid_at: paidAt,
          coach: { connect: { id: hold.coach_id } },
          coach_earnings: payment.amount.minus(gymRevenue).toDecimalPlaces(2),
          downpayment_amount: new Prisma.Decimal(0),
          downpayment_paid_at: paidAt,
          gym_revenue: gymRevenue,
          is_free_session: false,
          member_notes: hold.member_notes,
          scheduled_at: hold.scheduled_at,
          status: AppointmentStatus.confirmed,
          total_amount: payment.amount,
          user: { connect: { id: hold.user_id } },
          duration_minutes: hold.duration_minutes,
        },
      });
      return appointment.id;
    }

    if (hold.kind === CommerceCheckoutHoldKind.monthly) {
      if (
        !hold.coach_id ||
        !hold.start_date ||
        !hold.end_date ||
        !hold.session_count ||
        !hold.duration_minutes
      ) {
        throw this.invalidCheckoutHold(hold.id, 'monthly coaching fields');
      }

      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${hold.coach_id + ':' + hold.user_id}, 1))`;
      const existingPlan = await tx.recurringCoachingPlan.findFirst({
        where: {
          coach_id: hold.coach_id,
          member_id: hold.user_id,
          status: {
            in: [
              RecurringCoachingPlanStatus.active,
              RecurringCoachingPlanStatus.paused,
            ],
          },
        },
        select: { id: true },
      });
      if (existingPlan) {
        throw new ConflictException({
          type: 'CONFLICT',
          title: 'Recurring Coaching Enrollment Already Exists',
          status: 409,
          detail:
            'This member already has an active enrollment with this coach.',
        });
      }

      const plan = await tx.recurringCoachingPlan.create({
        data: {
          coach: { connect: { id: hold.coach_id } },
          duration_minutes: hold.duration_minutes,
          end_date: hold.end_date,
          frequency: RecurringCoachingFrequency.monthly,
          member: { connect: { id: hold.user_id } },
          preferred_days: hold.preferred_days,
          preferred_time: hold.preferred_time ?? new Date(Date.UTC(1970, 0, 1)),
          quoted_amount: payment.amount,
          start_date: hold.start_date,
          status: RecurringCoachingPlanStatus.active,
          total_sessions: hold.session_count,
        },
      });

      await tx.recurringCoachingBillingCycle.create({
        data: {
          amount: payment.amount,
          cycle_end_date: hold.end_date,
          cycle_start_date: hold.start_date,
          due_date: hold.start_date,
          grace_period_ends_at: new Date(
            hold.start_date.getTime() + 7 * 24 * 60 * 60 * 1000,
          ),
          paid_at: paidAt,
          payment_id: payment.id,
          recurring_plan: { connect: { id: plan.id } },
          status: RecurringCoachingBillingCycleStatus.paid,
        },
      });

      const relationship = await tx.coachClientRelationship.findFirst({
        where: {
          coach_id: hold.coach_id,
          member_id: hold.user_id,
          status: {
            in: [
              RelationshipStatus.pending,
              RelationshipStatus.active,
              RelationshipStatus.paused,
            ],
          },
        },
      });
      if (
        relationship?.status === RelationshipStatus.active ||
        relationship?.status === RelationshipStatus.paused
      ) {
        throw new ConflictException({
          type: 'CONFLICT',
          title: 'Coach-Client Relationship Already Active',
          status: 409,
          detail:
            'This member already has an active relationship with this coach.',
        });
      }
      if (relationship) {
        await tx.coachClientRelationship.update({
          where: { id: relationship.id },
          data: {
            ended_at: null,
            started_at: paidAt,
            status: RelationshipStatus.active,
          },
        });
      } else {
        await tx.coachClientRelationship.create({
          data: {
            coach: { connect: { id: hold.coach_id } },
            member: { connect: { id: hold.user_id } },
            started_at: paidAt,
            status: RelationshipStatus.active,
          },
        });
      }

      return plan.id;
    }

    if (hold.kind === CommerceCheckoutHoldKind.venue) {
      if (!hold.amenity_id || !hold.scheduled_at || !hold.ends_at) {
        throw this.invalidCheckoutHold(hold.id, 'venue booking fields');
      }
      if (hold.coach_id) {
        await lockAndAssertVenueCoachWindow(tx, {
          coachId: hold.coach_id,
          endsAt: hold.ends_at,
          excludeHoldIds: [hold.id],
          now: paidAt,
          startsAt: hold.scheduled_at,
        });
      }
      const lockKey = `${hold.amenity_id}:${CoachAvailabilityService.toGymDateKey(hold.scheduled_at)}`;
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${lockKey}, 2))`;
      await this.assertVenueCapacityWithClient(
        tx,
        hold.amenity_id,
        hold.scheduled_at,
        hold.ends_at,
      );
      const booking = await tx.amenityBooking.create({
        data: {
          amenity: { connect: { id: hold.amenity_id } },
          balance_amount: new Prisma.Decimal(0),
          balance_paid_at: paidAt,
          ...(hold.coach_id
            ? { coach: { connect: { id: hold.coach_id } } }
            : {}),
          downpayment_amount: new Prisma.Decimal(0),
          downpayment_paid_at: paidAt,
          ends_at: hold.ends_at,
          notes: hold.member_notes,
          starts_at: hold.scheduled_at,
          status: BookingStatus.confirmed,
          total_amount: payment.amount,
          user: { connect: { id: hold.user_id } },
        },
      });

      // Persist the paid coach add-on as an appointment in the same
      // idempotent payment transition as its venue booking.
      if (hold.coach_id) {
        const [amenity, coach] = await Promise.all([
          tx.amenity.findUnique({
            where: { id: hold.amenity_id },
            select: { hourly_rate: true },
          }),
          tx.coachProfile.findUnique({
            where: { id: hold.coach_id },
            select: { gym_commission_pct: true },
          }),
        ]);
        if (!amenity || !coach) {
          throw this.invalidCheckoutHold(hold.id, 'venue coach add-on');
        }
        const durationHours = new Prisma.Decimal(
          hold.ends_at.getTime() - hold.scheduled_at.getTime(),
        ).div(60 * 60 * 1000);
        const venueAmount = new Prisma.Decimal(amenity.hourly_rate)
          .mul(durationHours)
          .toDecimalPlaces(2);
        const coachAmount = payment.amount.minus(venueAmount).toDecimalPlaces(2);
        const gymRevenue = coachAmount
          .mul(new Prisma.Decimal(coach.gym_commission_pct))
          .div(100)
          .toDecimalPlaces(2);
        const coachAppointment = await tx.coachAppointment.create({
          data: {
            balance_amount: new Prisma.Decimal(0),
            balance_paid_at: paidAt,
            coach: { connect: { id: hold.coach_id } },
            coach_earnings: coachAmount.minus(gymRevenue).toDecimalPlaces(2),
            downpayment_amount: new Prisma.Decimal(0),
            downpayment_paid_at: paidAt,
            duration_minutes: Math.ceil(
              (hold.ends_at.getTime() - hold.scheduled_at.getTime()) /
                (60 * 1000),
            ),
            gym_revenue: gymRevenue,
            is_free_session: false,
            member_notes: hold.member_notes,
            scheduled_at: hold.scheduled_at,
            status: AppointmentStatus.confirmed,
            total_amount: coachAmount,
            user: { connect: { id: hold.user_id } },
          },
        });
        await tx.commerceCheckoutHold.update({
          where: { id: hold.id },
          data: { appointment_id: coachAppointment.id },
        });
      }
      return booking.id;
    }

    if (hold.kind === CommerceCheckoutHoldKind.subscription) {
      if (!hold.membership_plan_id) {
        throw this.invalidCheckoutHold(hold.id, 'membership plan');
      }
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${hold.user_id}, 3))`;
      const active = await tx.subscription.findFirst({
        where: {
          user_id: hold.user_id,
          status: {
            in: [SubscriptionStatus.active, SubscriptionStatus.past_due],
          },
        },
        select: { id: true },
      });
      if (active) {
        throw new ConflictException({
          type: 'CONFLICT',
          title: 'Active Membership Already Exists',
          status: 409,
          detail: 'This member already has an active membership.',
        });
      }
      // Legacy pending product rows are retained for reconciliation but cannot
      // remain a second live membership when a new full payment succeeds.
      await tx.subscription.updateMany({
        where: {
          user_id: hold.user_id,
          status: SubscriptionStatus.pending_payment,
        },
        data: { status: SubscriptionStatus.cancelled },
      });
      const plan = await tx.membershipPlan.findUniqueOrThrow({
        where: { id: hold.membership_plan_id },
        select: { duration_days: true },
      });
      const expiresAt = new Date(paidAt);
      expiresAt.setDate(expiresAt.getDate() + plan.duration_days);
      const subscription = await tx.subscription.create({
        data: {
          expires_at: expiresAt,
          payment_id: payment.id,
          plan: { connect: { id: hold.membership_plan_id } },
          starts_at: paidAt,
          status: SubscriptionStatus.active,
          user: { connect: { id: hold.user_id } },
        },
      });
      return subscription.id;
    }

    if (hold.kind === CommerceCheckoutHoldKind.membership_card) {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${hold.user_id}, 4))`;
      const existingCard = await tx.membershipCard.findUnique({
        where: { user_id: hold.user_id },
      });
      if (existingCard?.status === MembershipCardStatus.active) {
        throw new ConflictException({
          type: 'CONFLICT',
          title: 'Membership Card Already Active',
          status: 409,
          detail: 'This account already has an active membership card.',
        });
      }
      const card = existingCard
        ? await tx.membershipCard.update({
            where: { id: existingCard.id },
            data: {
              activated_at: paidAt,
              price: payment.amount,
              purchased_at: paidAt,
              revoke_reason: null,
              revoked_at: null,
              revoked_by: null,
              source: MembershipCardSource.paymongo,
              status: MembershipCardStatus.active,
              verified_at: paidAt,
              verified_by: null,
            },
          })
        : await tx.membershipCard.create({
            data: {
              activated_at: paidAt,
              price: payment.amount,
              purchased_at: paidAt,
              source: MembershipCardSource.paymongo,
              status: MembershipCardStatus.active,
              verified_at: paidAt,
              user: { connect: { id: hold.user_id } },
            },
          });
      const owner = await tx.user.findUnique({
        where: { id: hold.user_id },
        select: { id: true, qr_code_token: true, status: true },
      });
      if (
        owner &&
        (owner.status === UserStatus.pending || !owner.qr_code_token)
      ) {
        await tx.user.update({
          where: { id: owner.id },
          data: {
            ...(owner.status === UserStatus.pending
              ? { status: UserStatus.active }
              : {}),
            ...(!owner.qr_code_token
              ? { qr_code_token: randomBytes(32).toString('hex') }
              : {}),
          },
        });
      }
      return card.id;
    }

    throw this.invalidCheckoutHold(hold.id, 'supported commerce kind');
  }

  private async assertVenueCapacityWithClient(
    tx: Prisma.TransactionClient,
    amenityId: string,
    startsAt: Date,
    endsAt: Date,
  ): Promise<void> {
    const amenity = await tx.amenity.findUnique({
      where: { id: amenityId },
      select: {
        capacity: true,
        is_active: true,
        is_mapped: true,
        is_reservable: true,
        status: true,
      },
    });
    if (!amenity) {
      throw new ConflictException({
        type: 'CONFLICT',
        title: 'Venue Not Reservable',
        status: 409,
        detail: 'The requested venue no longer exists.',
      });
    }
    const blockReason = getAmenityBookingBlockReason(amenity);
    if (blockReason) {
      throw new ConflictException({
        type: 'CONFLICT',
        title: 'Venue Not Reservable',
        status: 409,
        detail: blockReason,
      });
    }
    const [bookingCount, holdCount] = await Promise.all([
      tx.amenityBooking.count({
        where: {
          amenity_id: amenityId,
          ends_at: { gt: startsAt },
          starts_at: { lt: endsAt },
          status: { in: [BookingStatus.confirmed, BookingStatus.completed] },
        },
      }),
      tx.commerceCheckoutHold.count({
        where: {
          amenity_id: amenityId,
          ends_at: { gt: startsAt },
          scheduled_at: { lt: endsAt },
          expires_at: { gt: new Date() },
          status: CommerceCheckoutHoldStatus.held,
        },
      }),
    ]);
    if (bookingCount + holdCount >= amenity.capacity) {
      throw new ConflictException({
        type: 'CONFLICT',
        title: 'Venue Slot Unavailable',
        status: 409,
        detail: 'The requested venue slot is already at capacity.',
      });
    }
  }

  private checkoutProductId(
    hold: Pick<
      CommerceCheckoutHold,
      | 'appointment_id'
      | 'booking_id'
      | 'membership_card_id'
      | 'recurring_plan_id'
      | 'subscription_id'
    >,
  ): string | null {
    return (
      hold.appointment_id ??
      hold.recurring_plan_id ??
      hold.booking_id ??
      hold.subscription_id ??
      hold.membership_card_id ??
      null
    );
  }

  private invalidCheckoutHold(id: string, fields: string): ConflictException {
    return new ConflictException({
      type: 'CONFLICT',
      title: 'Invalid Checkout Hold',
      status: 409,
      detail: `Checkout hold "${id}" is missing ${fields}.`,
    });
  }

  findPaymentByIdForOwnerOrThrow(
    id: string,
    userId: string,
  ): Promise<PaymentWithRelations> {
    return this.findByIdAndAssertOwnership<PaymentWithRelations>(
      this.prisma.payment,
      id,
      userId,
      'Payment',
      this.paymentInclude,
    );
  }

  findPaymentByIdForStaffOrThrow(id: string): Promise<PaymentWithRelations> {
    return this.findByIdOrThrow<PaymentWithRelations>(
      this.prisma.payment,
      id,
      'Payment',
      this.paymentInclude,
    );
  }

  getAllPayments(
    dto: PaymentFilterDTO,
  ): Promise<PaginatedResult<PaymentWithRelations>> {
    const where: Prisma.PaymentWhereInput = {};

    if (dto.status) where.status = dto.status;
    if (dto.payable_type) where.payable_type = dto.payable_type;

    return this.paginate<PaymentWithRelations>(
      this.prisma.payment,
      {
        where,
        include: this.paymentInclude,
        orderBy: { created_at: 'desc' },
      },
      { page: dto.page, limit: dto.limit },
    );
  }

  createPayment(data: Prisma.PaymentCreateInput): Promise<Payment> {
    return this.create<Payment>(this.prisma.payment, data);
  }

  findPaymentByIdempotencyKey(idempotencyKey: string): Promise<Payment | null> {
    return this.findUniqueWhere<Payment>(this.prisma.payment, {
      idempotency_key: idempotencyKey,
    });
  }

  findPaymentByGatewayEventId(gatewayEventId: string): Promise<Payment | null> {
    return this.findUniqueWhere<Payment>(this.prisma.payment, {
      gateway_event_id: gatewayEventId,
    });
  }

  findPaymentByProviderRefOrThrow(providerRef: string): Promise<Payment> {
    return this.findUniqueWhereOrThrow<Payment>(
      this.prisma.payment,
      { provider_ref: providerRef },
      'Payment',
    );
  }

  findPaymentByIdOrThrow(id: string): Promise<Payment> {
    return this.findByIdOrThrow<Payment>(this.prisma.payment, id, 'Payment');
  }

  findLatestPaymentForPayableStage(
    payableType: PayableType,
    payableId: string,
    paymentStage: PaymentStage,
  ): Promise<Payment | null> {
    return this.prisma.payment.findFirst({
      where: {
        payable_type: payableType,
        payable_id: payableId,
        payment_stage: paymentStage,
      },
      orderBy: { created_at: 'desc' },
    });
  }

  async findLatestPaymentsForPayableIds(
    payableType: PayableType,
    payableIds: string[],
  ): Promise<Payment[]> {
    if (payableIds.length === 0) {
      return Promise.resolve([]);
    }

    const where: Prisma.PaymentWhereInput =
      payableType === PayableType.coaching
        ? {
            OR: [
              { payable_type: payableType, payable_id: { in: payableIds } },
              {
                payable_type: PayableType.commerce_checkout_hold,
                commerce_checkout_hold: {
                  is: { appointment_id: { in: payableIds } },
                },
              },
            ],
            status: { not: PaymentStatus.failed },
          }
        : {
            payable_type: payableType,
            payable_id: { in: payableIds },
            status: { not: PaymentStatus.failed },
          };
    const payments = await this.prisma.payment.findMany({
      where,
      ...(payableType === PayableType.coaching
        ? {
            include: {
              commerce_checkout_hold: { select: { appointment_id: true } },
            },
          }
        : {}),
      orderBy: [{ created_at: 'desc' }],
    });
    if (payableType !== PayableType.coaching) return payments;
    return payments.map((payment) => {
      const hold = (
        payment as Payment & {
          commerce_checkout_hold?: { appointment_id: string | null } | null;
        }
      ).commerce_checkout_hold;
      return hold?.appointment_id
        ? { ...payment, payable_id: hold.appointment_id }
        : payment;
    });
  }

  updatePayment(id: string, data: Prisma.PaymentUpdateInput): Promise<Payment> {
    return this.updateById<Payment>(this.prisma.payment, id, data);
  }

  findSubscriptionPaymentContextOrThrow(
    id: string,
  ): Promise<SubscriptionPaymentContext> {
    return this.findByIdOrThrow<SubscriptionPaymentContext>(
      this.prisma.subscription,
      id,
      'Subscription',
      undefined,
      { id: true, user_id: true },
    );
  }

  findBookingPaymentContextOrThrow(id: string): Promise<BookingPaymentContext> {
    return this.findByIdOrThrow<BookingPaymentContext>(
      this.prisma.amenityBooking,
      id,
      'AmenityBooking',
      undefined,
      { id: true, user_id: true },
    );
  }

  findCoachingPaymentContextOrThrow(
    id: string,
  ): Promise<CoachingPaymentContext> {
    return this.findByIdOrThrow<CoachingPaymentContext>(
      this.prisma.coachAppointment,
      id,
      'CoachAppointment',
      undefined,
      { id: true, user_id: true },
    );
  }

  async findRecurringCoachingPaymentContextOrThrow(
    id: string,
  ): Promise<RecurringCoachingPaymentContext> {
    const cycle =
      await this.prisma.recurringCoachingBillingCycle.findUniqueOrThrow({
        where: { id },
        select: {
          id: true,
          recurring_plan: {
            select: {
              member_id: true,
            },
          },
        },
      });

    return {
      id: cycle.id,
      user_id: cycle.recurring_plan.member_id,
    };
  }
}
