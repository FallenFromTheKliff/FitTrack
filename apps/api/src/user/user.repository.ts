import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import {
  UserProfile,
  ProgressMetric,
  NotificationPreference,
  AttendanceLog,
  AppFeedback,
  AccountDeletionRequest,
  AccountDeletionRequestStatus,
  User,
  Prisma,
  UserRole,
  UserStatus,
  AttendanceAccessSource,
  AttendanceCheckInMethod,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  BaseRepository,
  PaginatedResult,
} from '../common/base-repository/base-repository';
import { isUUID } from 'class-validator';
import {
  UserFilterDTO,
  DateRangeDTO,
  AttendanceFilterDTO,
} from './dto/user-dto';

type UserWithProfileAndPrefs = Prisma.UserGetPayload<{
  include: {
    profile: true;
    membership_card: true;
    notification_prefs: true;
    auth_identities: {
      select: {
        provider: true;
        identifier: true;
        verified_at: true;
        is_primary: true;
      };
    };
  };
}>;

type UserAggregate = UserWithProfileAndPrefs & {
  profile: UserProfile;
  notification_prefs: NotificationPreference;
};

export type AuthorizedAttendanceResult = {
  log: AttendanceLog;
  member_name: string;
  access_source: AttendanceAccessSource;
  expires_at: Date | null;
};

export function getManilaGymDay(now: Date): Date {
  const parts = new Intl.DateTimeFormat('en-US', {
    day: '2-digit',
    month: '2-digit',
    timeZone: 'Asia/Manila',
    year: 'numeric',
  }).formatToParts(now);
  const values = Object.fromEntries(
    parts
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, part.value]),
  ) as Record<string, string>;
  return new Date(
    Date.UTC(
      Number(values.year),
      Number(values.month) - 1,
      Number(values.day),
    ),
  );
}

export interface GamificationParticipantRecord {
  user_id: string;
  first_name: string;
  last_name: string;
  avatar_url: string | null;
}

export interface GamificationNotificationTargetRecord {
  user_id: string;
  first_name: string;
  last_name: string;
  preferred_email: string | null;
  rank_up_email: boolean | null;
}

export interface NotificationDispatchTargetRecord {
  user_id: string;
  profile_phone: string | null;
  auth_identities: {
    provider: string;
    identifier: string;
  }[];
}

@Injectable()
export class UserRepository extends BaseRepository {
  constructor(prisma: PrismaService) {
    super(prisma);
  }

  // User

  findUserById(id: string): Promise<User | null> {
    return this.findById<User>(this.prisma.user, id);
  }

  findUserByIdOrThrow(id: string): Promise<User> {
    return this.findByIdOrThrow<User>(this.prisma.user, id, 'User');
  }

  async findActiveUserByIdOrThrow(id: string): Promise<User> {
    const user = await this.findOne<User>(this.prisma.user, {
      id,
      status: 'active',
    });

    if (!user) {
      throw new NotFoundException({
        type: 'NOT_FOUND',
        title: 'Active user not found',
        status: 404,
        detail: 'User not found or account is inactive.',
      });
    }

    return user;
  }

  findUserWithProfile(id: string): Promise<UserWithProfileAndPrefs | null> {
    return this.findById<UserWithProfileAndPrefs>(this.prisma.user, id, {
      profile: true,
      membership_card: true,
      notification_prefs: true,
      auth_identities: {
        select: {
          provider: true,
          identifier: true,
          verified_at: true,
          is_primary: true,
        },
        orderBy: [{ is_primary: 'desc' }, { created_at: 'asc' }],
      },
    });
  }

  async findUserAggregateOrThrow(id: string): Promise<UserAggregate> {
    const user = await this.findByIdOrThrow<UserWithProfileAndPrefs>(
      this.prisma.user,
      id,
      'User',
      {
        profile: true,
        membership_card: true,
        notification_prefs: true,
        auth_identities: {
          select: {
            provider: true,
            identifier: true,
            verified_at: true,
            is_primary: true,
          },
          orderBy: [{ is_primary: 'desc' }, { created_at: 'asc' }],
        },
      },
    );

    return this.requireUserAggregate(user, id);
  }

  findUserByQrToken(token: string): Promise<User | null> {
    return this.findUniqueWhere<User>(this.prisma.user, {
      qr_code_token: token,
    });
  }

  async findActiveUserByQrTokenOrThrow(token: string): Promise<User> {
    const user = await this.findOne<User>(this.prisma.user, {
      qr_code_token: token,
      qr_code_expires_at: {
        gt: new Date(),
      },
      deletedAt: null,
      role: UserRole.member,
      status: UserStatus.active,
    });

    if (!user) {
      throw new NotFoundException({
        type: 'NOT_FOUND',
        title: 'Invalid QR',
        status: 404,
        detail: 'QR code not found or this account cannot be checked in.',
      });
    }

    return user;
  }

  async findAttendanceEligibleUserByIdOrThrow(id: string): Promise<User> {
    const user = await this.findOne<User>(this.prisma.user, {
      id,
      deletedAt: null,
      role: UserRole.member,
      status: UserStatus.active,
    });

    if (!user) {
      throw new NotFoundException({
        type: 'NOT_FOUND',
        title: 'Invalid QR',
        status: 404,
        detail: 'QR code not found or this account cannot be checked in.',
      });
    }

    return user;
  }

  updateUser(id: string, data: Prisma.UserUpdateInput): Promise<User> {
    return this.updateById<User>(this.prisma.user, id, data);
  }

  createAppFeedback(data: Prisma.AppFeedbackCreateInput): Promise<AppFeedback> {
    return this.create<AppFeedback>(this.prisma.appFeedback, data);
  }

  listAppFeedback(limit = 25) {
    return this.prisma.appFeedback.findMany({
      take: limit,
      orderBy: [{ created_at: 'desc' }],
      include: {
        user: {
          select: {
            id: true,
            role: true,
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

  deletePhoneIdentities(userId: string): Promise<{ count: number }> {
    return this.deleteMany(this.prisma.authIdentity, {
      user_id: userId,
      provider: 'phone',
    });
  }

  async listUsers(
    dto: UserFilterDTO,
  ): Promise<PaginatedResult<User & { profile: UserProfile | null }>> {
    const where: Prisma.UserWhereInput = {};

    if (dto.role) where.role = dto.role;
    if (dto.status) where.status = dto.status;

    if (dto.search) {
      const term = dto.search.trim();
      where.OR = [
        { profile: { first_name: { contains: term, mode: 'insensitive' } } },
        { profile: { last_name: { contains: term, mode: 'insensitive' } } },
        {
          auth_identities: {
            some: { identifier: { contains: term, mode: 'insensitive' } },
          },
        },
      ];
    }

    return this.paginate<User & { profile: UserProfile | null }>(
      this.prisma.user,
      { where, include: { profile: true }, orderBy: { created_at: 'desc' } },
      { page: dto.page, limit: dto.limit },
    );
  }

  async listGamificationParticipants(): Promise<
    GamificationParticipantRecord[]
  > {
    const users = await this.prisma.user.findMany({
      where: {
        status: UserStatus.active,
        role: {
          in: [UserRole.member],
        },
      },
      select: {
        id: true,
        profile: {
          select: {
            first_name: true,
            last_name: true,
            avatar_url: true,
          },
        },
      },
    });

    return users.map((user) => ({
      user_id: user.id,
      first_name: user.profile?.first_name ?? '',
      last_name: user.profile?.last_name ?? '',
      avatar_url: user.profile?.avatar_url ?? null,
    }));
  }

  async findGamificationNotificationTargetOrThrow(
    userId: string,
  ): Promise<GamificationNotificationTargetRecord> {
    const user = await this.findByIdOrThrow<{
      id: string;
      profile: {
        first_name: string;
        last_name: string;
      } | null;
      notification_prefs: {
        rank_up_email: boolean | null;
      } | null;
      auth_identities: {
        identifier: string;
      }[];
    }>(this.prisma.user, userId, 'User', {
      profile: {
        select: {
          first_name: true,
          last_name: true,
        },
      },
      notification_prefs: {
        select: {
          rank_up_email: true,
        },
      },
      auth_identities: {
        where: {
          provider: {
            in: ['email', 'google'],
          },
        },
        orderBy: {
          created_at: 'asc',
        },
        select: {
          identifier: true,
        },
        take: 1,
      },
    });

    if (!user.profile) {
      throw new NotFoundException({
        type: 'NOT_FOUND',
        title: 'UserProfile Not Found',
        status: 404,
        detail: `UserProfile for user "${userId}" does not exist.`,
      });
    }

    if (!user.notification_prefs) {
      throw new NotFoundException({
        type: 'NOT_FOUND',
        title: 'NotificationPreference Not Found',
        status: 404,
        detail: `NotificationPreference for user "${userId}" does not exist.`,
      });
    }

    return {
      user_id: user.id,
      first_name: user.profile.first_name,
      last_name: user.profile.last_name,
      preferred_email: user.auth_identities[0]?.identifier ?? null,
      rank_up_email: user.notification_prefs.rank_up_email ?? null,
    };
  }

  async findNotificationDispatchTargetOrThrow(
    userId: string,
  ): Promise<NotificationDispatchTargetRecord> {
    const user = await this.findByIdOrThrow<{
      id: string;
      profile: {
        phone: string | null;
      } | null;
      auth_identities: {
        provider: string;
        identifier: string;
      }[];
    }>(this.prisma.user, userId, 'User', {
      profile: {
        select: {
          phone: true,
        },
      },
      auth_identities: {
        where: {
          provider: {
            in: ['email', 'google', 'phone'],
          },
        },
        orderBy: {
          created_at: 'asc',
        },
        select: {
          provider: true,
          identifier: true,
        },
      },
    });

    return {
      user_id: user.id,
      profile_phone: user.profile?.phone ?? null,
      auth_identities: user.auth_identities,
    };
  }

  // UserProfile

  updateProfile(
    userId: string,
    data: Prisma.UserProfileUpdateInput,
  ): Promise<UserProfile> {
    if (Object.keys(data).length === 0) {
      return this.findUserProfileByUserIdOrThrow(userId);
    }

    return this.updateOneOrThrow<UserProfile>(
      this.prisma.userProfile,
      { user_id: userId },
      data,
      'UserProfile',
    );
  }

  findUserProfileByUserIdOrThrow(userId: string): Promise<UserProfile> {
    return this.findUniqueWhereOrThrow<UserProfile>(
      this.prisma.userProfile,
      { user_id: userId },
      'UserProfile',
    );
  }

  async updatePhoneAndResetVerification(
    userId: string,
    phoneNumber: string,
  ): Promise<void> {
    await this.transaction(async (tx) => {
      const user = await tx.user.findUnique({
        where: { id: userId },
        select: { id: true },
      });
      if (!user) {
        throw new NotFoundException({
          type: 'NOT_FOUND',
          title: 'User Not Found',
          status: 404,
          detail: `User with id "${userId}" does not exist.`,
        });
      }

      const profile = await tx.userProfile.findUnique({
        where: { user_id: userId },
        select: { user_id: true },
      });
      if (!profile) {
        throw new NotFoundException({
          type: 'NOT_FOUND',
          title: 'UserProfile Not Found',
          status: 404,
          detail: `UserProfile for user "${userId}" does not exist.`,
        });
      }

      await tx.userProfile.update({
        where: { user_id: userId },
        data: { phone: phoneNumber },
      });
      await tx.user.update({
        where: { id: userId },
        data: { phone_verified_at: null },
      });
      await tx.authIdentity.deleteMany({
        where: { user_id: userId, provider: 'phone' },
      });
    });
  }

  findLatestDeletionRequest(
    userId: string,
  ): Promise<AccountDeletionRequest | null> {
    return this.prisma.accountDeletionRequest.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  findPendingDeletionRequestByUserId(
    userId: string,
  ): Promise<AccountDeletionRequest | null> {
    return this.prisma.accountDeletionRequest.findFirst({
      where: {
        userId,
        status: AccountDeletionRequestStatus.pending,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  createDeletionRequest(
    data: Prisma.AccountDeletionRequestCreateInput,
  ): Promise<AccountDeletionRequest> {
    return this.create<AccountDeletionRequest>(
      this.prisma.accountDeletionRequest,
      data,
    );
  }

  updateDeletionRequest(
    id: string,
    data: Prisma.AccountDeletionRequestUpdateInput,
  ): Promise<AccountDeletionRequest> {
    return this.updateById<AccountDeletionRequest>(
      this.prisma.accountDeletionRequest,
      id,
      data,
    );
  }

  // ProgressMetric

  createProgressMetric(
    data: Prisma.ProgressMetricCreateInput,
  ): Promise<ProgressMetric> {
    return this.create<ProgressMetric>(this.prisma.progressMetric, data);
  }

  async getProgressHistory(
    userId: string,
    dto: DateRangeDTO,
  ): Promise<PaginatedResult<ProgressMetric>> {
    return this.paginateByUserIdWithDateRange<ProgressMetric>(
      this.prisma.progressMetric,
      userId,
      {
        start_date: dto.start_date,
        end_date: dto.end_date,
        dateField: 'recorded_at',
      },
      { orderBy: { recorded_at: 'desc' } },
      { page: dto.page, limit: dto.limit },
    );
  }

  // AttendanceLog

  /**
   * Authorizes and records one member check-in as a single transaction. The
   * advisory lock and partial unique index make the daily rule safe when two
   * scanners submit the same member at the same time.
   */
  async createAuthorizedAttendance(input: {
    method: AttendanceCheckInMethod;
    scannerId: string | null;
    userId: string;
    now?: Date;
  }): Promise<AuthorizedAttendanceResult> {
    const now = input.now ?? new Date();
    const gymDay = getManilaGymDay(now);
    const noAccessDetail =
      'No active Gym Membership. Record a cash membership from the Memberships page or ask the member to purchase a plan through the app.';

    try {
      return await this.transaction(async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${input.userId}, 100))`;

        const user = await tx.user.findUnique({
          where: { id: input.userId },
          include: {
            membership_card: { select: { id: true } },
            profile: { select: { first_name: true, last_name: true } },
          },
        });
        if (
          !user ||
          user.deletedAt ||
          user.role !== UserRole.member ||
          user.status !== UserStatus.active ||
          (!user.email_verified_at && !user.phone_verified_at)
        ) {
          throw new NotFoundException({
            type: 'NOT_FOUND',
            title: 'Invalid member',
            status: 404,
            detail: 'User not found or account is inactive.',
          });
        }

        const pendingTermination = await tx.accountDeletionRequest.findFirst({
          where: {
            userId: input.userId,
            status: AccountDeletionRequestStatus.pending,
          },
          select: { id: true },
        });
        if (pendingTermination) {
          throw new NotFoundException({
            type: 'NOT_FOUND',
            title: 'Invalid member',
            status: 404,
            detail: 'Archived accounts cannot use attendance check-in.',
          });
        }

        const existing = await tx.attendanceLog.findFirst({
          where: { user_id: input.userId, gym_day: gymDay },
          select: { id: true },
        });
        if (existing) {
          throw new ConflictException({
            type: 'ALREADY_CHECKED_IN',
            title: 'Already Checked In',
            status: 409,
            detail: 'This member already has a check-in today.',
          });
        }

        const memberships = await tx.subscription.findMany({
          where: {
            user_id: input.userId,
            status: { in: ['active', 'past_due', 'cancelled'] },
            starts_at: { lte: now },
            expires_at: { gt: now },
          },
          orderBy: [{ duration_days_snapshot: 'desc' }, { created_at: 'desc' }],
          select: {
            id: true,
            access_consumed_at: true,
            duration_days_snapshot: true,
            expires_at: true,
            plan: { select: { duration_days: true } },
          },
        });

        const longerMembership = memberships.find(
          (membership) =>
            (membership.duration_days_snapshot ?? membership.plan.duration_days) >
            1,
        );
        let subscriptionId: string | null = null;
        let accessSource: AttendanceAccessSource | null = null;
        let expiresAt: Date | null = null;

        if (longerMembership) {
          subscriptionId = longerMembership.id;
          accessSource = AttendanceAccessSource.gym_membership;
          expiresAt = longerMembership.expires_at;
        } else {
          const oneDayMembership = memberships.find(
            (membership) =>
              (membership.duration_days_snapshot ?? membership.plan.duration_days) ===
                1 && !membership.access_consumed_at,
          );
          if (oneDayMembership) {
            const consumed = await tx.subscription.updateMany({
              where: {
                id: oneDayMembership.id,
                access_consumed_at: null,
                status: { in: ['active', 'past_due', 'cancelled'] },
                starts_at: { lte: now },
                expires_at: { gt: now },
              },
              data: { access_consumed_at: now, status: 'expired' },
            });
            if (consumed.count !== 1) {
              throw new ConflictException({
                type: 'CONFLICT',
                title: 'Gym Membership Already Used',
                status: 409,
                detail: noAccessDetail,
              });
            }
            subscriptionId = oneDayMembership.id;
            accessSource = AttendanceAccessSource.paid_one_day_pass;
            expiresAt = oneDayMembership.expires_at;
          }
        }

        if (!accessSource && input.method === AttendanceCheckInMethod.qr) {
          // Free access is an explicit, staff-granted entitlement. It must
          // never be inferred from account creation or the absence of a paid
          // membership/card. The conditional update is the atomic one-time
          // consume guard while the transaction lock serializes the check-in.
          const freePassIsUsable = Boolean(
            user.free_day_pass_granted_at &&
              user.free_day_pass_expires_at &&
              user.free_day_pass_expires_at > now &&
              !user.free_day_pass_redeemed_at &&
              !user.free_day_pass_revoked_at,
          );

          if (freePassIsUsable) {
            const redeemed = await tx.user.updateMany({
              where: {
                id: input.userId,
                free_day_pass_granted_at: { not: null },
                free_day_pass_expires_at: { gt: now },
                free_day_pass_redeemed_at: null,
                free_day_pass_revoked_at: null,
              },
              data: { free_day_pass_redeemed_at: now },
            });
            if (redeemed.count === 1) {
              accessSource = AttendanceAccessSource.free_one_day_pass;
              expiresAt = user.free_day_pass_expires_at;
            }
          }
        }

        if (!accessSource) {
          throw new ConflictException({
            type: 'NO_ACTIVE_GYM_MEMBERSHIP',
            title: 'No active Gym Membership',
            status: 409,
            detail: noAccessDetail,
          });
        }

        const log = await tx.attendanceLog.create({
          data: {
            access_source: accessSource,
            check_in_at: now,
            check_in_method: input.method,
            gym_day: gymDay,
            ...(subscriptionId ? { subscription: { connect: { id: subscriptionId } } } : {}),
            ...(input.scannerId ? { scanner: { connect: { id: input.scannerId } } } : {}),
            user: { connect: { id: input.userId } },
          },
        });

        return {
          access_source: accessSource,
          expires_at: expiresAt,
          log,
          member_name: `${user.profile?.first_name ?? ''} ${user.profile?.last_name ?? ''}`.trim(),
        };
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002' &&
        String(error.message).includes('attendance_logs_user_id_gym_day_key')
      ) {
        throw new ConflictException({
          type: 'ALREADY_CHECKED_IN',
          title: 'Already Checked In',
          status: 409,
          detail: 'This member already has a check-in today.',
        });
      }
      throw error;
    }
  }

  async getMyAttendance(
    userId: string,
    dto: DateRangeDTO,
  ): Promise<PaginatedResult<AttendanceLog>> {
    return this.paginateByUserIdWithDateRange<AttendanceLog>(
      this.prisma.attendanceLog,
      userId,
      {
        start_date: dto.start_date,
        end_date: dto.end_date,
        dateField: 'check_in_at',
      },
      { orderBy: { check_in_at: 'desc' } },
      { page: dto.page, limit: dto.limit },
    );
  }

  async getAllAttendance(
    dto: AttendanceFilterDTO,
  ): Promise<PaginatedResult<AttendanceLog>> {
    const where: Prisma.AttendanceLogWhereInput = {};
    if (dto.user_id) where.user_id = dto.user_id;

    const search = dto.search?.trim();
    if (search) {
      if (isUUID(search, 'all')) {
        where.user = { id: search };
      } else {
        const searchTerms = search.split(/\s+/).filter(Boolean);
        where.user = {
          AND: searchTerms.map((term) => ({
            OR: [
              {
                auth_identities: {
                  some: {
                    identifier: { contains: term, mode: 'insensitive' },
                    provider: 'email',
                  },
                },
              },
              {
                profile: {
                  is: {
                    OR: [
                      { first_name: { contains: term, mode: 'insensitive' } },
                      { last_name: { contains: term, mode: 'insensitive' } },
                    ],
                  },
                },
              },
            ],
          })),
        };
      }
    }

    const order = dto.order === 'asc' ? 'asc' : 'desc';

    return this.paginateWithDateRange<AttendanceLog>(
      this.prisma.attendanceLog,
      where,
      {
        start_date: dto.start_date,
        end_date: dto.end_date,
        dateField: 'check_in_at',
      },
      {
        include: { user: { include: { profile: true } } },
        orderBy: [{ check_in_at: order }, { id: order }],
      },
      { page: dto.page, limit: dto.limit },
    );
  }

  private requireUserAggregate(
    user: UserWithProfileAndPrefs,
    userId: string,
  ): UserAggregate {
    if (!user.profile) {
      throw new NotFoundException({
        type: 'NOT_FOUND',
        title: 'UserProfile Not Found',
        status: 404,
        detail: `UserProfile for user "${userId}" does not exist.`,
      });
    }

    if (!user.notification_prefs) {
      throw new NotFoundException({
        type: 'NOT_FOUND',
        title: 'NotificationPreference Not Found',
        status: 404,
        detail: `NotificationPreference for user "${userId}" does not exist.`,
      });
    }

    return user as UserAggregate;
  }
}
