import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import {
  AccountDeletionRequestStatus,
  AuthProvider,
  CommerceCheckoutHoldKind,
  CommerceCheckoutHoldStatus,
  MembershipCatalogSettings,
  MembershipCard,
  MembershipCardSource,
  MembershipCardStatus,
  MembershipPlan,
  Payment,
  PaymentProvider,
  PaymentStage,
  PaymentStatus,
  PayableType,
  Prisma,
  Subscription,
  SubscriptionStatus,
  UserRole,
  UserStatus,
} from '@prisma/client';

import {
  BaseRepository,
  PaginatedResult,
} from '../../common/base-repository/base-repository';
import { PrismaService } from '../../prisma/prisma.service';
import { PaginationDTO } from './dto/subscription.dto';

export type SubscriptionWithPlan = Prisma.SubscriptionGetPayload<{
  include: { plan: true };
}>;

const OPERATIONS_DASHBOARD_INCLUDE = {
  plan: true,
  user: {
    include: {
      profile: true,
    },
  },
} as const;

export type MembershipOperationsSubscriptionRecord =
  Prisma.SubscriptionGetPayload<{
    include: typeof OPERATIONS_DASHBOARD_INCLUDE;
  }>;

export type MembershipOperationsDashboardRecord = {
  expiringMembershipCount: number;
  expiringMemberships: MembershipOperationsSubscriptionRecord[];
  generatedAt: Date;
  recentlyActivated: MembershipOperationsSubscriptionRecord[];
  recentlyActivatedCount: number;
  totalActiveMembersCount: number;
};

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
  'cancelled',
] as const;

const ACCESSIBLE_SUBSCRIPTION_STATUSES = [
  'active',
  'past_due',
  'cancelled',
] as const;
const DUPLICATE_SUBSCRIPTION_STATUSES = [
  'active',
  'past_due',
  'cancelled',
] as const;
const WARNING_FOLLOW_UP_STATUSES = ['active', 'past_due', 'cancelled'] as const;
const EXPIRING_SUBSCRIPTION_STATUSES = [
  'active',
  'past_due',
  'cancelled',
] as const;
const DEFAULT_MEMBERSHIP_CARD_PRICE = new Prisma.Decimal(400);
const MEMBERSHIP_CATALOG_SETTINGS_ID =
  '94f956b6-98ad-447b-b22a-aa111d7c4000';

const FREE_DAY_PASS_LIFECYCLE_SELECT = {
  id: true,
  role: true,
  status: true,
  deletedAt: true,
  email_verified_at: true,
  phone_verified_at: true,
  free_day_pass_granted_at: true,
  free_day_pass_expires_at: true,
  free_day_pass_granted_by: true,
  free_day_pass_redeemed_at: true,
  free_day_pass_revoked_at: true,
  free_day_pass_revoke_reason: true,
} as const;

type FreeDayPassUserRecord = Prisma.UserGetPayload<{
  select: typeof FREE_DAY_PASS_LIFECYCLE_SELECT;
}>;

export type FreeDayPassLifecycleRecord = {
  before: FreeDayPassUserRecord;
  user: FreeDayPassUserRecord;
};

type SubscriptionInitiationRecord = {
  subscription: SubscriptionWithPlan;
  payment: Payment;
};

export type CashMembershipSaleRecord = {
  payment: Payment;
  membershipCard: MembershipCard | null;
  subscription: SubscriptionWithPlan | null;
  replayed?: boolean;
};

export type FreeDayPassEligibilityRecord = {
  eligible: boolean;
  expiresAt: Date | null;
  grantedAt: Date | null;
  revokedAt: Date | null;
  redeemedAt: Date | null;
  reason: string | null;
};

export type MembershipAccessCandidateRecord = {
  memberId: string;
  email: string | null;
  displayName: string;
  membershipCardStatus: MembershipCardStatus | null;
  subscription: {
    id: string;
    status: SubscriptionStatus;
    planName: string;
    startsAt: Date | null;
    expiresAt: Date | null;
  } | null;
  freePassExpiresAt: Date | null;
};

export type OnsiteMembershipCandidateRecord = {
  id: string;
  email: string | null;
  displayName: string;
  membershipCardStatus: MembershipCardStatus | null;
  subscription: {
    id: string;
    status: SubscriptionStatus;
    planName: string;
    startsAt: Date | null;
    expiresAt: Date | null;
  } | null;
};

export type RevokedMembershipSubscriptionRecord = {
  before: SubscriptionWithPlan;
  subscription: SubscriptionWithPlan;
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

  async getCatalogSettings(): Promise<MembershipCatalogSettings> {
    const existing = await this.prisma.membershipCatalogSettings.findFirst();
    if (existing) {
      return existing;
    }

    return this.prisma.membershipCatalogSettings.create({
      data: {
        id: MEMBERSHIP_CATALOG_SETTINGS_ID,
        membership_card_price: DEFAULT_MEMBERSHIP_CARD_PRICE,
      },
    });
  }

  async updateCatalogSettings(
    membershipCardPrice: Prisma.Decimal,
  ): Promise<MembershipCatalogSettings> {
    const existing = await this.prisma.membershipCatalogSettings.findFirst({
      select: { id: true },
    });

    if (existing) {
      return this.prisma.membershipCatalogSettings.update({
        where: { id: existing.id },
        data: {
          membership_card_price: membershipCardPrice,
        },
      });
    }

    return this.prisma.membershipCatalogSettings.create({
      data: {
        id: MEMBERSHIP_CATALOG_SETTINGS_ID,
        membership_card_price: membershipCardPrice,
      },
    });
  }

  async getOperationsDashboard(
    now = new Date(),
  ): Promise<MembershipOperationsDashboardRecord> {
    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const sevenDaysAhead = new Date(now);
    sevenDaysAhead.setDate(sevenDaysAhead.getDate() + 7);

    const activeSubscriptionWhere = {
      status: { in: [...CURRENT_SUBSCRIPTION_STATUSES] },
      starts_at: { lte: now },
      expires_at: { gt: now },
      user: {
        deletedAt: null,
      },
    } satisfies Prisma.SubscriptionWhereInput;
    const recentlyActivatedWhere = {
      ...activeSubscriptionWhere,
      starts_at: {
        gte: sevenDaysAgo,
        lte: now,
      },
    } satisfies Prisma.SubscriptionWhereInput;
    const expiringWhere = {
      status: { in: [...EXPIRING_SUBSCRIPTION_STATUSES] },
      expires_at: {
        gte: now,
        lte: sevenDaysAhead,
      },
      user: {
        deletedAt: null,
      },
    } satisfies Prisma.SubscriptionWhereInput;

    const [
      totalActiveMembersCount,
      recentlyActivatedCount,
      expiringMembershipCount,
      recentlyActivated,
      expiringMemberships,
    ] = await Promise.all([
      this.prisma.subscription.count({ where: activeSubscriptionWhere }),
      this.prisma.subscription.count({ where: recentlyActivatedWhere }),
      this.prisma.subscription.count({ where: expiringWhere }),
      this.prisma.subscription.findMany({
        where: recentlyActivatedWhere,
        include: OPERATIONS_DASHBOARD_INCLUDE,
        orderBy: [{ starts_at: 'desc' }, { created_at: 'desc' }],
        take: 6,
      }),
      this.prisma.subscription.findMany({
        where: expiringWhere,
        include: OPERATIONS_DASHBOARD_INCLUDE,
        orderBy: [{ expires_at: 'asc' }, { created_at: 'desc' }],
        take: 6,
      }),
    ]);

    return {
      expiringMembershipCount,
      expiringMemberships,
      generatedAt: now,
      recentlyActivated,
      recentlyActivatedCount,
      totalActiveMembersCount,
    };
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

  countSubscriptionsByPlanId(planId: string): Promise<number> {
    return this.count(this.prisma.subscription, { plan_id: planId });
  }

  listManagementPlans(
    dto: PaginationDTO,
  ): Promise<PaginatedResult<MembershipPlan>> {
    return this.paginate<MembershipPlan>(
      this.prisma.membershipPlan,
      {
        orderBy: [
          { is_active: 'desc' },
          { sort_order: 'asc' },
          { created_at: 'desc' },
        ],
      },
      { page: dto.page, limit: dto.limit },
    );
  }

  async listMembershipAccessCandidates(input: {
    action: 'grant' | 'revoke';
    product: 'membership_card' | 'gym_membership' | 'free_day_pass';
    search?: string;
  }): Promise<MembershipAccessCandidateRecord[]> {
    const now = new Date();
    const currentSubscriptionWhere: Prisma.SubscriptionWhereInput = {
      status: { in: [...CURRENT_SUBSCRIPTION_STATUSES] },
      starts_at: { lte: now },
      expires_at: { gt: now },
    };
    const searchTerms = (input.search ?? '')
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 4);
    const searchClauses: Prisma.UserWhereInput[] = searchTerms.map((term) => ({
      OR: [
        {
          profile: {
            is: {
              first_name: { contains: term, mode: 'insensitive' },
            },
          },
        },
        {
          profile: {
            is: {
              last_name: { contains: term, mode: 'insensitive' },
            },
          },
        },
        {
          auth_identities: {
            some: {
              provider: AuthProvider.email,
              identifier: { contains: term, mode: 'insensitive' },
            },
          },
        },
      ],
    }));

    const baseWhere: Prisma.UserWhereInput = {
      deletedAt: null,
      deletion_requests: {
        none: { status: AccountDeletionRequestStatus.pending },
      },
      role: UserRole.member,
      status: UserStatus.active,
      OR: [
        { email_verified_at: { not: null } },
        { phone_verified_at: { not: null } },
      ],
      ...(searchClauses.length > 0 ? { AND: searchClauses } : {}),
    };

    const productWhere: Prisma.UserWhereInput =
      input.product === 'membership_card'
        ? input.action === 'grant'
          ? {
              NOT: {
                membership_card: {
                  is: { status: MembershipCardStatus.active },
                },
              },
            }
          : {
              membership_card: {
                is: { status: MembershipCardStatus.active },
              },
            }
        : input.product === 'gym_membership'
          ? input.action === 'grant'
            ? {
                subscriptions: {
                  none: {
                    OR: [
                      currentSubscriptionWhere,
                      { status: SubscriptionStatus.pending_payment },
                    ],
                  },
                },
                commerce_checkout_holds: {
                  none: {
                    kind: CommerceCheckoutHoldKind.subscription,
                    status: CommerceCheckoutHoldStatus.held,
                    expires_at: { gt: now },
                  },
                },
              }
            : {
                subscriptions: { some: currentSubscriptionWhere },
              }
          : input.action === 'grant'
            ? {
                NOT: {
                  AND: [
                    { free_day_pass_granted_at: { not: null } },
                    { free_day_pass_expires_at: { gt: now } },
                    { free_day_pass_redeemed_at: null },
                    { free_day_pass_revoked_at: null },
                  ],
                },
                subscriptions: {
                  none: {
                    OR: [
                      currentSubscriptionWhere,
                      { status: SubscriptionStatus.pending_payment },
                    ],
                  },
                },
                commerce_checkout_holds: {
                  none: {
                    kind: CommerceCheckoutHoldKind.subscription,
                    status: CommerceCheckoutHoldStatus.held,
                    expires_at: { gt: now },
                  },
                },
              }
            : {
                free_day_pass_granted_at: { not: null },
                free_day_pass_expires_at: { gt: now },
                free_day_pass_redeemed_at: null,
                free_day_pass_revoked_at: null,
              };

    const members = await this.prisma.user.findMany({
      where: { ...baseWhere, ...productWhere },
      select: {
        id: true,
        auth_identities: {
          where: { provider: AuthProvider.email },
          orderBy: [{ is_primary: 'desc' }, { created_at: 'asc' }],
          select: { identifier: true },
          take: 1,
        },
        membership_card: { select: { status: true } },
        free_day_pass_expires_at: true,
        profile: { select: { first_name: true, last_name: true } },
        subscriptions: {
          where: currentSubscriptionWhere,
          orderBy: [{ created_at: 'desc' }],
          take: 1,
          select: {
            id: true,
            status: true,
            starts_at: true,
            expires_at: true,
            plan: { select: { name: true } },
          },
        },
      },
      orderBy: [{ profile: { last_name: 'asc' } }, { created_at: 'desc' }],
      take: 50,
    });

    return members.map((member) => {
      const subscription = member.subscriptions[0] ?? null;
      const displayName = [
        member.profile?.first_name,
        member.profile?.last_name,
      ]
        .filter((value): value is string => Boolean(value?.trim()))
        .join(' ')
        .trim();

      return {
        memberId: member.id,
        email: member.auth_identities[0]?.identifier ?? null,
        displayName: displayName || member.auth_identities[0]?.identifier || 'FitTrack member',
        membershipCardStatus: member.membership_card?.status ?? null,
        subscription: subscription
          ? {
              id: subscription.id,
              status: subscription.status,
              planName: subscription.plan.name,
              startsAt: subscription.starts_at,
              expiresAt: subscription.expires_at,
            }
          : null,
        freePassExpiresAt: member.free_day_pass_expires_at,
      };
    });
  }

  async listOnsiteSaleCandidates(input: {
    action: 'grant' | 'revoke';
    purchaseType: 'membership_card' | 'gym_membership';
    search?: string;
  }): Promise<OnsiteMembershipCandidateRecord[]> {
    const candidates = await this.listMembershipAccessCandidates({
      action: input.action,
      product: input.purchaseType,
      search: input.search,
    });
    return candidates.map((candidate) => ({
      id: candidate.memberId,
      email: candidate.email,
      displayName: candidate.displayName,
      membershipCardStatus: candidate.membershipCardStatus,
      subscription: candidate.subscription,
    }));
  }

  async grantFreeDayPass(
    memberId: string,
    grantedBy: string,
    grantedAt = new Date(),
  ): Promise<FreeDayPassLifecycleRecord> {
    return this.transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${memberId}, 100))`;

      const member = await tx.user.findUnique({
        where: { id: memberId },
        select: FREE_DAY_PASS_LIFECYCLE_SELECT,
      });
      if (
        !member ||
        member.deletedAt ||
        member.role !== UserRole.member ||
        member.status !== UserStatus.active ||
        (!member.email_verified_at && !member.phone_verified_at)
      ) {
        throw new NotFoundException({
          type: 'NOT_FOUND',
          title: 'Invalid member',
          status: 404,
          detail: 'Only active, verified, non-archived members can receive a free pass.',
        });
      }

      const pendingTermination = await tx.accountDeletionRequest.findFirst({
        where: {
          userId: memberId,
          status: AccountDeletionRequestStatus.pending,
        },
        select: { id: true },
      });
      if (pendingTermination) {
        throw new ConflictException({
          type: 'CONFLICT',
          title: 'Member Pending Termination',
          status: 409,
          detail: 'Members pending termination cannot receive a free pass.',
        });
      }

      const currentGymAccess = await tx.subscription.findFirst({
        where: {
          user_id: memberId,
          OR: [
            {
              status: { in: [...CURRENT_SUBSCRIPTION_STATUSES] },
              starts_at: { lte: grantedAt },
              expires_at: { gt: grantedAt },
            },
            { status: SubscriptionStatus.pending_payment },
          ],
        },
        select: { id: true },
      });
      if (currentGymAccess) {
        throw new ConflictException({
          type: 'CONFLICT',
          title: 'Gym Access Already Exists',
          status: 409,
          detail: 'Resolve the member\'s current or pending Gym Membership before granting a free pass.',
        });
      }

      const heldCheckout = await tx.commerceCheckoutHold.findFirst({
        where: {
          user_id: memberId,
          kind: CommerceCheckoutHoldKind.subscription,
          status: CommerceCheckoutHoldStatus.held,
          expires_at: { gt: grantedAt },
        },
        select: { id: true },
      });
      if (heldCheckout) {
        throw new ConflictException({
          type: 'CONFLICT',
          title: 'Gym Checkout In Progress',
          status: 409,
          detail: 'Resolve the member\'s pending Gym Membership checkout before granting a free pass.',
        });
      }

      const freePassIsCurrent = Boolean(
        member.free_day_pass_granted_at &&
          member.free_day_pass_expires_at &&
          member.free_day_pass_expires_at > grantedAt &&
          !member.free_day_pass_redeemed_at &&
          !member.free_day_pass_revoked_at,
      );
      if (freePassIsCurrent) {
        throw new ConflictException({
          type: 'CONFLICT',
          title: 'Free Day Pass Already Active',
          status: 409,
          detail: 'This member already has an active free one-day pass.',
        });
      }

      const expiresAt = new Date(grantedAt.getTime() + 24 * 60 * 60 * 1000);
      const user = await tx.user.update({
        where: { id: memberId },
        data: {
          free_day_pass_granted_at: grantedAt,
          free_day_pass_expires_at: expiresAt,
          free_day_pass_granted_by: grantedBy,
          free_day_pass_redeemed_at: null,
          free_day_pass_revoked_at: null,
          free_day_pass_revoke_reason: null,
        },
        select: FREE_DAY_PASS_LIFECYCLE_SELECT,
      });

      return { before: member, user };
    });
  }

  async revokeFreeDayPass(
    memberId: string,
    reason: string,
    revokedAt = new Date(),
  ): Promise<FreeDayPassLifecycleRecord> {
    return this.transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${memberId}, 100))`;

      const member = await tx.user.findUnique({
        where: { id: memberId },
        select: FREE_DAY_PASS_LIFECYCLE_SELECT,
      });
      const freePassIsCurrent = Boolean(
        member?.free_day_pass_granted_at &&
          member.free_day_pass_expires_at &&
          member.free_day_pass_expires_at > revokedAt &&
          !member.free_day_pass_redeemed_at &&
          !member.free_day_pass_revoked_at,
      );
      if (!member || !freePassIsCurrent) {
        throw new ConflictException({
          type: 'CONFLICT',
          title: 'Free Day Pass Not Revocable',
          status: 409,
          detail: 'Only a current, unused free one-day pass can be revoked.',
        });
      }

      const user = await tx.user.update({
        where: { id: memberId },
        data: {
          free_day_pass_revoked_at: revokedAt,
          free_day_pass_revoke_reason: reason,
        },
        select: FREE_DAY_PASS_LIFECYCLE_SELECT,
      });

      return { before: member, user };
    });
  }

  async countPlanHistory(planId: string): Promise<number> {
    const [subscriptions, holds] = await Promise.all([
      this.prisma.subscription.count({ where: { plan_id: planId } }),
      this.prisma.commerceCheckoutHold.count({
        where: { membership_plan_id: planId },
      }),
    ]);
    return subscriptions + holds;
  }

  /**
   * Records an onsite cash sale and its entitlement atomically. The member
   * lock serializes card/plan sales and the partial subscription index remains
   * the final concurrency backstop for membership plans.
   */
  async recordCashMembership(input: {
    actorId: string;
    memberId: string;
    purchaseType: 'membership_card' | 'gym_membership';
    planId?: string;
    idempotencyKey: string;
  }): Promise<CashMembershipSaleRecord> {
    const now = new Date();

    try {
      return await this.transaction(async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${input.memberId}, 4))`;

        const existingPayment = await tx.payment.findUnique({
          where: { idempotency_key: input.idempotencyKey },
        });
        if (existingPayment) {
          const existingPurchaseType =
            existingPayment.payable_type === PayableType.membership_card
              ? 'membership_card'
              : existingPayment.payable_type === PayableType.subscription
                ? 'gym_membership'
                : null;
          if (
            existingPayment.user_id !== input.memberId ||
            existingPayment.provider !== PaymentProvider.cash ||
            existingPayment.status !== PaymentStatus.completed ||
            existingPurchaseType !== input.purchaseType
          ) {
            throw new ConflictException({
              type: 'CONFLICT',
              title: 'Idempotency Key Already Used',
              status: 409,
              detail:
                'This idempotency key is already associated with another payment request.',
            });
          }
          const existingSale = await this.loadCashSaleByPayment(
            tx,
            existingPayment,
          );
          const existingPlanId = existingSale.subscription?.plan_id ?? null;
          if (
            (input.purchaseType === 'gym_membership' &&
              existingPlanId !== (input.planId ?? null)) ||
            (input.purchaseType === 'membership_card' && input.planId)
          ) {
            throw new ConflictException({
              type: 'CONFLICT',
              title: 'Idempotency Payload Mismatch',
              status: 409,
              detail:
                'This idempotency key was already used for a different member, purchase type, or Gym Membership plan.',
            });
          }
          return existingSale;
        }

        const member = await tx.user.findUnique({
          where: { id: input.memberId },
          select: {
            id: true,
            role: true,
            status: true,
            deletedAt: true,
            email_verified_at: true,
            phone_verified_at: true,
          },
        });
        if (
          !member ||
          member.deletedAt ||
          member.role !== UserRole.member ||
          member.status !== UserStatus.active ||
          (!member.email_verified_at && !member.phone_verified_at)
        ) {
          throw new ConflictException({
            type: 'CONFLICT',
            title: 'Member Not Eligible',
            status: 409,
            detail:
              'Only active, verified MEMBER accounts can receive onsite membership sales.',
          });
        }

        const pendingTermination = await tx.accountDeletionRequest.findFirst({
          where: {
            userId: input.memberId,
            status: AccountDeletionRequestStatus.pending,
          },
          select: { id: true },
        });
        if (pendingTermination) {
          throw new ConflictException({
            type: 'CONFLICT',
            title: 'Member Not Eligible',
            status: 409,
            detail: 'Members pending termination cannot receive memberships.',
          });
        }

        if (input.purchaseType === 'membership_card') {
          if (input.planId) {
            throw new ConflictException({
              type: 'CONFLICT',
              title: 'Invalid Membership Sale',
              status: 409,
              detail: 'A membership-card sale cannot include a gym plan.',
            });
          }
          const settings = await tx.membershipCatalogSettings.findFirst({
            select: { membership_card_price: true },
          });
          const price = settings?.membership_card_price ?? DEFAULT_MEMBERSHIP_CARD_PRICE;
          const existingCard = await tx.membershipCard.findUnique({
            where: { user_id: input.memberId },
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
                  activated_at: now,
                  price,
                  purchased_at: now,
                  revoke_reason: null,
                  revoked_at: null,
                  revoked_by: null,
                  source: MembershipCardSource.cash,
                  status: MembershipCardStatus.active,
                  verified_at: now,
                  verified_by: input.actorId,
                },
              })
            : await tx.membershipCard.create({
                data: {
                  activated_at: now,
                  price,
                  purchased_at: now,
                  source: MembershipCardSource.cash,
                  status: MembershipCardStatus.active,
                  verified_at: now,
                  verified_by: input.actorId,
                  user: { connect: { id: input.memberId } },
                },
              });
          const payment = await tx.payment.create({
            data: {
              amount: price,
              currency: 'PHP',
              idempotency_key: input.idempotencyKey,
              payable_id: card.id,
              payable_type: PayableType.membership_card,
              payment_stage: PaymentStage.full,
              provider: PaymentProvider.cash,
              status: PaymentStatus.completed,
              verified_at: now,
              verifier: { connect: { id: input.actorId } },
              user: { connect: { id: input.memberId } },
            },
          });
          return { membershipCard: card, payment, subscription: null, replayed: false };
        }

        if (!input.planId) {
          throw new ConflictException({
            type: 'CONFLICT',
            title: 'Gym Membership Plan Required',
            status: 409,
            detail: 'Select an active Gym Membership plan for this sale.',
          });
        }

        await tx.subscription.updateMany({
          where: {
            user_id: input.memberId,
            status: { in: [SubscriptionStatus.active, SubscriptionStatus.past_due] },
            expires_at: { lte: now },
          },
          data: { status: SubscriptionStatus.expired },
        });
        const plan = await tx.membershipPlan.findFirst({
          where: { id: input.planId, is_active: true },
        });
        if (!plan) {
          throw new ConflictException({
            type: 'CONFLICT',
            title: 'Gym Membership Plan Unavailable',
            status: 409,
            detail: 'The selected Gym Membership plan is no longer available.',
          });
        }

        const activeMembership = await tx.subscription.findFirst({
          where: {
            user_id: input.memberId,
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
        });
        const pendingSubscription = await tx.subscription.findFirst({
          where: { user_id: input.memberId, status: SubscriptionStatus.pending_payment },
          select: { id: true },
        });
        const pendingHold = await tx.commerceCheckoutHold.findFirst({
          where: {
            user_id: input.memberId,
            kind: CommerceCheckoutHoldKind.subscription,
            status: CommerceCheckoutHoldStatus.held,
            expires_at: { gt: now },
          },
          select: { id: true },
        });
        if (activeMembership || pendingSubscription || pendingHold) {
          throw this.buildDuplicateSubscriptionConflict();
        }

        const expiresAt = new Date(now);
        expiresAt.setDate(expiresAt.getDate() + plan.duration_days);
        const subscription = await tx.subscription.create({
          data: {
            duration_days_snapshot: plan.duration_days,
            expires_at: expiresAt,
            plan: { connect: { id: plan.id } },
            plan_currency_snapshot: plan.currency,
            plan_description_snapshot: plan.description,
            plan_name_snapshot: plan.name,
            plan_price_snapshot: plan.price,
            starts_at: now,
            status: SubscriptionStatus.active,
            user: { connect: { id: input.memberId } },
          },
          include: { plan: true },
        });
        const payment = await tx.payment.create({
          data: {
            amount: plan.price,
            currency: plan.currency,
            idempotency_key: input.idempotencyKey,
            payable_id: subscription.id,
            payable_type: PayableType.subscription,
            payment_stage: PaymentStage.full,
            provider: PaymentProvider.cash,
            status: PaymentStatus.completed,
            verified_at: now,
            verifier: { connect: { id: input.actorId } },
            user: { connect: { id: input.memberId } },
          },
        });
        const linkedSubscription = await tx.subscription.update({
          where: { id: subscription.id },
          data: { payment_id: payment.id },
          include: { plan: true },
        });
        return {
          membershipCard: null,
          payment,
          subscription: linkedSubscription,
          replayed: false,
        };
      });
    } catch (error) {
      if (this.isDuplicateSubscriptionIndexError(error)) {
        throw this.buildDuplicateSubscriptionConflict();
      }
      if (this.isDuplicatePaymentIdempotencyError(error)) {
        throw new ConflictException({
          type: 'CONFLICT',
          title: 'Cash Sale Already Recorded',
          status: 409,
          detail: 'This idempotency key already completed another cash sale.',
        });
      }
      throw error;
    }
  }

  async revokeMembershipSubscription(
    subscriptionId: string,
    reason: string | null,
    revokedAt = new Date(),
  ): Promise<RevokedMembershipSubscriptionRecord> {
    return this.transaction(async (tx) => {
      const initial = await tx.subscription.findUnique({
        where: { id: subscriptionId },
        include: { plan: true },
      });
      if (!initial || !this.isCurrentAccessibleSubscription(initial, revokedAt)) {
        throw this.buildMembershipSubscriptionRevokeConflict();
      }

      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${initial.user_id}, 4))`;

      const current = await tx.subscription.findUnique({
        where: { id: subscriptionId },
        include: { plan: true },
      });
      if (!current || !this.isCurrentAccessibleSubscription(current, revokedAt)) {
        throw this.buildMembershipSubscriptionRevokeConflict();
      }

      const subscription = await tx.subscription.update({
        where: { id: subscriptionId },
        data: {
          status: SubscriptionStatus.suspended,
          cancelled_at: revokedAt,
          cancellation_reason: reason,
        },
        include: { plan: true },
      });

      return { before: current, subscription };
    });
  }

  private async loadCashSaleByPayment(
    tx: Prisma.TransactionClient,
    payment: Payment,
  ): Promise<CashMembershipSaleRecord> {
    if (payment.payable_type === PayableType.membership_card) {
      const membershipCard = await tx.membershipCard.findUnique({
        where: { id: payment.payable_id },
      });
      return { membershipCard, payment, subscription: null, replayed: true };
    }
    const subscription = await tx.subscription.findUnique({
      where: { id: payment.payable_id },
      include: { plan: true },
    });
    return { membershipCard: null, payment, subscription, replayed: true };
  }

  private isDuplicatePaymentIdempotencyError(error: unknown): boolean {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002' &&
      String(error.message).includes('payments_idempotency_key_key')
    );
  }

  private isCurrentAccessibleSubscription(
    subscription: Pick<Subscription, 'status' | 'starts_at' | 'expires_at'>,
    now: Date,
  ): boolean {
    return (
      (CURRENT_SUBSCRIPTION_STATUSES as readonly string[]).includes(
        subscription.status,
      ) &&
      Boolean(subscription.starts_at && subscription.starts_at <= now) &&
      Boolean(subscription.expires_at && subscription.expires_at > now)
    );
  }

  private buildMembershipSubscriptionRevokeConflict(): ConflictException {
    return new ConflictException({
      type: 'CONFLICT',
      title: 'Subscription Not Revocable',
      status: 409,
      detail:
        'Only a current Gym Membership subscription can have its access revoked.',
    });
  }

  deletePlan(id: string): Promise<void> {
    return this.deleteById(this.prisma.membershipPlan, id);
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

  findCurrentSubscriptionByUserId(
    userId: string,
  ): Promise<SubscriptionWithPlan | null> {
    return this.prisma.subscription.findFirst({
      where: this.buildCurrentSubscriptionWhere(userId),
      include: { plan: true },
      orderBy: [{ created_at: 'desc' }],
    });
  }

  findCancellableSubscriptionByUserIdOrThrow(
    userId: string,
  ): Promise<SubscriptionWithPlan> {
    return this.findOneOrThrow<SubscriptionWithPlan>(
      this.prisma.subscription,
      {
        user_id: userId,
        status: { in: ['active', 'past_due'] },
        starts_at: { lte: new Date() },
        expires_at: { gt: new Date() },
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
        const now = new Date();
        await tx.subscription.updateMany({
          where: {
            user_id: input.userId,
            status: { in: [SubscriptionStatus.active, SubscriptionStatus.past_due] },
            expires_at: { lte: now },
          },
          data: { status: SubscriptionStatus.expired },
        });
        const existing = await tx.subscription.findFirst({
          where: this.buildDuplicateSubscriptionWhere(input.userId, now),
          select: { id: true },
        });

        if (existing) {
          throw this.buildDuplicateSubscriptionConflict();
        }

        const plan = await tx.membershipPlan.findUniqueOrThrow({
          where: { id: input.planId },
        });
        const subscription = await tx.subscription.create({
          data: {
            user: { connect: { id: input.userId } },
            plan: { connect: { id: input.planId } },
            plan_name_snapshot: plan.name,
            plan_description_snapshot: plan.description,
            plan_price_snapshot: plan.price,
            plan_currency_snapshot: plan.currency,
            duration_days_snapshot: plan.duration_days,
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

  hasActivePlanAccess(userId: string): Promise<boolean> {
    return this.exists(this.prisma.subscription, {
      user_id: userId,
      status: { in: [...ACCESSIBLE_SUBSCRIPTION_STATUSES] },
      starts_at: { lte: new Date() },
      expires_at: { gt: new Date() },
    });
  }

  hasCoachingAccess(userId: string): Promise<boolean> {
    return this.hasSubscriptionAccess(userId);
  }

  private buildCurrentSubscriptionWhere(
    userId: string,
  ): Prisma.SubscriptionWhereInput {
    return {
      user_id: userId,
      status: { in: [...CURRENT_SUBSCRIPTION_STATUSES] },
      starts_at: { lte: new Date() },
      expires_at: { gt: new Date() },
    };
  }

  private buildAccessibleSubscriptionWhere(
    userId: string,
  ): Prisma.SubscriptionWhereInput {
    return {
      user_id: userId,
      status: { in: [...ACCESSIBLE_SUBSCRIPTION_STATUSES] },
      starts_at: { lte: new Date() },
      expires_at: { gt: new Date() },
      user: {
        is: {
          role: UserRole.member,
          status: UserStatus.active,
          deletedAt: null,
          OR: [
            { email_verified_at: { not: null } },
            { phone_verified_at: { not: null } },
          ],
          deletion_requests: {
            none: { status: AccountDeletionRequestStatus.pending },
          },
        },
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
    now = new Date(),
  ): Prisma.SubscriptionWhereInput {
    return {
      user_id: userId,
      OR: [
        { status: SubscriptionStatus.pending_payment },
        {
          status: {
            in: [...DUPLICATE_SUBSCRIPTION_STATUSES],
          },
          starts_at: { lte: now },
          expires_at: { gt: now },
        },
      ],
    };
  }

  async getFreeDayPassEligibility(
    userId: string,
  ): Promise<FreeDayPassEligibilityRecord> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        role: true,
        status: true,
        deletedAt: true,
        email_verified_at: true,
        phone_verified_at: true,
        free_day_pass_granted_at: true,
        free_day_pass_expires_at: true,
        free_day_pass_redeemed_at: true,
        free_day_pass_revoked_at: true,
      },
    });
    const grantedAt = user?.free_day_pass_granted_at ?? null;
    const expiresAt = user?.free_day_pass_expires_at ?? null;
    const redeemedAt = user?.free_day_pass_redeemed_at ?? null;
    const revokedAt = user?.free_day_pass_revoked_at ?? null;
    const notEligible = (reason: string): FreeDayPassEligibilityRecord => ({
      eligible: false,
      expiresAt,
      grantedAt,
      revokedAt,
      redeemedAt,
      reason,
    });

    if (
      !user ||
      user.deletedAt ||
      user.role !== UserRole.member ||
      user.status !== UserStatus.active ||
      (!user.email_verified_at && !user.phone_verified_at)
    ) {
      return notEligible('This account is not eligible for membership access.');
    }
    if (redeemedAt) {
      return notEligible('This free one-day pass has already been redeemed.');
    }

    if (revokedAt) {
      return notEligible('This free one-day pass has been revoked.');
    }

    if (!grantedAt || !expiresAt) {
      return notEligible('This member does not have an explicitly granted free pass.');
    }

    if (expiresAt <= new Date()) {
      return notEligible('This free one-day pass has expired.');
    }

    const pendingTermination = await this.prisma.accountDeletionRequest.findFirst({
      where: {
        userId,
        status: AccountDeletionRequestStatus.pending,
      },
      select: { id: true },
    });
    if (pendingTermination) {
      return notEligible('Members pending termination cannot redeem a free pass.');
    }

    const currentGymAccess = await this.prisma.subscription.findFirst({
      where: {
        user_id: userId,
        OR: [
          {
            status: { in: [...CURRENT_SUBSCRIPTION_STATUSES] },
            starts_at: { lte: new Date() },
            expires_at: { gt: new Date() },
          },
          { status: SubscriptionStatus.pending_payment },
        ],
      },
      select: { id: true },
    });
    if (currentGymAccess) {
      return notEligible('Paid Gym Membership access takes precedence over the free pass.');
    }

    const heldCheckout = await this.prisma.commerceCheckoutHold.findFirst({
      where: {
        user_id: userId,
        kind: CommerceCheckoutHoldKind.subscription,
        status: CommerceCheckoutHoldStatus.held,
        expires_at: { gt: new Date() },
      },
      select: { id: true },
    });
    if (heldCheckout) {
      return notEligible('Resolve the pending Gym Membership checkout before using the free pass.');
    }

    return {
      eligible: true,
      expiresAt,
      grantedAt,
      revokedAt: null,
      redeemedAt: null,
      reason: null,
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
