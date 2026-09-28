import {
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  BookingStatus,
  CommerceCheckoutHoldKind,
  CommerceCheckoutHoldStatus,
  PaymentProvider,
  PaymentStage,
  PaymentStatus,
  Prisma,
  SubscriptionStatus,
  UserRole,
} from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import {
  assertWithinEffectiveGymHours,
  CoachAvailabilityCheckInput,
  CoachAvailabilityService,
} from '../availability/coach-availability.service';
import {
  PaymongoCheckoutResult,
  PaymongoCheckoutService,
} from '../../membership/payment/paymongo-checkout.service';
import { lockAndAssertVenueCoachWindow } from './venue-coach-scheduling';
import { getAmenityBookingBlockReason } from '../../bookings/amenity/amenity-reservability';
import { assertMembershipPurchaseEligible } from '../../membership/membership-eligibility';
import {
  CommerceCheckoutFlow,
  CommerceCheckoutReturnTarget,
} from './dto/checkout-return.dto';

const CHECKOUT_HOLD_TTL_MINUTES = 15;

export type CoachingCheckoutResponse = {
  appointment_id?: string | null;
  booking_id?: string | null;
  checkout_url: string | null;
  expires_at: string;
  hold_id: string;
  kind: CommerceCheckoutHoldKind;
  payment_id: string | null;
  membership_card_id?: string | null;
  recurring_plan_id?: string | null;
  subscription_id?: string | null;
  status: CommerceCheckoutHoldStatus;
};

export type CommerceCheckoutHoldState =
  | 'pending'
  | 'succeeded'
  | 'expired'
  | 'failed';

export type CommerceCheckoutHoldStatusResponse = {
  appointment_id: string | null;
  checkout_url: string | null;
  booking_id: string | null;
  expires_at: string;
  failure_reason: string | null;
  hold_id: string;
  kind: CommerceCheckoutHoldKind;
  membership_card_id: string | null;
  payment_id: string | null;
  recurring_plan_id: string | null;
  state: CommerceCheckoutHoldState;
  subscription_id: string | null;
};

export type OneTimeCheckoutInput = {
  amount: Prisma.Decimal;
  coachId: string;
  durationMinutes: number;
  idempotencyKey: string;
  memberNotes?: string;
  scheduledAt: Date;
  userId: string;
} & CommerceCheckoutReturnInput;

export type MonthlyCheckoutInput = {
  amount: Prisma.Decimal;
  coachId: string;
  durationMinutes: number;
  endDate: Date;
  idempotencyKey: string;
  preferredDays?: number[];
  preferredTime?: Date;
  sessionCount: number;
  startDate: Date;
  userId: string;
} & CommerceCheckoutReturnInput;

export type VenueCheckoutInput = {
  amenityId: string;
  amount: Prisma.Decimal;
  coachId?: string;
  endsAt: Date;
  idempotencyKey: string;
  memberNotes?: string;
  startsAt: Date;
  userId: string;
} & CommerceCheckoutReturnInput;

export type SubscriptionCheckoutInput = {
  amount: Prisma.Decimal;
  idempotencyKey: string;
  planCurrency?: string;
  planDescription?: string | null;
  planDurationDays?: number;
  planName?: string;
  planId: string;
  userId: string;
} & CommerceCheckoutReturnInput;

export type MembershipCardCheckoutInput = {
  amount: Prisma.Decimal;
  idempotencyKey: string;
  userId: string;
} & CommerceCheckoutReturnInput;

type CommerceCheckoutReturnInput = {
  returnTarget?: CommerceCheckoutReturnTarget;
  returnUrl?: string;
};

type CheckoutHoldWithPayment = Prisma.CommerceCheckoutHoldGetPayload<{
  include: { payment: true };
}>;

function checkoutUrlFromMetadata(
  metadata: Prisma.JsonValue | null | undefined,
): string | null {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    return null;
  }

  const value = (metadata as Record<string, unknown>).checkout_url;
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function toGatewayMetadata(
  result: PaymongoCheckoutResult,
): Prisma.InputJsonValue {
  return result.gatewayMetadata as Prisma.InputJsonValue;
}

@Injectable()
export class CoachingCommerceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly paymongoCheckoutService: PaymongoCheckoutService,
  ) {}

  async createOneTimeCheckout(
    input: OneTimeCheckoutInput,
  ): Promise<CoachingCheckoutResponse> {
    const returnQuery = this.buildCheckoutReturnQuery(input, 'coach-single');
    const idempotencyKey = this.normalizeIdempotencyKey(input.idempotencyKey);
    const existing = await this.findHoldByIdempotencyKey(idempotencyKey);
    if (existing) {
      if (
        existing.status === CommerceCheckoutHoldStatus.held &&
        existing.expires_at.getTime() <= Date.now()
      ) {
        await this.expireHolds();
      }

      const refreshed = await this.findHoldByIdempotencyKey(idempotencyKey);
      if (refreshed) {
        return this.resumeOrReturnExisting(refreshed, 'one-time coaching', returnQuery);
      }
    }

    const expiresAt = new Date(
      Date.now() + CHECKOUT_HOLD_TTL_MINUTES * 60 * 1000,
    );
    let created: CheckoutHoldWithPayment;
    try {
      created = await this.prisma.$transaction(async (tx) => {
        await this.lockCoachDay(tx, input.coachId, input.scheduledAt);
        await this.assertAvailable(tx, {
          coachId: input.coachId,
          durationMinutes: input.durationMinutes,
          startsAt: input.scheduledAt,
        });

        const hold = await tx.commerceCheckoutHold.create({
          data: {
            amount: input.amount,
            coach: { connect: { id: input.coachId } },
            duration_minutes: input.durationMinutes,
            expires_at: expiresAt,
            idempotency_key: idempotencyKey,
            kind: CommerceCheckoutHoldKind.one_time,
            member_notes: input.memberNotes ?? null,
            scheduled_at: input.scheduledAt,
            user: { connect: { id: input.userId } },
          },
        });
        const payment = await tx.payment.create({
          data: {
            amount: input.amount,
            idempotency_key: idempotencyKey,
            payment_stage: PaymentStage.full,
            payable_id: hold.id,
            payable_type: 'commerce_checkout_hold',
            provider: PaymentProvider.paymongo,
            status: PaymentStatus.pending,
            user: { connect: { id: input.userId } },
          },
        });
        await tx.commerceCheckoutHold.update({
          where: { id: hold.id },
          data: { payment_id: payment.id },
        });

        return tx.commerceCheckoutHold.findUniqueOrThrow({
          where: { id: hold.id },
          include: { payment: true },
        });
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const duplicate = await this.findHoldByIdempotencyKey(idempotencyKey);
        if (duplicate) {
          return this.resumeOrReturnExisting(duplicate, 'one-time coaching', returnQuery);
        }
      }
      throw error;
    }

    return this.startPaymongoCheckout(
      created,
      `One-time coaching appointment`,
      returnQuery,
    );
  }

  async createMonthlyCheckout(
    input: MonthlyCheckoutInput,
  ): Promise<CoachingCheckoutResponse> {
    const returnQuery = this.buildCheckoutReturnQuery(input, 'coach-monthly');
    const idempotencyKey = this.normalizeIdempotencyKey(input.idempotencyKey);
    const existing = await this.findHoldByIdempotencyKey(idempotencyKey);
    if (existing) {
      if (
        existing.status === CommerceCheckoutHoldStatus.held &&
        existing.expires_at.getTime() <= Date.now()
      ) {
        await this.expireHolds();
      }
      const refreshed = await this.findHoldByIdempotencyKey(idempotencyKey);
      if (refreshed) {
        return this.resumeOrReturnExisting(
          refreshed,
          'monthly coaching',
          returnQuery,
        );
      }
    }

    const expiresAt = new Date(
      Date.now() + CHECKOUT_HOLD_TTL_MINUTES * 60 * 1000,
    );
    let created: CheckoutHoldWithPayment;
    try {
      created = await this.prisma.$transaction(async (tx) => {
        await this.lockMonthlyMember(tx, input.userId);
        await this.assertMonthlyMemberAvailable(tx, input.userId);
        const hold = await tx.commerceCheckoutHold.create({
          data: {
            amount: input.amount,
            coach: { connect: { id: input.coachId } },
            duration_minutes: input.durationMinutes,
            end_date: input.endDate,
            expires_at: expiresAt,
            idempotency_key: idempotencyKey,
            kind: CommerceCheckoutHoldKind.monthly,
            preferred_days: input.preferredDays ?? [],
            preferred_time: input.preferredTime ?? null,
            session_count: input.sessionCount,
            start_date: input.startDate,
            user: { connect: { id: input.userId } },
          },
        });
        const payment = await tx.payment.create({
          data: {
            amount: input.amount,
            idempotency_key: idempotencyKey,
            payment_stage: PaymentStage.full,
            payable_id: hold.id,
            payable_type: 'commerce_checkout_hold',
            provider: PaymentProvider.paymongo,
            status: PaymentStatus.pending,
            user: { connect: { id: input.userId } },
          },
        });
        await tx.commerceCheckoutHold.update({
          where: { id: hold.id },
          data: { payment_id: payment.id },
        });

        return tx.commerceCheckoutHold.findUniqueOrThrow({
          where: { id: hold.id },
          include: { payment: true },
        });
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const duplicate = await this.findHoldByIdempotencyKey(idempotencyKey);
        if (duplicate) {
          return this.resumeOrReturnExisting(
            duplicate,
            'monthly coaching',
            returnQuery,
          );
        }
      }
      throw error;
    }

    return this.startPaymongoCheckout(
      created,
      `Monthly coaching enrollment`,
      returnQuery,
    );
  }

  async createVenueCheckout(
    input: VenueCheckoutInput,
  ): Promise<CoachingCheckoutResponse> {
    const returnQuery = this.buildCheckoutReturnQuery(input, 'venue-booking');
    const idempotencyKey = this.normalizeIdempotencyKey(input.idempotencyKey);
    const existing = await this.findHoldByIdempotencyKey(idempotencyKey);
    if (existing) {
      return this.resumeOrReturnExisting(existing, 'venue booking', returnQuery);
    }

    const expiresAt = new Date(
      Date.now() + CHECKOUT_HOLD_TTL_MINUTES * 60 * 1000,
    );
    let created: CheckoutHoldWithPayment;
    try {
      created = await this.prisma.$transaction(async (tx) => {
        await assertWithinEffectiveGymHours(
          tx,
          input.startsAt,
          input.endsAt,
          'venue booking',
        );
        if (input.coachId) {
          await lockAndAssertVenueCoachWindow(tx, {
            coachId: input.coachId,
            endsAt: input.endsAt,
            startsAt: input.startsAt,
          });
        }
        const lockKey = `${input.amenityId}:${CoachAvailabilityService.toGymDateKey(input.startsAt)}`;
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${lockKey}, 2))`;
        await this.assertVenueCapacity(tx, input);
        return this.createHoldWithPayment(tx, {
          amount: input.amount,
          amenity: { connect: { id: input.amenityId } },
          ...(input.coachId
            ? { coach: { connect: { id: input.coachId } } }
            : {}),
          duration_minutes: Math.ceil(
            (input.endsAt.getTime() - input.startsAt.getTime()) / (60 * 1000),
          ),
          ends_at: input.endsAt,
          expires_at: expiresAt,
          idempotency_key: idempotencyKey,
          kind: CommerceCheckoutHoldKind.venue,
          member_notes: input.memberNotes ?? null,
          scheduled_at: input.startsAt,
          user: { connect: { id: input.userId } },
        });
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const duplicate = await this.findHoldByIdempotencyKey(idempotencyKey);
        if (duplicate) {
          return this.resumeOrReturnExisting(duplicate, 'venue booking', returnQuery);
        }
      }
      throw error;
    }

    return this.startPaymongoCheckout(
      created,
      'Venue booking',
      returnQuery,
    );
  }

  async createSubscriptionCheckout(
    input: SubscriptionCheckoutInput,
  ): Promise<CoachingCheckoutResponse> {
    const returnQuery = this.buildCheckoutReturnQuery(input, 'membership-subscription');
    const idempotencyKey = this.normalizeIdempotencyKey(input.idempotencyKey);
    const existing = await this.findHoldByIdempotencyKey(idempotencyKey);
    if (existing) {
      return this.resumeOrReturnExisting(
        existing,
        'membership subscription',
        returnQuery,
      );
    }

    const expiresAt = new Date(
      Date.now() + CHECKOUT_HOLD_TTL_MINUTES * 60 * 1000,
    );
    let created: CheckoutHoldWithPayment;
    try {
      created = await this.prisma.$transaction(async (tx) => {
        await this.lockUser(tx, input.userId, 3);
        await assertMembershipPurchaseEligible(tx, input.userId);
        await this.assertSubscriptionCheckoutAvailable(tx, input.userId);
        return this.createHoldWithPayment(tx, {
          amount: input.amount,
          expires_at: expiresAt,
          idempotency_key: idempotencyKey,
          kind: CommerceCheckoutHoldKind.subscription,
          membership_plan_currency_snapshot: input.planCurrency ?? 'PHP',
          membership_plan_description_snapshot: input.planDescription ?? null,
          membership_plan_name_snapshot: input.planName ?? null,
          membership_plan_price_snapshot: input.amount,
          membership_duration_days_snapshot: input.planDurationDays ?? null,
          membership_plan: { connect: { id: input.planId } },
          user: { connect: { id: input.userId } },
        });
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const duplicate = await this.findHoldByIdempotencyKey(idempotencyKey);
        if (duplicate) {
          return this.resumeOrReturnExisting(
            duplicate,
            'membership subscription',
            returnQuery,
          );
        }
      }
      throw error;
    }

    return this.startPaymongoCheckout(
      created,
      'Membership subscription',
      returnQuery,
    );
  }

  async createMembershipCardCheckout(
    input: MembershipCardCheckoutInput,
  ): Promise<CoachingCheckoutResponse> {
    const returnQuery = this.buildCheckoutReturnQuery(input, 'membership-card');
    const idempotencyKey = this.normalizeIdempotencyKey(input.idempotencyKey);
    const existing = await this.findHoldByIdempotencyKey(idempotencyKey);
    if (existing) {
      return this.resumeOrReturnExisting(existing, 'membership card', returnQuery);
    }

    const expiresAt = new Date(
      Date.now() + CHECKOUT_HOLD_TTL_MINUTES * 60 * 1000,
    );
    let created: CheckoutHoldWithPayment;
    try {
      created = await this.prisma.$transaction(async (tx) => {
        await this.lockUser(tx, input.userId, 4);
        await assertMembershipPurchaseEligible(tx, input.userId);
        const activeCard = await tx.membershipCard.findFirst({
          where: { user_id: input.userId, status: 'active' },
          select: { id: true },
        });
        if (activeCard) {
          throw new ConflictException({
            type: 'CONFLICT',
            title: 'Membership Card Already Active',
            status: 409,
            detail: 'This account already has an active membership card.',
          });
        }

        return this.createHoldWithPayment(tx, {
          amount: input.amount,
          expires_at: expiresAt,
          idempotency_key: idempotencyKey,
          kind: CommerceCheckoutHoldKind.membership_card,
          user: { connect: { id: input.userId } },
        });
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const duplicate = await this.findHoldByIdempotencyKey(idempotencyKey);
        if (duplicate) {
          return this.resumeOrReturnExisting(duplicate, 'membership card', returnQuery);
        }
      }
      throw error;
    }

    return this.startPaymongoCheckout(created, 'Membership card', returnQuery);
  }

  private buildCheckoutReturnQuery(
    input: CommerceCheckoutReturnInput,
    flow: CommerceCheckoutFlow,
  ): Record<string, string> {
    const client = input.returnTarget ?? 'web';
    return {
      client,
      flow,
      ...(input.returnUrl ? { return_url: input.returnUrl } : {}),
    };
  }

  async expireHolds(now = new Date()): Promise<number> {
    return CoachAvailabilityService.expireHoldsWithClient(this.prisma, now);
  }

  async getHoldStatusForUser(
    holdId: string,
    requesterId: string,
    requesterRole: UserRole,
  ): Promise<CommerceCheckoutHoldStatusResponse> {
    await this.expireHolds();

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

    const isStaff =
      requesterRole === UserRole.admin || requesterRole === UserRole.staff;
    if (!isStaff && hold.user_id !== requesterId) {
      throw new ForbiddenException({
        type: 'FORBIDDEN',
        title: 'Forbidden',
        status: 403,
        detail: 'You do not have permission to access this checkout hold.',
      });
    }

    return this.toHoldStatusResponse(hold);
  }

  async releaseHoldForPayment(
    paymentId: string,
    reason: string,
    status: CommerceCheckoutHoldStatus = CommerceCheckoutHoldStatus.failed,
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const payment = await tx.payment.findUnique({
        where: { id: paymentId },
        select: { payable_id: true, payable_type: true },
      });
      if (payment?.payable_type !== 'commerce_checkout_hold') {
        return;
      }

      const now = new Date();
      await tx.commerceCheckoutHold.updateMany({
        where: {
          id: payment.payable_id,
          status: CommerceCheckoutHoldStatus.held,
        },
        data: {
          failure_reason: reason,
          released_at: now,
          status,
        },
      });
      await tx.payment.updateMany({
        where: {
          id: paymentId,
          status: { in: [PaymentStatus.pending, PaymentStatus.processing] },
        },
        data: { rejection_reason: reason, status: PaymentStatus.failed },
      });
    });
  }

  private async startPaymongoCheckout(
    hold: CheckoutHoldWithPayment,
    description: string,
    extraReturnQuery: Record<string, string> = {},
  ): Promise<CoachingCheckoutResponse> {
    if (!hold.payment) {
      throw new ConflictException({
        type: 'CONFLICT',
        title: 'Checkout Payment Missing',
        status: 409,
        detail: 'The internal coaching checkout hold is missing its payment.',
      });
    }

    if (hold.status !== CommerceCheckoutHoldStatus.held) {
      return this.toResponse(hold);
    }

    try {
      const checkout = await this.paymongoCheckoutService.createCheckoutSession(
        {
          amount: Math.round(Number(hold.payment.amount) * 100),
          cancelQuery: { hold_id: hold.id, ...extraReturnQuery },
          description,
          idempotencyKey: hold.payment.idempotency_key,
          metadata: {
            coaching_checkout_hold_id: hold.id,
            hold_id: hold.id,
            kind: hold.kind,
            payment_id: hold.payment.id,
          },
          successQuery: { hold_id: hold.id, ...extraReturnQuery },
        },
      );
      const payment = await this.prisma.payment.update({
        where: { id: hold.payment.id },
        data: {
          gateway_metadata: toGatewayMetadata(checkout),
          provider_ref: checkout.providerRef,
        },
      });

      return this.toResponse({ ...hold, payment });
    } catch (error) {
      await this.releaseHoldForPayment(
        hold.payment.id,
        'PayMongo checkout session could not be created.',
      );
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        {
          type: 'BAD_GATEWAY',
          title: 'Checkout Session Creation Failed',
          status: HttpStatus.BAD_GATEWAY,
          detail: 'Unable to start the PayMongo checkout session.',
        },
        HttpStatus.BAD_GATEWAY,
      );
    }
  }

  private async createHoldWithPayment(
    tx: Prisma.TransactionClient,
    data: Prisma.CommerceCheckoutHoldCreateInput,
  ): Promise<CheckoutHoldWithPayment> {
    const hold = await tx.commerceCheckoutHold.create({ data });
    const payment = await tx.payment.create({
      data: {
        amount: hold.amount,
        idempotency_key: hold.idempotency_key,
        payment_stage: PaymentStage.full,
        payable_id: hold.id,
        payable_type: 'commerce_checkout_hold',
        provider: PaymentProvider.paymongo,
        status: PaymentStatus.pending,
        user: { connect: { id: hold.user_id } },
      },
    });
    await tx.commerceCheckoutHold.update({
      where: { id: hold.id },
      data: { payment_id: payment.id },
    });
    return tx.commerceCheckoutHold.findUniqueOrThrow({
      where: { id: hold.id },
      include: { payment: true },
    });
  }

  private async assertSubscriptionCheckoutAvailable(
    tx: Prisma.TransactionClient,
    userId: string,
  ): Promise<void> {
    const now = new Date();
    // Expire only rows whose recorded entitlement window has ended. A live
    // duplicate remains visible and is rejected by the checks/index below.
    await tx.subscription.updateMany({
      where: {
        user_id: userId,
        status: { in: [SubscriptionStatus.active, SubscriptionStatus.past_due] },
        expires_at: { lte: now },
      },
      data: { status: SubscriptionStatus.expired },
    });

    const [active, pendingSubscription, pendingHold] = await Promise.all([
      tx.subscription.findFirst({
        where: {
          user_id: userId,
          status: {
            in: [
              SubscriptionStatus.active,
              SubscriptionStatus.past_due,
              SubscriptionStatus.cancelled,
            ],
          },
          starts_at: { lte: now },
          expires_at: { gt: now },
        },
        select: { id: true },
      }),
      tx.subscription.findFirst({
        where: { user_id: userId, status: SubscriptionStatus.pending_payment },
        select: { id: true },
      }),
      tx.commerceCheckoutHold.findFirst({
        where: {
          user_id: userId,
          kind: CommerceCheckoutHoldKind.subscription,
          status: CommerceCheckoutHoldStatus.held,
          expires_at: { gt: now },
        },
        select: { id: true },
      }),
    ]);

    if (active || pendingSubscription || pendingHold) {
      throw new ConflictException({
        type: 'CONFLICT',
        title: 'Active Membership Already Exists',
        status: 409,
        detail:
          'You already have an active or pending Gym Membership. Finish or resolve it before starting a new one.',
      });
    }
  }

  private async assertMonthlyMemberAvailable(
    tx: Prisma.TransactionClient,
    memberId: string,
  ): Promise<void> {
    const [activePlan, liveHold] = await Promise.all([
      tx.recurringCoachingPlan.findFirst({
        where: {
          member_id: memberId,
          status: {
            in: ['active' as const, 'paused' as const],
          },
        },
        select: { id: true },
      }),
      tx.commerceCheckoutHold.findFirst({
        where: {
          user_id: memberId,
          kind: CommerceCheckoutHoldKind.monthly,
          status: CommerceCheckoutHoldStatus.held,
          expires_at: { gt: new Date() },
          payment: {
            is: {
              payable_type: 'commerce_checkout_hold',
              payment_stage: PaymentStage.full,
              provider: PaymentProvider.paymongo,
              status: { in: [PaymentStatus.pending, PaymentStatus.processing] },
            },
          },
        },
        select: { id: true },
      }),
    ]);

    if (activePlan || liveHold) {
      throw new ConflictException({
        type: 'RECURRING_COACHING_ACTIVE_ENTITLEMENT',
        title: 'Monthly Coaching Enrollment Already Exists',
        status: 409,
        detail:
          'This member already has an active or pending monthly coaching enrollment. Finish or resolve it before starting another coach enrollment.',
        conflict_kind: activePlan ? 'active_entitlement' : 'live_checkout',
      });
    }
  }

  private async assertVenueCapacity(
    tx: Prisma.TransactionClient,
    input: VenueCheckoutInput,
  ): Promise<void> {
    const amenity = await tx.amenity.findUnique({
      where: { id: input.amenityId },
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

    const [bookings, holds] = await Promise.all([
      tx.amenityBooking.count({
        where: {
          amenity_id: input.amenityId,
          status: { in: [BookingStatus.confirmed, BookingStatus.completed] },
          starts_at: { lt: input.endsAt },
          ends_at: { gt: input.startsAt },
        },
      }),
      tx.commerceCheckoutHold.count({
        where: {
          amenity_id: input.amenityId,
          ends_at: { gt: input.startsAt },
          scheduled_at: { lt: input.endsAt },
          status: CommerceCheckoutHoldStatus.held,
          expires_at: { gt: new Date() },
        },
      }),
    ]);
    if (bookings + holds >= amenity.capacity) {
      throw new ConflictException({
        type: 'CONFLICT',
        title: 'Venue Slot Unavailable',
        status: 409,
        detail: 'The requested venue slot is already at capacity.',
      });
    }
  }

  private async findHoldByIdempotencyKey(
    idempotencyKey: string,
  ): Promise<CheckoutHoldWithPayment | null> {
    return this.prisma.commerceCheckoutHold.findUnique({
      where: { idempotency_key: idempotencyKey },
      include: { payment: true },
    });
  }

  private resumeOrReturnExisting(
    hold: CheckoutHoldWithPayment,
    description: string,
    extraReturnQuery: Record<string, string> = {},
  ): Promise<CoachingCheckoutResponse> {
    if (
      hold.status === CommerceCheckoutHoldStatus.held &&
      hold.payment?.status === PaymentStatus.pending &&
      !checkoutUrlFromMetadata(hold.payment.gateway_metadata)
    ) {
      return this.startPaymongoCheckout(hold, description, extraReturnQuery);
    }

    return Promise.resolve(this.toResponse(hold));
  }

  private toResponse(
    hold: CheckoutHoldWithPayment,
  ): CoachingCheckoutResponse {
    return {
      appointment_id: hold.appointment_id,
      booking_id: hold.booking_id,
      checkout_url: checkoutUrlFromMetadata(hold.payment?.gateway_metadata),
      expires_at: hold.expires_at.toISOString(),
      hold_id: hold.id,
      kind: hold.kind,
      payment_id: hold.payment_id,
      membership_card_id: hold.membership_card_id,
      recurring_plan_id: hold.recurring_plan_id,
      subscription_id: hold.subscription_id,
      status: hold.status,
    };
  }

  private toHoldStatusResponse(
    hold: CheckoutHoldWithPayment,
  ): CommerceCheckoutHoldStatusResponse {
    return {
      appointment_id: hold.appointment_id,
      checkout_url: checkoutUrlFromMetadata(hold.payment?.gateway_metadata),
      booking_id: hold.booking_id,
      expires_at: hold.expires_at.toISOString(),
      failure_reason:
        hold.failure_reason ?? hold.payment?.rejection_reason ?? null,
      hold_id: hold.id,
      kind: hold.kind,
      membership_card_id: hold.membership_card_id,
      payment_id: hold.payment_id,
      recurring_plan_id: hold.recurring_plan_id,
      state: this.toNormalizedHoldState(hold),
      subscription_id: hold.subscription_id,
    };
  }

  private toNormalizedHoldState(
    hold: Pick<CheckoutHoldWithPayment, 'status' | 'payment'>,
  ): CommerceCheckoutHoldState {
    if (hold.status === CommerceCheckoutHoldStatus.consumed) {
      return 'succeeded';
    }

    if (hold.status === CommerceCheckoutHoldStatus.expired) {
      return 'expired';
    }

    if (
      hold.status === CommerceCheckoutHoldStatus.failed ||
      hold.status === CommerceCheckoutHoldStatus.released ||
      hold.payment?.status === PaymentStatus.failed
    ) {
      return 'failed';
    }

    return 'pending';
  }

  private normalizeIdempotencyKey(value: string): string {
    const normalized = value?.trim();
    if (!normalized || normalized.length > 128) {
      throw new ConflictException({
        type: 'CONFLICT',
        title: 'Idempotency Key Required',
        status: 409,
        detail: 'A stable Idempotency-Key is required for coaching checkout.',
      });
    }
    return normalized;
  }

  private async assertAvailable(
    client: Prisma.TransactionClient,
    input: CoachAvailabilityCheckInput,
  ): Promise<void> {
    await CoachAvailabilityService.assertAvailableWithClient(client, input);
  }

  private async lockCoachDay(
    tx: Prisma.TransactionClient,
    coachId: string,
    startsAt: Date,
  ): Promise<void> {
    const lockKey = `${coachId}:${CoachAvailabilityService.toGymDateKey(startsAt)}`;
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))`;
  }

  private async lockMonthlyMember(
    tx: Prisma.TransactionClient,
    memberId: string,
  ): Promise<void> {
    const lockKey = `monthly:${memberId}`;
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${lockKey}, 1))`;
  }

  private async lockUser(
    tx: Prisma.TransactionClient,
    userId: string,
    namespace: number,
  ): Promise<void> {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${userId}, ${namespace}))`;
  }
}
