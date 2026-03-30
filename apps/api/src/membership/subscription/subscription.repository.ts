import { ConflictException, Injectable } from '@nestjs/common';
import { MembershipPlan, Payment, Prisma, Subscription } from '@prisma/client';

import {
  BaseRepository,
  PaginatedResult,
} from '../../common/base-repository/base-repository';
import { PrismaService } from '../../prisma/prisma.service';
import { PaginationDTO } from './dto/subscription.dto';

type SubscriptionWithPlan = Prisma.SubscriptionGetPayload<{
  include: { plan: true };
}>;

type SubscriptionNotificationContext = Prisma.SubscriptionGetPayload<{
  include: {
    plan: true;
    user: {
      include: {
        auth_identities: {
          where: { provider: { in: ['email', 'google'] } };
          orderBy: [{ is_primary: 'desc' }, { created_at: 'asc' }];
          select: {
            identifier: true;
            provider: true;
            is_primary: true;
            verified_at: true;
          };
        };
        notification_prefs: true;
        profile: true;
      };
    };
  };
}>;

const CURRENT_SUBSCRIPTION_STATUSES = [
  'active',
  'past_due',
  'pending_payment',
] as const;

const ACCESSIBLE_SUBSCRIPTION_STATUSES = ['active', 'past_due'] as const;
const DUPLICATE_SUBSCRIPTION_STATUSES = [
  'active',
  'past_due',
  'pending_payment',
] as const;
const WARNING_FOLLOW_UP_STATUSES = ['active', 'past_due', 'cancelled'] as const;
const EXPIRING_SUBSCRIPTION_STATUSES = [
  'active',
  'past_due',
  'cancelled',
] as const;

type SubscriptionInitiationRecord = {
  subscription: SubscriptionWithPlan;
  payment: Payment;
};

@Injectable()
export class SubscriptionRepository extends BaseRepository {
  constructor(prisma: PrismaService) {
    super(prisma);
  }

  listActivePlans(
    dto: PaginationDTO,
  ): Promise<PaginatedResult<MembershipPlan>> {
    return this.paginate<MembershipPlan>(
      this.prisma.membershipPlan,
      {
        where: { is_active: true },
        orderBy: [{ sort_order: 'asc' }, { created_at: 'desc' }],
      },
      { page: dto.page, limit: dto.limit },
    );
  }

  findActivePlanByIdOrThrow(id: string): Promise<MembershipPlan> {
    return this.findOneOrThrow<MembershipPlan>(
      this.prisma.membershipPlan,
      { id, is_active: true },
      'MembershipPlan',
    );
  }

  findPlanByIdOrThrow(id: string): Promise<MembershipPlan> {
    return this.findByIdOrThrow<MembershipPlan>(
      this.prisma.membershipPlan,
      id,
      'MembershipPlan',
    );
  }

  createPlan(data: Prisma.MembershipPlanCreateInput): Promise<MembershipPlan> {
    return this.create<MembershipPlan>(this.prisma.membershipPlan, data);
  }

  updatePlan(
    id: string,
    data: Prisma.MembershipPlanUpdateInput,
  ): Promise<MembershipPlan> {
    return this.updateById<MembershipPlan>(
      this.prisma.membershipPlan,
      id,
      data,
    );
  }

  findCurrentSubscriptionByUserIdOrThrow(
    userId: string,
  ): Promise<SubscriptionWithPlan> {
    return this.findOneOrThrow<SubscriptionWithPlan>(
      this.prisma.subscription,
      this.buildCurrentSubscriptionWhere(userId),
      'Subscription',
      { plan: true },
      [{ created_at: 'desc' }],
    );
  }

  findCancellableSubscriptionByUserIdOrThrow(
    userId: string,
  ): Promise<SubscriptionWithPlan> {
    return this.findOneOrThrow<SubscriptionWithPlan>(
      this.prisma.subscription,
      {
        user_id: userId,
        status: { in: ['active', 'past_due'] },
      },
      'Subscription',
      { plan: true },
      [{ created_at: 'desc' }],
    );
  }

  findSubscriptionByIdOrThrow(id: string): Promise<SubscriptionWithPlan> {
    return this.findByIdOrThrow<SubscriptionWithPlan>(
      this.prisma.subscription,
      id,
      'Subscription',
      { plan: true },
    );
  }

  findSubscriptionNotificationContextByIdOrThrow(
    id: string,
  ): Promise<SubscriptionNotificationContext> {
    return this.findByIdOrThrow<SubscriptionNotificationContext>(
      this.prisma.subscription,
      id,
      'Subscription',
      this.subscriptionNotificationInclude,
    );
  }

  async createPendingSubscriptionWithPayment(input: {
    userId: string;
    planId: string;
    amount: Prisma.Decimal | number;
    idempotencyKey: string;
    provider: 'paymongo';
  }): Promise<SubscriptionInitiationRecord> {
    try {
      return await this.transaction(async (tx) => {
        const existing = await tx.subscription.findFirst({
          where: this.buildDuplicateSubscriptionWhere(input.userId),
          select: { id: true },
        });

        if (existing) {
          throw this.buildDuplicateSubscriptionConflict();
        }

        const subscription = await tx.subscription.create({
          data: {
            user: { connect: { id: input.userId } },
            plan: { connect: { id: input.planId } },
            status: 'pending_payment',
          },
          include: { plan: true },
        });

        const payment = await tx.payment.create({
          data: {
            user: { connect: { id: input.userId } },
            payable_type: 'subscription',
            payable_id: subscription.id,
            payment_stage: 'full',
            amount: input.amount,
            provider: input.provider,
            idempotency_key: input.idempotencyKey,
            status: 'pending',
          },
        });

        return { subscription, payment };
      });
    } catch (error) {
      if (this.isDuplicateSubscriptionIndexError(error)) {
        throw this.buildDuplicateSubscriptionConflict();
      }

      throw error;
    }
  }

  updateSubscription(
    id: string,
    data: Prisma.SubscriptionUpdateInput,
  ): Promise<Subscription> {
    return this.updateById<Subscription>(this.prisma.subscription, id, data);
  }

  activateSubscription(
    id: string,
    paymentId: string,
    startsAt: Date,
    expiresAt: Date,
  ): Promise<Subscription> {
    return this.updateSubscription(id, {
      status: 'active',
      payment_id: paymentId,
      starts_at: startsAt,
      expires_at: expiresAt,
    });
  }

  findSevenDayWarningCandidates(
    now: Date,
    windowEnd: Date,
  ): Promise<SubscriptionNotificationContext[]> {
    return this.findAll<SubscriptionNotificationContext>(
      this.prisma.subscription,
      {
        expires_at: { gte: now, lte: windowEnd },
        status: 'active',
        warned_7d_at: null,
      },
      this.subscriptionNotificationInclude,
      [{ expires_at: 'asc' }],
    );
  }

  findThreeDayWarningCandidates(
    now: Date,
    windowEnd: Date,
  ): Promise<SubscriptionNotificationContext[]> {
    return this.findAll<SubscriptionNotificationContext>(
      this.prisma.subscription,
      {
        expires_at: { gte: now, lte: windowEnd },
        status: { in: [...WARNING_FOLLOW_UP_STATUSES] },
        warned_3d_at: null,
      },
      this.subscriptionNotificationInclude,
      [{ expires_at: 'asc' }],
    );
  }

  findOneDayWarningCandidates(
    now: Date,
    windowEnd: Date,
  ): Promise<SubscriptionNotificationContext[]> {
    return this.findAll<SubscriptionNotificationContext>(
      this.prisma.subscription,
      {
        expires_at: { gte: now, lte: windowEnd },
        status: { in: [...WARNING_FOLLOW_UP_STATUSES] },
        warned_1d_at: null,
      },
      this.subscriptionNotificationInclude,
      [{ expires_at: 'asc' }],
    );
  }

  findExpiringSubscriptions(
    now: Date,
  ): Promise<SubscriptionNotificationContext[]> {
    return this.findAll<SubscriptionNotificationContext>(
      this.prisma.subscription,
      {
        expires_at: { lt: now },
        status: { in: [...EXPIRING_SUBSCRIPTION_STATUSES] },
      },
      this.subscriptionNotificationInclude,
      [{ expires_at: 'asc' }],
    );
  }

  markWarningSent(
    id: string,
    warnedField: 'warned_7d_at' | 'warned_3d_at' | 'warned_1d_at',
    warnedAt: Date,
    markPastDue: boolean,
  ): Promise<Subscription> {
    return this.updateSubscription(id, {
      ...(markPastDue ? { status: 'past_due' } : {}),
      [warnedField]: warnedAt,
    });
  }

  expireSubscription(id: string): Promise<Subscription> {
    return this.updateSubscription(id, { status: 'expired' });
  }

  hasSubscriptionAccess(userId: string): Promise<boolean> {
    return this.exists(
      this.prisma.subscription,
      this.buildAccessibleSubscriptionWhere(userId),
    );
  }

  hasCoachingAccess(userId: string): Promise<boolean> {
    return this.exists(
      this.prisma.subscription,
      this.buildAccessibleCoachingWhere(userId),
    );
  }

  private buildCurrentSubscriptionWhere(
    userId: string,
  ): Prisma.SubscriptionWhereInput {
    return {
      user_id: userId,
      OR: [
        { status: { in: [...CURRENT_SUBSCRIPTION_STATUSES] } },
        {
          status: 'cancelled',
          expires_at: { gt: new Date() },
        },
      ],
    };
  }

  private buildAccessibleSubscriptionWhere(
    userId: string,
  ): Prisma.SubscriptionWhereInput {
    return {
      user_id: userId,
      OR: [
        { status: { in: [...ACCESSIBLE_SUBSCRIPTION_STATUSES] } },
        {
          status: 'cancelled',
          expires_at: { gt: new Date() },
        },
      ],
    };
  }

  private buildAccessibleCoachingWhere(
    userId: string,
  ): Prisma.SubscriptionWhereInput {
    return {
      ...this.buildAccessibleSubscriptionWhere(userId),
      plan: {
        includes_coaching: true,
      },
    };
  }

  private get subscriptionNotificationInclude() {
    return {
      plan: true,
      user: {
        include: {
          auth_identities: {
            where: { provider: { in: ['email', 'google'] } },
            orderBy: [{ is_primary: 'desc' }, { created_at: 'asc' }],
            select: {
              identifier: true,
              provider: true,
              is_primary: true,
              verified_at: true,
            },
          },
          notification_prefs: true,
          profile: true,
        },
      },
    } as const;
  }

  private buildDuplicateSubscriptionWhere(
    userId: string,
  ): Prisma.SubscriptionWhereInput {
    return {
      user_id: userId,
      status: { in: [...DUPLICATE_SUBSCRIPTION_STATUSES] },
    };
  }

  private buildDuplicateSubscriptionConflict(): ConflictException {
    return new ConflictException({
      type: 'CONFLICT',
      title: 'Subscription Already Exists',
      status: 409,
      detail:
        'You already have an active or pending subscription. Finish or resolve it before starting a new one.',
    });
  }

  private isDuplicateSubscriptionIndexError(error: unknown): boolean {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002' &&
      String(error.message).includes('subscriptions_one_active_per_user')
    );
  }
}
