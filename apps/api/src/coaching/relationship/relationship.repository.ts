import { Injectable } from '@nestjs/common';
import {
  CoachClientRelationship,
  CoachReview,
  Prisma,
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
      profile: true,
    },
  },
} satisfies Prisma.CoachClientRelationshipInclude;

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

  getCoachClients(
    coachId: string,
    dto: CoachClientFilterDTO,
  ): Promise<PaginatedResult<RelationshipRecord>> {
    return this.paginate<RelationshipRecord>(
      this.prisma.coachClientRelationship,
      {
        where: { coach_id: coachId },
        include: relationshipInclude,
        orderBy: [{ updated_at: 'desc' }, { created_at: 'desc' }],
      },
      { page: dto.page, limit: dto.limit },
    );
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
