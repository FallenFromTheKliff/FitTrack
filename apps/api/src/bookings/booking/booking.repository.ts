import { ConflictException, Injectable } from '@nestjs/common';
import {
  AmenityBooking,
  BookingStatus,
  Payment,
  PaymentProvider,
  PaymentStatus,
  Prisma,
} from '@prisma/client';

import { BaseRepository } from '../../common/base-repository/base-repository';
import { PrismaService } from '../../prisma/prisma.service';
import { DateRangeDTO } from '../../user/dto/user-dto';

export const ACTIVE_CAPACITY_BOOKING_STATUSES = [
  BookingStatus.pending,
  BookingStatus.confirmed,
  BookingStatus.balance_pending,
] as const;

type BookingWithAmenity = Prisma.AmenityBookingGetPayload<{
  include: { amenity: true };
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

type BookingPaymentInitiationRecord = {
  booking: AmenityBooking;
  payment: Payment;
};

type StalePendingBooking = Pick<
  AmenityBooking,
  'amenity_id' | 'id' | 'user_id'
>;

@Injectable()
export class BookingRepository extends BaseRepository {
  constructor(prisma: PrismaService) {
    super(prisma);
  }

  private readonly bookingWithAmenityInclude = {
    amenity: true,
  } as const;

  private readonly adminBookingInclude = {
    amenity: true,
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
      {
        start_date: dto.start_date,
        end_date: dto.end_date,
        dateField: 'starts_at',
      },
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
      {
        start_date: dto.start_date,
        end_date: dto.end_date,
        dateField: 'starts_at',
      },
      {
        include: this.adminBookingInclude,
        orderBy: { starts_at: 'desc' },
      },
      { page: dto.page, limit: dto.limit },
    );
  }

  async createConfirmedFreeBooking(input: {
    userId: string;
    amenityId: string;
    startsAt: Date;
    endsAt: Date;
    notes?: string;
    totalAmount: Prisma.Decimal;
    downpaymentAmount: Prisma.Decimal;
    balanceAmount: Prisma.Decimal;
  }): Promise<AmenityBooking> {
    return this.transaction(async (tx) => {
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

  async createPendingBookingWithPayment(input: {
    userId: string;
    amenityId: string;
    startsAt: Date;
    endsAt: Date;
    notes?: string;
    totalAmount: Prisma.Decimal;
    downpaymentAmount: Prisma.Decimal;
    balanceAmount: Prisma.Decimal;
    idempotencyKey: string;
    provider: 'paymongo';
  }): Promise<BookingPaymentInitiationRecord> {
    return this.transaction(async (tx) => {
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
          payment_stage: 'downpayment',
          amount: input.downpaymentAmount,
          provider: input.provider,
          idempotency_key: input.idempotencyKey,
          status: 'pending',
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
        status: BookingStatus.confirmed,
        downpayment_paid_at: confirmedAt,
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
        status: BookingStatus.completed,
        balance_paid_at: paidAt,
        completed_at: paidAt,
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

  private async assertCapacityAvailable(
    tx: Prisma.TransactionClient,
    amenityId: string,
    startsAt: Date,
    endsAt: Date,
  ): Promise<void> {
    const overlappingCount = await tx.amenityBooking.count({
      where: {
        amenity_id: amenityId,
        status: { in: [...ACTIVE_CAPACITY_BOOKING_STATUSES] },
        starts_at: { lt: endsAt },
        ends_at: { gt: startsAt },
      },
    });

    const amenity = await tx.amenity.findUnique({
      where: { id: amenityId },
      select: { capacity: true, is_active: true },
    });

    if (!amenity || !amenity.is_active) {
      throw this.buildBookingConflict();
    }

    if (overlappingCount >= amenity.capacity) {
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
}
