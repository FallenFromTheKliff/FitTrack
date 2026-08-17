import { Injectable, NotFoundException } from '@nestjs/common';
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
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  BaseRepository,
  PaginatedResult,
} from '../common/base-repository/base-repository';
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

  findOpenAttendanceToday(userId: string): Promise<AttendanceLog | null> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    return this.findOne<AttendanceLog>(this.prisma.attendanceLog, {
      user_id: userId,
      check_in_at: { gte: today, lt: tomorrow },
      check_out_at: null,
    });
  }

  createAttendanceLog(
    data: Prisma.AttendanceLogCreateInput,
  ): Promise<AttendanceLog> {
    return this.create<AttendanceLog>(this.prisma.attendanceLog, data);
  }

  findAttendanceLogById(id: string): Promise<AttendanceLog | null> {
    return this.findById<AttendanceLog>(this.prisma.attendanceLog, id);
  }

  findAttendanceLogByIdOrThrow(id: string): Promise<AttendanceLog> {
    return this.findByIdOrThrow<AttendanceLog>(
      this.prisma.attendanceLog,
      id,
      'AttendanceLog',
    );
  }

  checkoutAttendance(id: string): Promise<AttendanceLog> {
    return this.updateById<AttendanceLog>(this.prisma.attendanceLog, id, {
      check_out_at: new Date(),
    });
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
        orderBy: { check_in_at: 'desc' },
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
