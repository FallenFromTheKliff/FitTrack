import { ConflictException, Injectable } from '@nestjs/common';
import {
  AmenityBooking,
  BookingStatus,
  CommerceCheckoutHoldStatus,
  EquipmentStatus,
  Payment,
  PayableType,
  PaymentProvider,
  PaymentStage,
  PaymentStatus,
  Prisma,
} from '@prisma/client';

import { BaseRepository } from '../../common/base-repository/base-repository';
import type { PaginatedResult } from '../../common/base-repository/base-repository';
import { lockAndAssertVenueCoachWindow } from '../../coaching/commerce/venue-coach-scheduling';
import { PrismaService } from '../../prisma/prisma.service';
import { getAmenityBookingBlockReason } from '../amenity/amenity-reservability';
import { DateRangeDTO } from '../../user/dto/user-dto';

export const ACTIVE_CAPACITY_BOOKING_STATUSES = [
  BookingStatus.pending,
  BookingStatus.confirmed,
  BookingStatus.balance_pending,
] as const;
const GYM_TIMEZONE_OFFSET_MINUTES = 8 * 60;
const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
type InitialBookingPaymentStage = Extract<
  PaymentStage,
  typeof PaymentStage.downpayment | typeof PaymentStage.full
>;
type PendingBookingPaymentStatus = Extract<
  PaymentStatus,
  typeof PaymentStatus.awaiting_verification | typeof PaymentStatus.pending
>;

type BookingWithAmenity = Prisma.AmenityBookingGetPayload<{
  include: {
    amenity: true;
    coach: {
      include: {
        user: {
          include: {
            profile: true;
          };
        };
      };
    };
  };
}>;

type BookingNotificationContext = Prisma.AmenityBookingGetPayload<{
  include: {
    amenity: true;
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

type AdminBookingListItem = Prisma.AmenityBookingGetPayload<{
  include: {
    amenity: true;
    coach: {
      include: {
        user: {
          include: {
            profile: true;
          };
        };
      };
    };
    user: {
      select: {
        id: true;
        role: true;
        status: true;
        email_verified_at: true;
        phone_verified_at: true;
        created_at: true;
        updated_at: true;
        profile: true;
      };
    };
  };
}>;

export type CoachVenueWorkRecord = AdminBookingListItem;

type BookingPaymentInitiationRecord = {
  booking: AmenityBooking;
  payment: Payment;
};

type StalePendingBooking = Pick<
  AmenityBooking,
  'amenity_id' | 'id' | 'user_id'
>;

export type MaintenanceBookingResolutionResult = {
  booking: AmenityBooking;
  previousAmenityId: string;
  previousEndsAt: Date;
  previousStartsAt: Date;
};

@Injectable()
export class BookingRepository extends BaseRepository {
  constructor(prisma: PrismaService) {
    super(prisma);
  }

  private readonly bookingWithAmenityInclude = {
    amenity: true,
    coach: {
      include: {
        user: {
          include: {
            profile: true,
          },
        },
      },
    },
  } as const;

  private readonly adminBookingInclude = {
    amenity: true,
    coach: {
      include: {
        user: {
          include: {
            profile: true,
          },
        },
      },
    },
    user: {
      select: {
        id: true,
        role: true,
        status: true,
        email_verified_at: true,
        phone_verified_at: true,
        created_at: true,
        updated_at: true,
        profile: true,
      },
    },
  } as const;

  private readonly bookingNotificationInclude = {
    amenity: true,
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

  listActiveOverlappingBookings(
    amenityId: string,
    rangeStart: Date,
    rangeEnd: Date,
  ): Promise<AmenityBooking[]> {
    return this.findAll<AmenityBooking>(
      this.prisma.amenityBooking,
      {
        amenity_id: amenityId,
        status: { in: [...ACTIVE_CAPACITY_BOOKING_STATUSES] },
        starts_at: { lt: rangeEnd },
        ends_at: { gt: rangeStart },
      },
      undefined,
      { starts_at: 'asc' },
    );
  }

  countActiveOverlappingBookings(
    amenityId: string,
    rangeStart: Date,
    rangeEnd: Date,
  ): Promise<number> {
    return this.count(this.prisma.amenityBooking, {
      amenity_id: amenityId,
      status: { in: [...ACTIVE_CAPACITY_BOOKING_STATUSES] },
      starts_at: { lt: rangeEnd },
      ends_at: { gt: rangeStart },
    });
  }

  findBookingByIdAndAssertOwnership(
    bookingId: string,
    userId: string,
  ): Promise<AmenityBooking> {
    return this.findByIdAndAssertOwnership<AmenityBooking>(
      this.prisma.amenityBooking,
      bookingId,
      userId,
      'AmenityBooking',
    );
  }

  findBookingWithAmenityByIdOrThrow(id: string): Promise<BookingWithAmenity> {
    return this.findByIdOrThrow<BookingWithAmenity>(
      this.prisma.amenityBooking,
      id,
      'AmenityBooking',
      this.bookingWithAmenityInclude,
    );
  }

  findBookingNotificationContextByIdOrThrow(
    id: string,
  ): Promise<BookingNotificationContext> {
    return this.findByIdOrThrow<BookingNotificationContext>(
      this.prisma.amenityBooking,
      id,
      'AmenityBooking',
      this.bookingNotificationInclude,
    );
  }

  getMyBookings(userId: string, dto: DateRangeDTO) {
    return this.paginateByUserIdWithDateRange<BookingWithAmenity>(
      this.prisma.amenityBooking,
      userId,
      getGymDateRangeFilter(dto, 'starts_at'),
      {
        include: this.bookingWithAmenityInclude,
        orderBy: { starts_at: 'desc' },
      },
      { page: dto.page, limit: dto.limit },
    );
  }

  getAllBookings(dto: DateRangeDTO) {
    return this.paginateWithDateRange<AdminBookingListItem>(
      this.prisma.amenityBooking,
      {},
      getGymDateRangeFilter(dto, 'starts_at'),
      {
        include: this.adminBookingInclude,
        orderBy: { starts_at: 'desc' },
      },
      { page: dto.page, limit: dto.limit },
    );
  }

  async getCoachVenueWork(
    coachUserId: string,
    dto: DateRangeDTO,
  ): Promise<PaginatedResult<CoachVenueWorkRecord>> {
    const startsAt: Prisma.DateTimeFilter = {};
    if (dto.start_date) {
      startsAt.gte = normalizeGymDateBoundary(dto.start_date, 'start');
    }
    if (dto.end_date) {
      startsAt.lte = normalizeGymDateBoundary(dto.end_date, 'end');
    }

    const candidates = await this.prisma.amenityBooking.findMany({
      where: {
        coach: { is: { user_id: coachUserId } },
        status: {
          in: [
            BookingStatus.confirmed,
            BookingStatus.completed,
            BookingStatus.cancelled,
            BookingStatus.no_show,
          ],
        },
        total_amount: { gt: 0 },
        ...(Object.keys(startsAt).length ? { starts_at: startsAt } : {}),
      },
      include: this.adminBookingInclude,
      orderBy: [{ starts_at: 'desc' }, { created_at: 'desc' }],
    });
    const candidateIds = candidates.map((booking) => booking.id);
    if (candidateIds.length === 0) {
      return {
        data: [],
        meta: {
          page: Math.max(1, dto.page ?? 1),
          limit: Math.min(100, Math.max(1, dto.limit ?? 20)),
          total: 0,
          total_pages: 0,
        },
      };
    }

    const [directPayments, checkoutHolds] = await Promise.all([
      this.prisma.payment.findMany({
        where: {
          payable_id: { in: candidateIds },
          payable_type: PayableType.booking,
          payment_stage: PaymentStage.full,
          status: PaymentStatus.completed,
        },
        select: { payable_id: true },
      }),
      this.prisma.commerceCheckoutHold.findMany({
        where: {
          booking_id: { in: candidateIds },
          kind: 'venue',
          status: CommerceCheckoutHoldStatus.consumed,
          payment: {
            is: {
              payable_type: PayableType.commerce_checkout_hold,
              payment_stage: PaymentStage.full,
              status: PaymentStatus.completed,
            },
          },
        },
        select: { booking_id: true },
      }),
    ]);
    const paidIds = new Set([
      ...directPayments.map((payment) => payment.payable_id),
      ...checkoutHolds.flatMap((hold) =>
        hold.booking_id ? [hold.booking_id] : [],
      ),
    ]);
    const records = candidates.filter((booking) => paidIds.has(booking.id));
    const page = Math.max(1, dto.page ?? 1);
    const limit = Math.min(100, Math.max(1, dto.limit ?? 20));
    const skip = (page - 1) * limit;

    return {
      data: records.slice(skip, skip + limit),
      meta: {
        page,
        limit,
        total: records.length,
        total_pages: Math.ceil(records.length / limit),
      },
    };
  }

  async isFullyPaidCoachVenueWork(
    bookingId: string,
    coachUserId: string,
  ): Promise<boolean> {
    const booking = await this.prisma.amenityBooking.findFirst({
      where: {
        id: bookingId,
        coach: { is: { user_id: coachUserId } },
        total_amount: { gt: 0 },
      },
      select: { id: true },
    });
    if (!booking) {
      return false;
    }

    const [directPaymentCount, checkoutHoldCount] = await Promise.all([
      this.prisma.payment.count({
        where: {
          payable_id: bookingId,
          payable_type: PayableType.booking,
          payment_stage: PaymentStage.full,
          status: PaymentStatus.completed,
        },
      }),
      this.prisma.commerceCheckoutHold.count({
        where: {
          booking_id: bookingId,
          kind: 'venue',
          status: CommerceCheckoutHoldStatus.consumed,
          payment: {
            is: {
              payable_type: PayableType.commerce_checkout_hold,
              payment_stage: PaymentStage.full,
              status: PaymentStatus.completed,
            },
          },
        },
      }),
    ]);

    return directPaymentCount + checkoutHoldCount > 0;
  }

  async createConfirmedFreeBooking(input: {
    userId: string;
    amenityId: string;
    coachId?: string;
    startsAt: Date;
    endsAt: Date;
    notes?: string;
    totalAmount: Prisma.Decimal;
    downpaymentAmount: Prisma.Decimal;
    balanceAmount: Prisma.Decimal;
  }): Promise<AmenityBooking> {
    return this.transaction(async (tx) => {
      if (input.coachId) {
        await lockAndAssertVenueCoachWindow(tx, {
          coachId: input.coachId,
          endsAt: input.endsAt,
          startsAt: input.startsAt,
        });
      }
      await this.assertCapacityAvailable(
        tx,
        input.amenityId,
        input.startsAt,
        input.endsAt,
      );

      return tx.amenityBooking.create({
        data: {
          user: { connect: { id: input.userId } },
          amenity: { connect: { id: input.amenityId } },
          ...(input.coachId
            ? { coach: { connect: { id: input.coachId } } }
            : {}),
          status: BookingStatus.confirmed,
          starts_at: input.startsAt,
          ends_at: input.endsAt,
          total_amount: input.totalAmount,
          downpayment_amount: input.downpaymentAmount,
          balance_amount: input.balanceAmount,
          downpayment_paid_at: new Date(),
          notes: input.notes ?? null,
        },
      });
    });
  }

  async createConfirmedManualBooking(input: {
    userId: string;
    amenityId: string;
    coachId?: string;
    startsAt: Date;
    endsAt: Date;
    notes?: string;
    totalAmount: Prisma.Decimal;
    downpaymentAmount: Prisma.Decimal;
    balanceAmount: Prisma.Decimal;
    idempotencyKey: string;
    paymentAmount: Prisma.Decimal;
    paymentStage: InitialBookingPaymentStage;
    verifiedBy: string;
  }): Promise<AmenityBooking> {
    return this.transaction(async (tx) => {
      const existingPayment = await tx.payment.findUnique({
        where: { idempotency_key: input.idempotencyKey },
        select: { payable_id: true, payable_type: true },
      });
      if (existingPayment) {
        if (existingPayment.payable_type !== 'booking') {
          throw new ConflictException({
            type: 'CONFLICT',
            title: 'Idempotency Key Already Used',
            status: 409,
            detail:
              'The idempotency key is already associated with another payment.',
          });
        }
        return tx.amenityBooking.findUniqueOrThrow({
          where: { id: existingPayment.payable_id },
        });
      }

      if (input.paymentStage !== PaymentStage.full) {
        throw new ConflictException({
          type: 'CONFLICT',
          title: 'Full Payment Required',
          status: 409,
          detail: 'Manual venue bookings must be recorded as fully paid.',
        });
      }
      if (input.coachId) {
        await lockAndAssertVenueCoachWindow(tx, {
          coachId: input.coachId,
          endsAt: input.endsAt,
          startsAt: input.startsAt,
        });
      }
      await this.assertCapacityAvailable(
        tx,
        input.amenityId,
        input.startsAt,
        input.endsAt,
      );

      const paidAt = new Date();
      const booking = await tx.amenityBooking.create({
        data: {
          user: { connect: { id: input.userId } },
          amenity: { connect: { id: input.amenityId } },
          ...(input.coachId
            ? { coach: { connect: { id: input.coachId } } }
            : {}),
          status: BookingStatus.confirmed,
          starts_at: input.startsAt,
          ends_at: input.endsAt,
          total_amount: input.totalAmount,
          downpayment_amount: new Prisma.Decimal(0),
          balance_amount: new Prisma.Decimal(0),
          downpayment_paid_at: paidAt,
          balance_paid_at: paidAt,
          notes: input.notes ?? null,
        },
      });

      await tx.payment.create({
        data: {
          user: { connect: { id: input.userId } },
          verifier: { connect: { id: input.verifiedBy } },
          payable_type: 'booking',
          payable_id: booking.id,
          payment_stage: PaymentStage.full,
          amount: input.totalAmount,
          provider: PaymentProvider.cash,
          idempotency_key: input.idempotencyKey,
          status: PaymentStatus.completed,
          verified_at: paidAt,
        },
      });

      return booking;
    });
  }

  async createPendingBookingWithPayment(input: {
    userId: string;
    amenityId: string;
    coachId?: string;
    startsAt: Date;
    endsAt: Date;
    notes?: string;
    totalAmount: Prisma.Decimal;
    downpaymentAmount: Prisma.Decimal;
    balanceAmount: Prisma.Decimal;
    idempotencyKey: string;
    paymentAmount: Prisma.Decimal;
    paymentStage: InitialBookingPaymentStage;
    paymentStatus: PendingBookingPaymentStatus;
    provider: PaymentProvider;
  }): Promise<BookingPaymentInitiationRecord> {
    return this.transaction(async (tx) => {
      if (input.coachId) {
        await lockAndAssertVenueCoachWindow(tx, {
          coachId: input.coachId,
          endsAt: input.endsAt,
          startsAt: input.startsAt,
        });
      }
      await this.assertCapacityAvailable(
        tx,
        input.amenityId,
        input.startsAt,
        input.endsAt,
      );

      const booking = await tx.amenityBooking.create({
        data: {
          user: { connect: { id: input.userId } },
          amenity: { connect: { id: input.amenityId } },
          ...(input.coachId
            ? { coach: { connect: { id: input.coachId } } }
            : {}),
          status: BookingStatus.pending,
          starts_at: input.startsAt,
          ends_at: input.endsAt,
          total_amount: input.totalAmount,
          downpayment_amount: input.downpaymentAmount,
          balance_amount: input.balanceAmount,
          notes: input.notes ?? null,
        },
      });

      const payment = await tx.payment.create({
        data: {
          user: { connect: { id: input.userId } },
          payable_type: 'booking',
          payable_id: booking.id,
          payment_stage: input.paymentStage,
          amount: input.paymentAmount,
          provider: input.provider,
          idempotency_key: input.idempotencyKey,
          status: input.paymentStatus,
        },
      });

      return { booking, payment };
    });
  }

  confirmBookingDownpayment(
    bookingId: string,
    confirmedAt: Date,
  ): Promise<AmenityBooking> {
    return this.updateById<AmenityBooking>(
      this.prisma.amenityBooking,
      bookingId,
      {
        status: BookingStatus.balance_pending,
        downpayment_paid_at: confirmedAt,
      },
    );
  }

  confirmBookingFullPayment(
    bookingId: string,
    confirmedAt: Date,
  ): Promise<AmenityBooking> {
    return this.updateById<AmenityBooking>(
      this.prisma.amenityBooking,
      bookingId,
      {
        status: BookingStatus.confirmed,
        downpayment_paid_at: confirmedAt,
        balance_paid_at: confirmedAt,
      },
    );
  }

  async createBalancePendingPayment(input: {
    bookingId: string;
    idempotencyKey: string;
    provider: PaymentProvider;
    referenceNo?: string;
    screenshotUrl?: string;
    userId: string;
    amount: Prisma.Decimal;
  }): Promise<BookingPaymentInitiationRecord> {
    return this.transaction(async (tx) => {
      const booking = await tx.amenityBooking.update({
        where: { id: input.bookingId },
        data: { status: BookingStatus.balance_pending },
      });

      const payment = await tx.payment.create({
        data: {
          user: { connect: { id: input.userId } },
          payable_type: 'booking',
          payable_id: input.bookingId,
          payment_stage: 'balance',
          amount: input.amount,
          provider: input.provider,
          provider_ref:
            input.provider === PaymentProvider.cash
              ? input.referenceNo
              : undefined,
          screenshot_url:
            input.provider === PaymentProvider.cash
              ? input.screenshotUrl
              : undefined,
          idempotency_key: input.idempotencyKey,
          status:
            input.provider === PaymentProvider.cash
              ? PaymentStatus.awaiting_verification
              : PaymentStatus.pending,
        },
      });

      return { booking, payment };
    });
  }

  completeBookingBalance(
    bookingId: string,
    paidAt: Date,
  ): Promise<AmenityBooking> {
    return this.updateById<AmenityBooking>(
      this.prisma.amenityBooking,
      bookingId,
      {
        status: BookingStatus.confirmed,
        balance_paid_at: paidAt,
      },
    );
  }

  markBookingCompleted(
    bookingId: string,
    completedAt: Date,
  ): Promise<AmenityBooking> {
    return this.updateById<AmenityBooking>(
      this.prisma.amenityBooking,
      bookingId,
      {
        status: BookingStatus.completed,
        completed_at: completedAt,
      },
    );
  }

  findStalePendingBookings(cutoff: Date): Promise<StalePendingBooking[]> {
    return this.findAll<StalePendingBooking>(
      this.prisma.amenityBooking,
      {
        status: BookingStatus.pending,
        created_at: { lt: cutoff },
      },
      undefined,
      { created_at: 'asc' },
      {
        id: true,
        user_id: true,
        amenity_id: true,
      },
    );
  }

  async cancelPendingBookingIfStale(
    bookingId: string,
    cutoff: Date,
    cancelledAt: Date,
  ): Promise<boolean> {
    const result = await this.prisma.amenityBooking.updateMany({
      where: {
        id: bookingId,
        status: BookingStatus.pending,
        created_at: { lt: cutoff },
      },
      data: {
        status: BookingStatus.cancelled,
        cancelled_at: cancelledAt,
      },
    });

    return result.count > 0;
  }

  async markBookingNoShowIfEligible(
    bookingId: string,
    eligibleStartsAt: Date,
  ): Promise<boolean> {
    const result = await this.prisma.amenityBooking.updateMany({
      where: {
        id: bookingId,
        status: BookingStatus.confirmed,
        starts_at: { lte: eligibleStartsAt },
      },
      data: {
        status: BookingStatus.no_show,
      },
    });

    return result.count > 0;
  }

  async markConfirmedBookingNoShow(
    bookingId: string,
    noShowAt: Date,
  ): Promise<boolean> {
    const result = await this.prisma.amenityBooking.updateMany({
      where: {
        id: bookingId,
        status: BookingStatus.confirmed,
        starts_at: { lte: noShowAt },
      },
      data: {
        status: BookingStatus.no_show,
      },
    });

    return result.count > 0;
  }

  async completePastFreeBookings(now: Date): Promise<number> {
    const result = await this.prisma.amenityBooking.updateMany({
      where: {
        status: BookingStatus.confirmed,
        balance_amount: new Prisma.Decimal('0'),
        ends_at: { lte: now },
      },
      data: {
        status: BookingStatus.completed,
        completed_at: now,
      },
    });

    return result.count;
  }

  cancelBooking(bookingId: string, cancelledAt: Date): Promise<AmenityBooking> {
    return this.updateById<AmenityBooking>(
      this.prisma.amenityBooking,
      bookingId,
      {
        status: BookingStatus.cancelled,
        cancelled_at: cancelledAt,
      },
    );
  }

  rescheduleBookingForMaintenance(input: {
    actorUserId: string;
    amenityId: string;
    bookingId: string;
    endsAt: Date;
    note?: string;
    startsAt: Date;
  }): Promise<MaintenanceBookingResolutionResult> {
    return this.transaction(async (tx) => {
      const existing = await tx.amenityBooking.findUniqueOrThrow({
        where: { id: input.bookingId },
        include: { amenity: true },
      });
      if (
        !ACTIVE_CAPACITY_BOOKING_STATUSES.includes(
          existing.status as (typeof ACTIVE_CAPACITY_BOOKING_STATUSES)[number],
        )
      ) {
        throw new ConflictException({
          type: 'CONFLICT',
          title: 'Booking Cannot Be Rescheduled',
          status: 409,
          detail: 'Only an active venue booking can be rescheduled.',
        });
      }
      if (existing.amenity.status !== EquipmentStatus.maintenance) {
        throw new ConflictException({
          type: 'CONFLICT',
          title: 'Maintenance Resolution Not Required',
          status: 409,
          detail: 'The current venue is no longer under maintenance.',
        });
      }

      const lockKey = `venue-reschedule:${input.amenityId}:${input.startsAt.toISOString().slice(0, 10)}`;
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))`;
      if (existing.coach_id) {
        await lockAndAssertVenueCoachWindow(tx, {
          coachId: existing.coach_id,
          endsAt: input.endsAt,
          excludeAmenityBookingIds: [existing.id],
          startsAt: input.startsAt,
        });
      }
      await this.assertCapacityAvailable(
        tx,
        input.amenityId,
        input.startsAt,
        input.endsAt,
        existing.id,
      );

      const targetAmenity = await tx.amenity.findUniqueOrThrow({
        where: { id: input.amenityId },
        select: { hourly_rate: true, name: true },
      });
      const booking = await tx.amenityBooking.update({
        where: { id: existing.id },
        data: {
          amenity_id: input.amenityId,
          ends_at: input.endsAt,
          starts_at: input.startsAt,
        },
      });
      await tx.auditLog.create({
        data: {
          user_id: input.actorUserId,
          action: 'BOOKING_RESCHEDULED',
          entity: 'AmenityBooking',
          entity_id: existing.id,
          before: {
            amenity_id: existing.amenity_id,
            amenity_name: existing.amenity.name,
            ends_at: existing.ends_at.toISOString(),
            starts_at: existing.starts_at.toISOString(),
          },
          after: {
            amenity_id: input.amenityId,
            amenity_name: targetAmenity.name,
            ends_at: input.endsAt.toISOString(),
            note: input.note ?? null,
            payment_preserved: true,
            starts_at: input.startsAt.toISOString(),
            target_hourly_rate: targetAmenity.hourly_rate.toString(),
            total_amount_preserved: existing.total_amount.toString(),
          },
        },
      });

      return {
        booking,
        previousAmenityId: existing.amenity_id,
        previousEndsAt: existing.ends_at,
        previousStartsAt: existing.starts_at,
      };
    });
  }

  cancelBookingForMaintenance(input: {
    actorUserId: string;
    bookingId: string;
    cancelledAt: Date;
    note?: string;
  }): Promise<AmenityBooking> {
    return this.transaction(async (tx) => {
      const existing = await tx.amenityBooking.findUniqueOrThrow({
        where: { id: input.bookingId },
        include: { amenity: true },
      });
      if (
        !ACTIVE_CAPACITY_BOOKING_STATUSES.includes(
          existing.status as (typeof ACTIVE_CAPACITY_BOOKING_STATUSES)[number],
        )
      ) {
        throw new ConflictException({
          type: 'CONFLICT',
          title: 'Booking Cannot Be Cancelled',
          status: 409,
          detail:
            'Only an active venue booking can be cancelled for maintenance.',
        });
      }
      if (existing.amenity.status !== EquipmentStatus.maintenance) {
        throw new ConflictException({
          type: 'CONFLICT',
          title: 'Maintenance Resolution Not Required',
          status: 409,
          detail: 'The booked venue is no longer under maintenance.',
        });
      }

      const booking = await tx.amenityBooking.update({
        where: { id: existing.id },
        data: {
          cancellation_reason: 'VENUE_MAINTENANCE',
          cancelled_at: input.cancelledAt,
          status: BookingStatus.cancelled,
        },
      });
      await tx.auditLog.create({
        data: {
          user_id: input.actorUserId,
          action: 'BOOKING_CANCELLED_MAINTENANCE',
          entity: 'AmenityBooking',
          entity_id: existing.id,
          before: {
            cancellation_reason: existing.cancellation_reason,
            cancelled_at: existing.cancelled_at?.toISOString() ?? null,
            status: existing.status,
          },
          after: {
            cancellation_reason: 'VENUE_MAINTENANCE',
            cancelled_at: input.cancelledAt.toISOString(),
            note: input.note ?? null,
            payment_preserved: true,
            refund: 'none',
            status: BookingStatus.cancelled,
          },
        },
      });
      return booking;
    });
  }

  private async assertCapacityAvailable(
    tx: Prisma.TransactionClient,
    amenityId: string,
    startsAt: Date,
    endsAt: Date,
    excludeBookingId?: string,
  ): Promise<void> {
    const overlappingCount = await tx.amenityBooking.count({
      where: {
        amenity_id: amenityId,
        status: { in: [...ACTIVE_CAPACITY_BOOKING_STATUSES] },
        starts_at: { lt: endsAt },
        ends_at: { gt: startsAt },
      },
    });

    const overlappingHolds = await tx.commerceCheckoutHold.count({
      where: {
        amenity_id: amenityId,
        ...(excludeBookingId ? { id: { not: excludeBookingId } } : {}),
        ends_at: { gt: startsAt },
        expires_at: { gt: new Date() },
        scheduled_at: { lt: endsAt },
        status: CommerceCheckoutHoldStatus.held,
      },
    });

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
      throw this.buildVenueUnavailableConflict(
        'The requested venue no longer exists.',
      );
    }
    const blockReason = getAmenityBookingBlockReason(amenity);
    if (blockReason) {
      throw this.buildVenueUnavailableConflict(blockReason);
    }

    if (overlappingCount + overlappingHolds >= amenity.capacity) {
      throw this.buildBookingConflict();
    }
  }

  private buildBookingConflict(): ConflictException {
    return new ConflictException({
      type: 'CONFLICT',
      title: 'Booking Conflict',
      status: 409,
      detail: 'The requested booking slot is no longer available.',
    });
  }

  private buildVenueUnavailableConflict(detail: string): ConflictException {
    return new ConflictException({
      type: 'CONFLICT',
      title: 'Venue Not Reservable',
      status: 409,
      detail,
    });
  }
}

function getGymDateRangeFilter(
  dto: DateRangeDTO,
  dateField: string,
): { start_date?: string; end_date?: string; dateField: string } {
  return {
    start_date: dto.start_date
      ? normalizeGymDateBoundary(dto.start_date, 'start').toISOString()
      : undefined,
    end_date: dto.end_date
      ? normalizeGymDateBoundary(dto.end_date, 'end').toISOString()
      : undefined,
    dateField,
  };
}

function normalizeGymDateBoundary(
  value: string,
  boundary: 'start' | 'end',
): Date {
  if (!DATE_ONLY_PATTERN.test(value)) {
    return new Date(value);
  }

  const [year, month, day] = value.split('-').map(Number);
  const gymDayStartUtc = new Date(
    Date.UTC(year, month - 1, day) - GYM_TIMEZONE_OFFSET_MINUTES * 60 * 1000,
  );

  if (boundary === 'start') {
    return gymDayStartUtc;
  }

  return new Date(gymDayStartUtc.getTime() + 24 * 60 * 60 * 1000 - 1);
}
