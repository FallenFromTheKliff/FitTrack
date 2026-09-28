import {
  NotFoundException,
  ConflictException,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

// =============================================================================
// Shared Types
// =============================================================================

export interface PaginationOptions {
  page?: number;
  limit?: number;
}

export interface PaginatedResult<T> {
  data: T[];
  meta: {
    page: number;
    limit: number;
    total: number;
    total_pages: number;
  };
}

export interface DateRangeOptions {
  start_date?: string;
  end_date?: string;
  dateField?: string; // defaults to 'created_at'
}

export interface SoftDeleteOptions {
  field?: string; // defaults to 'is_active'
  value?: boolean; // defaults to false
}

type QueryShape = Record<string, unknown>;
type OrderByShape = QueryShape | QueryShape[];

interface UniqueQueryArgs {
  where: QueryShape;
  include?: QueryShape;
  select?: QueryShape;
}

interface FirstQueryArgs {
  where?: QueryShape;
  include?: QueryShape;
  select?: QueryShape;
  orderBy?: OrderByShape;
}

interface ManyQueryArgs extends FirstQueryArgs {
  skip?: number;
  take?: number;
}

interface CreateArgs {
  data: QueryShape;
  include?: QueryShape;
}

interface UpsertArgs {
  where: QueryShape;
  create: QueryShape;
  update: QueryShape;
  include?: QueryShape;
}

interface UpdateArgs extends CreateArgs {
  where: QueryShape;
}

interface WriteManyArgs {
  where: QueryShape;
  data: QueryShape;
}

interface CreateManyArgs {
  data: QueryShape[];
  skipDuplicates?: boolean;
}

interface RepositoryDelegate {
  count(args: { where?: QueryShape }): Promise<number>;
  findUnique(args: UniqueQueryArgs): Promise<unknown>;
  findFirst(args: FirstQueryArgs): Promise<unknown>;
  findMany(args: ManyQueryArgs): Promise<unknown[]>;
  create(args: CreateArgs): Promise<unknown>;
  createMany(args: CreateManyArgs): Promise<{ count: number }>;
  upsert(args: UpsertArgs): Promise<unknown>;
  update(args: UpdateArgs): Promise<unknown>;
  updateMany(args: WriteManyArgs): Promise<{ count: number }>;
  delete(args: { where: QueryShape }): Promise<unknown>;
  deleteMany(args: { where: QueryShape }): Promise<{ count: number }>;
}

function isKnownPrismaError(
  error: unknown,
): error is Prisma.PrismaClientKnownRequestError {
  return error instanceof Prisma.PrismaClientKnownRequestError;
}

// =============================================================================
// BaseRepository
// Every domain repository extends this. Pass PrismaService via super(prisma).
// =============================================================================

export abstract class BaseRepository {
  constructor(protected readonly prisma: PrismaService) {}

  // ── Existence Checks ────────────────────────────────────────────────────────

  protected async exists(model: unknown, where: QueryShape): Promise<boolean> {
    const count = await (model as Pick<RepositoryDelegate, 'count'>).count({
      where,
    });
    return count > 0;
  }

  protected async existsById(model: unknown, id: string): Promise<boolean> {
    const count = await (model as Pick<RepositoryDelegate, 'count'>).count({
      where: { id },
    });
    return count > 0;
  }

  /**
   * Throws 409 CONFLICT if a matching record already exists.
   *
   * Example:
   *   await this.assertNotExists(
   *     this.prisma.authIdentity,
   *     { provider: 'email', identifier: email },
   *     'Email',
   *   );
   */
  protected async assertNotExists(
    model: unknown,
    where: QueryShape,
    label: string,
  ): Promise<void> {
    const found = await this.exists(model, where);
    if (found) {
      throw new ConflictException({
        type: 'CONFLICT',
        title: `${label} Already Exists`,
        status: 409,
        detail: `A ${label} with the provided details already exists.`,
      });
    }
  }

  // ── Find by ID ───────────────────────────────────────────────────────────────

  /**
   * Find by primary key. Returns null if not found.
   *
   * Example:
   *   const plan = await this.findById<MembershipPlan>(
   *     this.prisma.membershipPlan, planId,
   *   );
   */
  protected findById<T>(
    model: unknown,
    id: string,
    include?: QueryShape,
    select?: QueryShape,
  ): Promise<T | null> {
    return (model as Pick<RepositoryDelegate, 'findUnique'>).findUnique({
      where: { id },
      include: include ?? undefined,
      select: select ?? undefined,
    }) as Promise<T | null>;
  }

  /**
   * Find by primary key. Throws RFC 7807 404 if not found.
   *
   * Example:
   *   const plan = await this.findByIdOrThrow<MembershipPlan>(
   *     this.prisma.membershipPlan, planId, 'MembershipPlan',
   *   );
   */
  protected async findByIdOrThrow<T>(
    model: unknown,
    id: string,
    entityName: string,
    include?: QueryShape,
    select?: QueryShape,
  ): Promise<T> {
    const record = await (
      model as Pick<RepositoryDelegate, 'findUnique'>
    ).findUnique({
      where: { id },
      include: include ?? undefined,
      select: select ?? undefined,
    });
    if (!record) {
      throw new NotFoundException({
        type: 'NOT_FOUND',
        title: `${entityName} Not Found`,
        status: 404,
        detail: `${entityName} with id "${id}" does not exist.`,
      });
    }
    return record as T;
  }

  // ── Find One ─────────────────────────────────────────────────────────────────

  /**
   * Find first match. Returns null if not found.
   *
   * Example:
   *   const identity = await this.findOne<AuthIdentity>(
   *     this.prisma.authIdentity,
   *     { provider: 'email', identifier: email },
   *   );
   */
  protected findOne<T>(
    model: unknown,
    where: QueryShape,
    include?: QueryShape,
    orderBy?: OrderByShape,
    select?: QueryShape,
  ): Promise<T | null> {
    return (model as Pick<RepositoryDelegate, 'findFirst'>).findFirst({
      where,
      include: include ?? undefined,
      orderBy: orderBy ?? undefined,
      select: select ?? undefined,
    }) as Promise<T | null>;
  }

  /**
   * Find first match. Throws RFC 7807 404 if not found.
   *
   * Example:
   *   const sub = await this.findOneOrThrow<Subscription>(
   *     this.prisma.subscription,
   *     { user_id: userId, status: 'active' },
   *     'Subscription',
   *   );
   */
  protected async findOneOrThrow<T>(
    model: unknown,
    where: QueryShape,
    entityName: string,
    include?: QueryShape,
    orderBy?: OrderByShape,
  ): Promise<T> {
    const record = await (
      model as Pick<RepositoryDelegate, 'findFirst'>
    ).findFirst({ where, include, orderBy });
    if (!record) {
      throw new NotFoundException({
        type: 'NOT_FOUND',
        title: `${entityName} Not Found`,
        status: 404,
        detail: `${entityName} not found.`,
      });
    }
    return record as T;
  }

  /**
   * Find by a unique key other than id. Returns null if not found.
   *
   * Example:
   *   const token = await this.findUniqueWhere<RefreshToken>(
   *     this.prisma.refreshToken,
   *     { token_hash: hash },
   *   );
   */
  protected findUniqueWhere<T>(
    model: unknown,
    where: QueryShape,
    include?: QueryShape,
    select?: QueryShape,
  ): Promise<T | null> {
    return (model as Pick<RepositoryDelegate, 'findUnique'>).findUnique({
      where,
      include: include ?? undefined,
      select: select ?? undefined,
    }) as Promise<T | null>;
  }

  /**
   * Find by a unique key other than id. Throws RFC 7807 404 if not found.
   */
  protected async findUniqueWhereOrThrow<T>(
    model: unknown,
    where: QueryShape,
    entityName: string,
    include?: QueryShape,
    select?: QueryShape,
  ): Promise<T> {
    const record = await (
      model as Pick<RepositoryDelegate, 'findUnique'>
    ).findUnique({
      where,
      include: include ?? undefined,
      select: select ?? undefined,
    });
    if (!record) {
      throw new NotFoundException({
        type: 'NOT_FOUND',
        title: `${entityName} Not Found`,
        status: 404,
        detail: `${entityName} not found.`,
      });
    }
    return record as T;
  }

  // ── Find Many ────────────────────────────────────────────────────────────────

  /**
   * Find all matching records — no pagination.
   * Use only for small, bounded result sets.
   *
   * Example:
   *   const slots = await this.findAll<CoachAvailabilitySlot>(
   *     this.prisma.coachAvailabilitySlot,
   *     { coach_id: coachId, is_active: true },
   *   );
   */
  protected findAll<T>(
    model: unknown,
    where?: QueryShape,
    include?: QueryShape,
    orderBy?: OrderByShape,
    select?: QueryShape,
  ): Promise<T[]> {
    return (model as Pick<RepositoryDelegate, 'findMany'>).findMany({
      where: where ?? undefined,
      include: include ?? undefined,
      orderBy: orderBy ?? undefined,
      select: select ?? undefined,
    }) as Promise<T[]>;
  }

  /**
   * Find all records for a user_id — no pagination.
   * Used for S6 relationships, S11 chat sessions, etc.
   *
   * Example:
   *   const relationships = await this.findAllByUserId<CoachClientRelationship>(
   *     this.prisma.coachClientRelationship, userId,
   *   );
   */
  protected findAllByUserId<T>(
    model: unknown,
    userId: string,
    additionalWhere?: QueryShape,
    include?: QueryShape,
    orderBy?: OrderByShape,
  ): Promise<T[]> {
    return (model as Pick<RepositoryDelegate, 'findMany'>).findMany({
      where: { user_id: userId, ...additionalWhere },
      include: include ?? undefined,
      orderBy: orderBy ?? undefined,
    }) as Promise<T[]>;
  }

  /**
   * Find only active records (is_active = true).
   * Used for plans, amenities, exercises, products, coaches.
   *
   * Example:
   *   const plans = await this.findActive<MembershipPlan>(
   *     this.prisma.membershipPlan,
   *     undefined,
   *     { sort_order: 'asc' },
   *   );
   */
  protected findActive<T>(
    model: unknown,
    additionalWhere?: QueryShape,
    orderBy?: OrderByShape,
    include?: QueryShape,
  ): Promise<T[]> {
    return (model as Pick<RepositoryDelegate, 'findMany'>).findMany({
      where: { is_active: true, ...additionalWhere },
      include: include ?? undefined,
      orderBy: orderBy ?? undefined,
    }) as Promise<T[]>;
  }

  // ── Paginate ─────────────────────────────────────────────────────────────────

  /**
   * Paginated list with total count and meta envelope.
   * Returns { data: T[], meta: { page, limit, total, total_pages } }
   *
   * Example:
   *   return this.paginate<User>(
   *     this.prisma.user,
   *     { where, include: { profile: true }, orderBy: { created_at: 'desc' } },
   *     { page: dto.page, limit: dto.limit },
   *   );
   */
  protected async paginate<T>(
    model: unknown,
    args: {
      where?: QueryShape;
      orderBy?: OrderByShape;
      include?: QueryShape;
      select?: QueryShape;
    },
    options: PaginationOptions,
  ): Promise<PaginatedResult<T>> {
    const page = Math.max(1, options.page ?? 1);
    const limit = Math.min(100, Math.max(1, options.limit ?? 20));
    const skip = (page - 1) * limit;

    const delegate = model as Pick<RepositoryDelegate, 'findMany' | 'count'>;
    const dataPromise = delegate.findMany({
      ...args,
      skip,
      take: limit,
    }) as Promise<T[]>;
    const totalPromise = delegate.count({ where: args.where });
    const [data, total] = await Promise.all([dataPromise, totalPromise]);

    return {
      data,
      meta: {
        page,
        limit,
        total,
        total_pages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Paginate filtered by user_id.
   * Handles every "get my X" endpoint across the system.
   *
   * Example:
   *   return this.paginateByUserId<AttendanceLog>(
   *     this.prisma.attendanceLog,
   *     userId,
   *     { orderBy: { check_in_at: 'desc' } },
   *     { page: dto.page, limit: dto.limit },
   *   );
   */
  protected paginateByUserId<T>(
    model: unknown,
    userId: string,
    args: {
      additionalWhere?: QueryShape;
      orderBy?: OrderByShape;
      include?: QueryShape;
      select?: QueryShape;
    },
    options: PaginationOptions,
  ): Promise<PaginatedResult<T>> {
    return this.paginate<T>(
      model,
      {
        where: { user_id: userId, ...args.additionalWhere },
        orderBy: args.orderBy,
        include: args.include,
        select: args.select,
      },
      options,
    );
  }

  /**
   * Paginate with optional date range filter.
   * Handles history, logs, and transaction list endpoints.
   *
   * Example:
   *   return this.paginateWithDateRange<ProgressMetric>(
   *     this.prisma.progressMetric,
   *     { user_id: userId },
   *     { start_date: dto.start_date, end_date: dto.end_date, dateField: 'recorded_at' },
   *     { orderBy: { recorded_at: 'desc' } },
   *     { page: dto.page, limit: dto.limit },
   *   );
   */
  protected paginateWithDateRange<T>(
    model: unknown,
    baseWhere: QueryShape,
    range: DateRangeOptions,
    args: {
      orderBy?: OrderByShape;
      include?: QueryShape;
      select?: QueryShape;
    },
    options: PaginationOptions,
  ): Promise<PaginatedResult<T>> {
    const field = range.dateField ?? 'created_at';
    const dateFilter: { gte?: Date; lte?: Date } = {};
    if (range.start_date) dateFilter.gte = new Date(range.start_date);
    if (range.end_date) dateFilter.lte = new Date(range.end_date);

    const where: QueryShape = {
      ...baseWhere,
      ...(Object.keys(dateFilter).length > 0 ? { [field]: dateFilter } : {}),
    };

    return this.paginate<T>(model, { where, ...args }, options);
  }

  /**
   * Paginate a user's records with an optional date range filter.
   * Handles user-scoped histories such as progress and attendance.
   */
  protected paginateByUserIdWithDateRange<T>(
    model: unknown,
    userId: string,
    range: DateRangeOptions,
    args: {
      additionalWhere?: QueryShape;
      orderBy?: OrderByShape;
      include?: QueryShape;
      select?: QueryShape;
    },
    options: PaginationOptions,
  ): Promise<PaginatedResult<T>> {
    return this.paginateWithDateRange<T>(
      model,
      { user_id: userId, ...args.additionalWhere },
      range,
      {
        orderBy: args.orderBy,
        include: args.include,
        select: args.select,
      },
      options,
    );
  }

  // ── Count ────────────────────────────────────────────────────────────────────

  /**
   * Count records matching a where clause.
   * Used for unread notifications, analytics stats, leaderboard.
   *
   * Example:
   *   const unread = await this.count(this.prisma.notification, {
   *     user_id: userId, read_at: null, channel: 'in_app',
   *   });
   */
  protected count(model: unknown, where?: QueryShape): Promise<number> {
    return (model as Pick<RepositoryDelegate, 'count'>).count({ where });
  }

  // ── Create ───────────────────────────────────────────────────────────────────

  /**
   * Create a single record.
   *
   * Example:
   *   const metric = await this.create<ProgressMetric>(
   *     this.prisma.progressMetric,
   *     { user: { connect: { id: userId } }, weight_kg: dto.weight_kg },
   *   );
   */
  protected create<T>(
    model: unknown,
    data: QueryShape,
    include?: QueryShape,
  ): Promise<T> {
    return (model as Pick<RepositoryDelegate, 'create'>).create({
      data,
      include,
    }) as Promise<T>;
  }

  /**
   * Batch INSERT multiple records.
   * Used for plan exercises, schedule days, notification batch inserts.
   *
   * Example:
   *   await this.createMany(this.prisma.planExercise, exercises);
   */
  protected createMany(
    model: unknown,
    data: QueryShape[],
    skipDuplicates = false,
  ): Promise<{ count: number }> {
    return (model as Pick<RepositoryDelegate, 'createMany'>).createMany({
      data,
      skipDuplicates,
    });
  }

  /**
   * Create or update if already exists.
   * Used for phone AuthIdentity, MuscleMasteryProgress.
   *
   * Example:
   *   await this.upsert<MuscleMasteryProgress>(
   *     this.prisma.muscleMasteryProgress,
   *     { user_id_muscle_group: { user_id: userId, muscle_group: group } },
   *     { xp_points: { increment: xpDelta }, total_volume_kg: { increment: volDelta } },
   *     { user_id: userId, muscle_group: group, xp_points: xpDelta, total_volume_kg: volDelta },
   *   );
   */
  protected upsert<T>(
    model: unknown,
    where: QueryShape,
    update: QueryShape,
    create: QueryShape,
    include?: QueryShape,
  ): Promise<T> {
    return (model as Pick<RepositoryDelegate, 'upsert'>).upsert({
      where,
      update,
      create,
      include,
    }) as Promise<T>;
  }

  // ── Update ───────────────────────────────────────────────────────────────────

  /**
   * Update by primary key. Throws RFC 7807 404 on Prisma P2025.
   *
   * Example:
   *   const user = await this.updateById<User>(
   *     this.prisma.user, userId, { status: 'suspended' },
   *   );
   */
  protected async updateById<T>(
    model: unknown,
    id: string,
    data: QueryShape,
    include?: QueryShape,
  ): Promise<T> {
    try {
      return (await (model as Pick<RepositoryDelegate, 'update'>).update({
        where: { id },
        data,
        include,
      })) as T;
    } catch (e: unknown) {
      if (isKnownPrismaError(e) && e.code === 'P2025') {
        throw new NotFoundException({
          type: 'NOT_FOUND',
          title: 'Record Not Found',
          status: 404,
          detail: `Record with id "${id}" not found for update.`,
        });
      }
      throw e;
    }
  }

  /**
   * Update by a custom where clause.
   *
   * Example:
   *   await this.updateOne(
   *     this.prisma.otpVerification,
   *     { id: otp.id },
   *     { consumed_at: new Date() },
   *   );
   */
  protected updateOne<T>(
    model: unknown,
    where: QueryShape,
    data: QueryShape,
    include?: QueryShape,
  ): Promise<T> {
    return (model as Pick<RepositoryDelegate, 'update'>).update({
      where,
      data,
      include,
    }) as Promise<T>;
  }

  /**
   * Update by a custom where clause. Throws RFC 7807 404 on Prisma P2025.
   *
   * Example:
   *   await this.updateOneOrThrow(
   *     this.prisma.userProfile,
   *     { user_id: userId },
   *     { avatar_url: avatarUrl },
   *     'UserProfile',
   *   );
   */
  protected async updateOneOrThrow<T>(
    model: unknown,
    where: QueryShape,
    data: QueryShape,
    entityName: string,
    include?: QueryShape,
  ): Promise<T> {
    try {
      return (await (model as Pick<RepositoryDelegate, 'update'>).update({
        where,
        data,
        include,
      })) as T;
    } catch (e: unknown) {
      if (isKnownPrismaError(e) && e.code === 'P2025') {
        throw new NotFoundException({
          type: 'NOT_FOUND',
          title: `${entityName} Not Found`,
          status: 404,
          detail: `${entityName} not found for update.`,
        });
      }
      throw e;
    }
  }

  /**
   * Batch update. Returns count of updated records.
   * Used for revoking refresh tokens, expiring subscriptions,
   * deactivating slots, archiving TDEE profiles.
   *
   * Example:
   *   await this.updateMany(
   *     this.prisma.refreshToken,
   *     { user_id: userId, revoked_at: null },
   *     { revoked_at: new Date() },
   *   );
   */
  protected updateMany(
    model: unknown,
    where: QueryShape,
    data: QueryShape,
  ): Promise<{ count: number }> {
    return (model as Pick<RepositoryDelegate, 'updateMany'>).updateMany({
      where,
      data,
    });
  }

  // ── Status Transitions ────────────────────────────────────────────────────────

  /**
   * Update the status field by id with optional extra fields.
   * Covers every status transition: subscriptions, payments,
   * bookings, appointments, workout sessions, sale transactions.
   *
   * Example:
   *   await this.updateStatus(
   *     this.prisma.subscription, subId, 'active',
   *     { starts_at: new Date(), expires_at: expiresAt },
   *   );
   *
   *   await this.updateStatus(
   *     this.prisma.amenityBooking, bookingId, 'cancelled',
   *     { cancelled_at: new Date() },
   *   );
   */
  protected updateStatus<T>(
    model: unknown,
    id: string,
    status: string,
    additionalData?: QueryShape,
  ): Promise<T> {
    return (model as Pick<RepositoryDelegate, 'update'>).update({
      where: { id },
      data: { status, ...additionalData },
    }) as Promise<T>;
  }

  // ── Soft Delete ───────────────────────────────────────────────────────────────

  /**
   * Soft-delete a single record by id (sets is_active = false).
   * Used for amenities, exercises, products, gym layout items.
   *
   * Example:
   *   await this.softDeleteById(this.prisma.amenity, amenityId);
   */
  protected softDeleteById<T>(
    model: unknown,
    id: string,
    options?: SoftDeleteOptions,
  ): Promise<T> {
    const field = options?.field ?? 'is_active';
    const value = options?.value ?? false;
    return (model as Pick<RepositoryDelegate, 'update'>).update({
      where: { id },
      data: { [field]: value },
    }) as Promise<T>;
  }

  /**
   * Soft-delete multiple records matching a where clause.
   * Used for TDEE history, availability slots, AI chat sessions,
   * macro targets.
   *
   * Example:
   *   await this.softDeleteMany(
   *     this.prisma.tdeeProfile,
   *     { user_id: userId, is_active: true },
   *   );
   */
  protected softDeleteMany(
    model: unknown,
    where: QueryShape,
    options?: SoftDeleteOptions,
  ): Promise<{ count: number }> {
    const field = options?.field ?? 'is_active';
    const value = options?.value ?? false;
    return (model as Pick<RepositoryDelegate, 'updateMany'>).updateMany({
      where,
      data: { [field]: value },
    });
  }

  // ── Hard Delete ───────────────────────────────────────────────────────────────

  /**
   * Permanently delete by id.
   *
   * Example:
   *   await this.deleteById(this.prisma.notification, notificationId);
   */
  protected async deleteById(model: unknown, id: string): Promise<void> {
    try {
      await (model as Pick<RepositoryDelegate, 'delete'>).delete({
        where: { id },
      });
    } catch (e: unknown) {
      if (isKnownPrismaError(e) && e.code === 'P2025') {
        throw new NotFoundException({
          type: 'NOT_FOUND',
          title: 'Record Not Found',
          status: 404,
          detail: `Record with id "${id}" not found for deletion.`,
        });
      }
      throw e;
    }
  }

  /**
   * Permanently delete multiple records.
   * Used for cascade-style cleanup.
   *
   * Example:
   *   await this.deleteMany(
   *     this.prisma.planExercise, { schedule_day_id: dayId },
   *   );
   */
  protected deleteMany(
    model: unknown,
    where: QueryShape,
  ): Promise<{ count: number }> {
    return (model as Pick<RepositoryDelegate, 'deleteMany'>).deleteMany({
      where,
    });
  }

  // ── Ownership Guard ───────────────────────────────────────────────────────────

  /**
   * Find a record by id and verify it belongs to the requesting user.
   * Throws 404 if not found, 403 if owned by someone else.
   *
   * Example:
   *   const booking = await this.findByIdAndAssertOwnership<AmenityBooking>(
   *     this.prisma.amenityBooking, bookingId, userId, 'AmenityBooking',
   *   );
   */
  protected async findByIdAndAssertOwnership<T>(
    model: unknown,
    id: string,
    userId: string,
    entityName: string,
    include?: QueryShape,
  ): Promise<T> {
    const record = (await (
      model as Pick<RepositoryDelegate, 'findUnique'>
    ).findUnique({
      where: { id },
      include,
    })) as { user_id?: string } | null;
    if (!record) {
      throw new NotFoundException({
        type: 'NOT_FOUND',
        title: `${entityName} Not Found`,
        status: 404,
        detail: `${entityName} with id "${id}" does not exist.`,
      });
    }
    if (record.user_id !== userId) {
      throw new HttpException(
        {
          type: 'FORBIDDEN',
          title: 'Forbidden',
          status: 403,
          detail: `You do not have permission to access this ${entityName}.`,
        },
        HttpStatus.FORBIDDEN,
      );
    }
    return record as T;
  }

  // ── Transactions ─────────────────────────────────────────────────────────────

  /**
   * Atomic Prisma transaction — all or nothing.
   * Used for register, subscribe, create booking, reset password,
   * recalculate TDEE, complete workout session.
   *
   * Example:
   *   return this.transaction(async (tx) => {
   *     const user = await tx.user.create({ data: { ... } });
   *     await tx.userProfile.create({ data: { user_id: user.id } });
   *     await tx.notificationPreference.create({ data: { user_id: user.id } });
   *     return user;
   *   });
   */
  protected transaction<T>(
    fn: (tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    return this.prisma.$transaction(fn);
  }

  // ── Raw Queries ───────────────────────────────────────────────────────────────

  /**
   * Raw SQL via tagged template literal.
   * Use only for S13 analytics aggregations and complex joins
   * that Prisma ORM cannot express cleanly.
   *
   * Example:
   *   const rows = await this.queryRaw<{ date: string; count: bigint }[]>`
   *     SELECT DATE(check_in_at) as date, COUNT(*) as count
   *     FROM attendance_logs
   *     WHERE check_in_at BETWEEN ${start} AND ${end}
   *     GROUP BY DATE(check_in_at)
   *     ORDER BY date
   *   `;
   */
  protected queryRaw<T = unknown>(
    query: TemplateStringsArray,
    ...values: unknown[]
  ): Promise<T> {
    return this.prisma.$queryRaw<T>(query, ...values);
  }
}
