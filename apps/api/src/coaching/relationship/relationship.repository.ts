import { Injectable } from '@nestjs/common';
import {
  AuthProvider,
  CoachClientRelationship,
  CoachReview,
  AppointmentStatus,
  CommerceCheckoutHoldKind,
  CommerceCheckoutHoldStatus,
  PayableType,
  PaymentStage,
  PaymentStatus,
  Prisma,
  RecurringCoachingBillingCycleStatus,
  RecurringCoachingFrequency,
  RecurringCoachingPlanStatus,
  RelationshipStatus,
  UserStatus,
} from '@prisma/client';

import {
  BaseRepository,
  PaginatedResult,
} from '../../common/base-repository/base-repository';
import { PrismaService } from '../../prisma/prisma.service';
import { CoachClientFilterDTO } from './dto/relationship.dto';

const relationshipInclude = {
  coach: {
    include: {
      user: {
        include: {
          profile: true,
        },
      },
    },
  },
  member: {
    include: {
      auth_identities: {
        where: { provider: { in: [AuthProvider.email, AuthProvider.google] } },
        orderBy: [{ is_primary: 'desc' }, { created_at: 'asc' }],
        select: {
          identifier: true,
          is_primary: true,
          provider: true,
          verified_at: true,
        },
      },
      attendance_logs: {
        orderBy: { check_in_at: 'desc' },
        select: { check_in_at: true },
        take: 1,
      },
      membership_card: true,
      member_appointments: {
        where: {
          scheduled_at: { gte: new Date() },
          status: AppointmentStatus.confirmed,
        },
        orderBy: { scheduled_at: 'asc' },
        select: {
          coach_id: true,
          duration_minutes: true,
          id: true,
          scheduled_at: true,
          status: true,
        },
        take: 10,
      },
      profile: true,
    },
  },
} satisfies Prisma.CoachClientRelationshipInclude;

const oneTimeProfileSelect = {
  activity_level: true,
  avatar_url: true,
  date_of_birth: true,
  first_name: true,
  fitness_goal: true,
  gender: true,
  height_cm: true,
  last_name: true,
  phone: true,
  weight_kg: true,
} satisfies Prisma.UserProfileSelect;

const oneTimeMemberSelect = {
  id: true,
  status: true,
  email_verified_at: true,
  phone_verified_at: true,
  auth_identities: {
    where: { provider: { in: [AuthProvider.email, AuthProvider.google] } },
    orderBy: [{ is_primary: 'desc' }, { created_at: 'asc' }],
    select: {
      identifier: true,
      is_primary: true,
      provider: true,
      verified_at: true,
    },
  },
  attendance_logs: {
    orderBy: { check_in_at: 'desc' },
    select: { check_in_at: true },
    take: 1,
  },
  membership_card: { select: { status: true } },
  member_appointments: {
    where: {
      scheduled_at: { gte: new Date() },
      status: AppointmentStatus.confirmed,
    },
    orderBy: { scheduled_at: 'asc' },
    select: {
      coach_id: true,
      duration_minutes: true,
      id: true,
      scheduled_at: true,
      status: true,
    },
    take: 10,
  },
  profile: { select: oneTimeProfileSelect },
} satisfies Prisma.UserSelect;

const oneTimeAppointmentSelect = {
  id: true,
  user_id: true,
  coach_id: true,
  scheduled_at: true,
  duration_minutes: true,
  created_at: true,
  updated_at: true,
  coach: {
    select: {
      id: true,
      specialization: true,
      is_available_for_booking: true,
    },
  },
  user: { select: oneTimeMemberSelect },
} satisfies Prisma.CoachAppointmentSelect;

const paidOneTimeAppointmentWhere = (
  coachId: string,
  memberId?: string,
): Prisma.CoachAppointmentWhereInput => ({
  coach_id: coachId,
  ...(memberId === undefined ? {} : { user_id: memberId }),
  status: {
    in: [AppointmentStatus.confirmed, AppointmentStatus.completed],
  },
  cancelled_at: null,
  no_show_at: null,
  recurring_plan_id: null,
  recurring_schedule_item_id: null,
  is_free_session: false,
  total_amount: { gt: 0 },
});

const paidOneTimeAppointmentSelect = {
  id: true,
  scheduled_at: true,
  duration_minutes: true,
} satisfies Prisma.CoachAppointmentSelect;

const reviewAppointmentSelect = {
  id: true,
  user_id: true,
  coach_id: true,
  status: true,
  completed_at: true,
  review: {
    select: {
      id: true,
    },
  },
} satisfies Prisma.CoachAppointmentSelect;

export type RelationshipRecord = Prisma.CoachClientRelationshipGetPayload<{
  include: typeof relationshipInclude;
}>;

type OneTimeAppointmentClientRecord =
  Prisma.CoachAppointmentGetPayload<{
    select: typeof oneTimeAppointmentSelect;
  }>;

export type OneTimeCoachClientRecord = {
  id: string;
  coach_id: string;
  member_id: string;
  status: RelationshipStatus;
  notes: string | null;
  started_at: Date;
  ended_at: Date;
  created_at: Date;
  updated_at: Date;
  coach: OneTimeAppointmentClientRecord['coach'];
  member: OneTimeAppointmentClientRecord['user'];
};

export type CoachClientRecord = RelationshipRecord | OneTimeCoachClientRecord;

type OneTimeAppointmentAccessRecord = Prisma.CoachAppointmentGetPayload<{
  select: typeof paidOneTimeAppointmentSelect;
}>;

export type ReviewAppointmentContext = Prisma.CoachAppointmentGetPayload<{
  select: typeof reviewAppointmentSelect;
}>;

type CoachOwnershipRecord = {
  id: string;
  user_id: string;
};
type OpenRelationshipRecord = Pick<CoachClientRelationship, 'id' | 'status'>;
type ActiveRelationshipRecord = Pick<
  CoachClientRelationship,
  'id' | 'coach_id' | 'member_id' | 'status'
>;

type ReviewWriteResult = {
  review: CoachReview;
  averageRating: Prisma.Decimal;
  ratingCount: number;
};

type CoachReviewListRecord = Prisma.CoachReviewGetPayload<{
  include: {
    appointment: {
      select: {
        id: true;
        scheduled_at: true;
      };
    };
    reviewer: {
      select: {
        id: true;
        profile: {
          select: {
            first_name: true;
            last_name: true;
          };
        };
      };
    };
  };
}>;

type RelationshipNotificationContext =
  Prisma.CoachClientRelationshipGetPayload<{
    include: {
      coach: {
        include: {
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
              profile: true;
            };
          };
        };
      };
      member: {
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
          profile: true;
        };
      };
    };
  }>;

@Injectable()
export class RelationshipRepository extends BaseRepository {
  constructor(prisma: PrismaService) {
    super(prisma);
  }

  private readonly relationshipNotificationInclude = {
    coach: {
      include: {
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
            profile: true,
          },
        },
      },
    },
    member: {
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
        profile: true,
      },
    },
  } as const;

  findCoachByIdOrThrow(coachId: string): Promise<CoachOwnershipRecord> {
    return this.findOneOrThrow<CoachOwnershipRecord>(
      this.prisma.coachProfile,
      {
        id: coachId,
        user: { status: UserStatus.active },
      },
      'CoachProfile',
    );
  }

  findCoachByUserIdOrThrow(userId: string): Promise<CoachOwnershipRecord> {
    return this.findUniqueWhereOrThrow<CoachOwnershipRecord>(
      this.prisma.coachProfile,
      { user_id: userId },
      'CoachProfile',
      undefined,
      { id: true, user_id: true },
    );
  }

  findOpenRelationshipPair(
    coachId: string,
    memberId: string,
  ): Promise<OpenRelationshipRecord | null> {
    return this.findOne<OpenRelationshipRecord>(
      this.prisma.coachClientRelationship,
      {
        coach_id: coachId,
        member_id: memberId,
        status: {
          in: [RelationshipStatus.pending, RelationshipStatus.active],
        },
      },
    );
  }

  findActiveRelationshipPair(
    coachId: string,
    memberId: string,
  ): Promise<ActiveRelationshipRecord | null> {
    return this.findOne<ActiveRelationshipRecord>(
      this.prisma.coachClientRelationship,
      {
        coach_id: coachId,
        member_id: memberId,
        status: RelationshipStatus.active,
      },
    );
  }

  async findValidPaidOneTimeAppointment(
    coachId: string,
    memberId: string,
    now = new Date(),
  ): Promise<OneTimeAppointmentAccessRecord | null> {
    void now;
    const appointments = await this.prisma.coachAppointment.findMany({
      where: paidOneTimeAppointmentWhere(coachId, memberId),
      orderBy: [{ scheduled_at: 'asc' }, { created_at: 'desc' }],
      select: paidOneTimeAppointmentSelect,
    });
    const paidIds = await this.getFullyPaidOneTimeAppointmentIds(
      appointments.map((appointment) => appointment.id),
    );

    return appointments.find((appointment) => paidIds.has(appointment.id)) ?? null;
  }

  findActivePaidMonthlyPlan(
    coachId: string,
    memberId: string,
    now = new Date(),
  ): Promise<{ id: string } | null> {
    const today = new Date(now);
    today.setUTCHours(0, 0, 0, 0);

    return this.prisma.recurringCoachingPlan.findFirst({
      where: {
        coach_id: coachId,
        member_id: memberId,
        frequency: RecurringCoachingFrequency.monthly,
        status: RecurringCoachingPlanStatus.active,
        end_date: { gte: today },
        billing_cycles: {
          some: {
            status: RecurringCoachingBillingCycleStatus.paid,
            cycle_end_date: { gte: today },
          },
        },
      },
      select: { id: true },
    });
  }

  private async getValidPaidOneTimeAppointments(
    coachId: string,
    now = new Date(),
  ): Promise<OneTimeAppointmentClientRecord[]> {
    void now;
    const appointments = await this.prisma.coachAppointment.findMany({
      where: paidOneTimeAppointmentWhere(coachId),
      orderBy: [{ scheduled_at: 'asc' }, { created_at: 'desc' }],
      select: oneTimeAppointmentSelect,
    });
    const paidIds = await this.getFullyPaidOneTimeAppointmentIds(
      appointments.map((appointment) => appointment.id),
    );

    return appointments.filter((appointment) => paidIds.has(appointment.id));
  }

  private async getFullyPaidOneTimeAppointmentIds(
    appointmentIds: string[],
  ): Promise<Set<string>> {
    if (appointmentIds.length === 0) {
      return new Set();
    }

    const [directPayments, checkoutHolds] = await Promise.all([
      this.prisma.payment.findMany({
        where: {
          payable_id: { in: appointmentIds },
          payable_type: PayableType.coaching,
          payment_stage: PaymentStage.full,
          status: PaymentStatus.completed,
        },
        select: { payable_id: true },
      }),
      this.prisma.commerceCheckoutHold.findMany({
        where: {
          appointment_id: { in: appointmentIds },
          kind: CommerceCheckoutHoldKind.one_time,
          status: CommerceCheckoutHoldStatus.consumed,
          payment: {
            is: {
              payable_type: PayableType.commerce_checkout_hold,
              payment_stage: PaymentStage.full,
              status: PaymentStatus.completed,
            },
          },
        },
        select: { appointment_id: true },
      }),
    ]);

    return new Set([
      ...directPayments.map((payment) => payment.payable_id),
      ...checkoutHolds.flatMap((hold) =>
        hold.appointment_id ? [hold.appointment_id] : [],
      ),
    ]);
  }

  async hasActiveRelationshipForMember(memberId: string): Promise<boolean> {
    const count = await this.prisma.coachClientRelationship.count({
      where: {
        member_id: memberId,
        status: RelationshipStatus.active,
      },
    });
    return count > 0;
  }

  async findActiveCoachUserIdForMember(
    memberId: string,
  ): Promise<string | null> {
    const relationship = await this.prisma.coachClientRelationship.findFirst({
      where: {
        member_id: memberId,
        status: RelationshipStatus.active,
      },
      orderBy: { started_at: 'desc' },
      select: {
        coach: { select: { user_id: true } },
      },
    });
    return relationship?.coach.user_id ?? null;
  }

  createRelationship(input: {
    coachId: string;
    memberId: string;
    notes?: string;
  }): Promise<RelationshipRecord> {
    return this.create<RelationshipRecord>(
      this.prisma.coachClientRelationship,
      {
        coach: { connect: { id: input.coachId } },
        member: { connect: { id: input.memberId } },
        status: RelationshipStatus.pending,
        notes: input.notes ?? null,
      },
      relationshipInclude,
    );
  }

  getMyRelationships(memberId: string): Promise<RelationshipRecord[]> {
    return this.findAll<RelationshipRecord>(
      this.prisma.coachClientRelationship,
      { member_id: memberId },
      relationshipInclude,
      [{ updated_at: 'desc' }, { created_at: 'desc' }],
    );
  }

  async getCoachClients(
    coachId: string,
    dto: CoachClientFilterDTO,
  ): Promise<PaginatedResult<CoachClientRecord>> {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const [paidMonthlyPlans, appointments] = await Promise.all([
      this.prisma.recurringCoachingPlan.findMany({
        where: {
          coach_id: coachId,
          frequency: RecurringCoachingFrequency.monthly,
          status: RecurringCoachingPlanStatus.active,
          end_date: { gte: today },
          billing_cycles: {
            some: {
              status: RecurringCoachingBillingCycleStatus.paid,
              cycle_end_date: { gte: today },
            },
          },
        },
        select: { member_id: true },
      }),
      this.getValidPaidOneTimeAppointments(coachId),
    ]);
    const monthlyMemberIds = [
      ...new Set(paidMonthlyPlans.map((plan) => plan.member_id)),
    ];
    const relationships = monthlyMemberIds.length
      ? await this.findAll<RelationshipRecord>(
          this.prisma.coachClientRelationship,
          {
            coach_id: coachId,
            member_id: { in: monthlyMemberIds },
            status: RelationshipStatus.active,
          },
          relationshipInclude,
          [{ updated_at: 'desc' }, { created_at: 'desc' }],
        )
      : [];

    const relationshipMemberIds = new Set(
      relationships.map((relationship) => relationship.member_id),
    );
    const oneTimeMemberIds = new Set<string>();
    const oneTimeClients: OneTimeCoachClientRecord[] = [];

    for (const appointment of appointments) {
      if (
        relationshipMemberIds.has(appointment.user_id) ||
        oneTimeMemberIds.has(appointment.user_id)
      ) {
        continue;
      }

      oneTimeMemberIds.add(appointment.user_id);
      oneTimeClients.push({
        id: appointment.id,
        coach_id: appointment.coach_id,
        member_id: appointment.user_id,
        status: RelationshipStatus.active,
        notes: null,
        started_at: appointment.scheduled_at,
        ended_at: new Date(
          appointment.scheduled_at.getTime() +
            appointment.duration_minutes * 60 * 1000,
        ),
        created_at: appointment.created_at,
        updated_at: appointment.updated_at,
        coach: appointment.coach,
        member: appointment.user,
      });
    }

    const records: CoachClientRecord[] = [
      ...relationships,
      ...oneTimeClients,
    ].sort((left, right) => {
      const updatedDifference =
        right.updated_at.getTime() - left.updated_at.getTime();
      return (
        updatedDifference ||
        right.created_at.getTime() - left.created_at.getTime()
      );
    });

    const page = Math.max(1, dto.page ?? 1);
    const limit = Math.min(100, Math.max(1, dto.limit ?? 20));
    const skip = (page - 1) * limit;
    const total = records.length;

    return {
      data: records.slice(skip, skip + limit),
      meta: {
        page,
        limit,
        total,
        total_pages: Math.ceil(total / limit),
      },
    };
  }

  findRelationshipByIdOrThrow(id: string): Promise<RelationshipRecord> {
    return this.findByIdOrThrow<RelationshipRecord>(
      this.prisma.coachClientRelationship,
      id,
      'CoachClientRelationship',
      relationshipInclude,
    );
  }

  updateRelationship(
    id: string,
    data: Prisma.CoachClientRelationshipUpdateInput,
  ): Promise<RelationshipRecord> {
    return this.updateById<RelationshipRecord>(
      this.prisma.coachClientRelationship,
      id,
      data,
      relationshipInclude,
    );
  }

  findRelationshipNotificationContextByIdOrThrow(
    id: string,
  ): Promise<RelationshipNotificationContext> {
    return this.findByIdOrThrow<RelationshipNotificationContext>(
      this.prisma.coachClientRelationship,
      id,
      'CoachClientRelationship',
      this.relationshipNotificationInclude,
    );
  }

  findReviewAppointmentContextByIdOrThrow(
    appointmentId: string,
  ): Promise<ReviewAppointmentContext> {
    return this.findByIdOrThrow<ReviewAppointmentContext>(
      this.prisma.coachAppointment,
      appointmentId,
      'CoachAppointment',
      undefined,
      reviewAppointmentSelect,
    );
  }

  createReviewAndRefreshCoachRating(input: {
    coachId: string;
    reviewerId: string;
    appointmentId: string;
    rating: number;
    comment?: string;
  }): Promise<ReviewWriteResult> {
    return this.transaction(async (tx) => {
      const review = await tx.coachReview.create({
        data: {
          coach: { connect: { id: input.coachId } },
          reviewer: { connect: { id: input.reviewerId } },
          appointment: { connect: { id: input.appointmentId } },
          rating: input.rating,
          comment: input.comment ?? null,
        },
      });

      const aggregates = await tx.coachReview.aggregate({
        where: { coach_id: input.coachId },
        _avg: { rating: true },
        _count: { rating: true },
      });

      const averageRating = new Prisma.Decimal(
        aggregates._avg.rating?.toFixed(2) ?? '0.00',
      );
      const ratingCount = aggregates._count.rating;

      await tx.coachProfile.update({
        where: { id: input.coachId },
        data: {
          average_rating: averageRating,
          rating_count: ratingCount,
        },
      });

      return {
        review,
        averageRating,
        ratingCount,
      };
    });
  }

  listCoachReviewsForCoach(coachId: string, limit = 20): Promise<CoachReviewListRecord[]> {
    return this.prisma.coachReview.findMany({
      where: { coach_id: coachId },
      take: limit,
      orderBy: [{ created_at: 'desc' }],
      include: {
        appointment: {
          select: {
            id: true,
            scheduled_at: true,
          },
        },
        reviewer: {
          select: {
            id: true,
            profile: {
              select: {
                first_name: true,
                last_name: true,
              },
            },
          },
        },
      },
    });
  }
}
