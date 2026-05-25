import { InjectRedis } from '@nestjs-modules/ioredis';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import {
  Amenity,
  AmenityBooking,
  BookingStatus,
  PayableType,
  Payment,
  PaymentProvider,
  PaymentStage,
  PaymentStatus,
  Prisma,
} from '@prisma/client';
import { randomUUID } from 'crypto';
import { isUUID } from 'class-validator';
import Redis from 'ioredis';

import { AuditAction, AuditEvent } from '../../audit/audit.service';
import { CoachService } from '../../coaching/coach/coach.service';
import { PaymentRepository } from '../../membership/payment/payment.repository';
import { PAYMENT_COMPLETED_EVENT } from '../../membership/payment/events/payment-completed.event';
import type { PaymentCompletedEvent } from '../../membership/payment/events/payment-completed.event';
import {
  PaymongoCheckoutResult,
  PaymongoCheckoutService,
} from '../../membership/payment/paymongo-checkout.service';
import { MembershipCardService } from '../../membership/card/card.service';
import { SubscriptionService } from '../../membership/subscription/subscription.service';
import {
  CreateStaffInitialPaymentStage,
  CreateStaffVenueBookingDTO,
} from '../../staff/dto/staff-schedule.dto';
import { DateRangeDTO } from '../../user/dto/user-dto';
import { AmenityRepository } from '../amenity/amenity.repository';
import { BookingRepository } from './booking.repository';
import {
  AvailabilityQueryDTO,
  AvailabilitySlotDTO,
} from './dto/availability.dto';
import {
  BookingCheckoutResponseDTO,
  CreateBookingPaymentStage,
  CreateBookingDTO,
  ProcessBalanceDTO,
} from './dto/create-booking.dto';
import {
  BOOKING_CANCELLED_EVENT,
  BookingCancelledEvent,
} from './events/booking-cancelled.event';
import {
  BOOKING_CONFIRMED_EVENT,
  BookingConfirmedEvent,
} from './events/booking-confirmed.event';

const SLOT_INTERVAL_MINUTES = 30;
const SLOT_INTERVAL_MS = SLOT_INTERVAL_MINUTES * 60 * 1000;
const SLOTS_PER_DAY = (24 * 60) / SLOT_INTERVAL_MINUTES;
const BOOKING_LOCK_TTL_SECONDS = 10;
const DOWNPAYMENT_RATE = new Prisma.Decimal('0.30');
const GYM_TIMEZONE_OFFSET_MINUTES = 8 * 60;

type BookingWindow = Pick<AmenityBooking, 'starts_at' | 'ends_at'>;
type BookingAmounts = {
  balanceAmount: Prisma.Decimal;
  downpaymentAmount: Prisma.Decimal;
  paymentAmount: Prisma.Decimal;
  paymentStage: InitialBookingPaymentStage;
  totalAmount: Prisma.Decimal;
};
type BookingSchedule = {
  durationMinutes: number;
  endsAt: Date;
  startsAt: Date;
};
type InitialBookingPaymentStage = Extract<
  PaymentStage,
  typeof PaymentStage.downpayment | typeof PaymentStage.full
>;

@Injectable()
export class BookingService {
  constructor(
    private readonly bookingRepository: BookingRepository,
    private readonly amenityRepository: AmenityRepository,
    private readonly paymentRepository: PaymentRepository,
    private readonly paymongoCheckoutService: PaymongoCheckoutService,
    private readonly membershipCardService: MembershipCardService,
    private readonly subscriptionService: SubscriptionService,
    private readonly coachService: CoachService,
    private readonly eventEmitter: EventEmitter2,
    @InjectRedis() private readonly redis: Redis,
  ) {}

  async getAvailability(
    dto: AvailabilityQueryDTO,
  ): Promise<AvailabilitySlotDTO[]> {
    const { dayStart, dayEnd } = parseAvailabilityRange(dto.date);
    const amenity = await this.amenityRepository.findActiveAmenityByIdOrThrow(
      dto.amenity_id,
    );
    this.assertAmenityReservable(amenity);
    const bookings = await this.bookingRepository.listActiveOverlappingBookings(
      dto.amenity_id,
      dayStart,
      dayEnd,
    );

    return buildAvailabilitySlots(dayStart, amenity.capacity, bookings);
  }

  getMyBookings(userId: string, dto: DateRangeDTO) {
    return this.bookingRepository.getMyBookings(userId, dto);
  }

  getAllBookings(dto: DateRangeDTO) {
    return this.bookingRepository.getAllBookings(dto);
  }

  async confirmPendingBooking(
    bookingId: string,
    actorUserId: string,
  ): Promise<{ booking: AmenityBooking; message: string }> {
    const booking =
      await this.bookingRepository.findBookingWithAmenityByIdOrThrow(bookingId);

    if (booking.status !== BookingStatus.pending) {
      throw new HttpException(
        {
          type: 'BUSINESS_RULE_VIOLATION',
          title: 'Booking Cannot Be Confirmed',
          status: 422,
          detail: 'Only pending bookings can be confirmed.',
        },
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }

    const confirmedAt = new Date();
    const paymentStage = booking.balance_amount.equals(0)
      ? PaymentStage.full
      : PaymentStage.downpayment;
    const payment =
      await this.paymentRepository.findLatestPaymentForPayableStage(
        PayableType.booking,
        booking.id,
        paymentStage,
      );

    if (!booking.total_amount.equals(0) && !payment) {
      throw new HttpException(
        {
          type: 'BUSINESS_RULE_VIOLATION',
          title: 'Booking Payment Missing',
          status: 422,
          detail:
            'This booking cannot be confirmed because its payment record is missing.',
        },
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }

    const confirmedBooking =
      paymentStage === PaymentStage.full
        ? await this.bookingRepository.confirmBookingFullPayment(
            bookingId,
            confirmedAt,
          )
        : await this.bookingRepository.confirmBookingDownpayment(
            bookingId,
            confirmedAt,
          );

    if (payment && payment.status !== PaymentStatus.completed) {
      const completedPayment = await this.paymentRepository.updatePayment(
        payment.id,
        {
          rejection_reason: null,
          status: PaymentStatus.completed,
          verified_at: confirmedAt,
          verifier: { connect: { id: actorUserId } },
        },
      );

      this.emitPaymentCompleted({
        amount: completedPayment.amount.toString(),
        payableId: booking.id,
        payableType: PayableType.booking,
        paymentId: completedPayment.id,
        userId: booking.user_id,
        verifiedBy: actorUserId,
      });
    }

    if (paymentStage === PaymentStage.full) {
      this.emitBookingConfirmed({
        bookingId: confirmedBooking.id,
        userId: booking.user_id,
        amenityId: booking.amenity_id,
        startsAt: booking.starts_at.toISOString(),
        endsAt: booking.ends_at.toISOString(),
      });
    }
    this.emitAudit({
      userId: actorUserId,
      action: AuditAction.BOOKING_CONFIRMED,
      entity: 'AmenityBooking',
      entityId: bookingId,
      before: {
        status: booking.status,
        downpayment_paid_at: booking.downpayment_paid_at?.toISOString() ?? null,
      } as Prisma.InputJsonValue,
      after: {
        status: confirmedBooking.status,
        downpayment_paid_at: confirmedAt.toISOString(),
      } as Prisma.InputJsonValue,
    });

    return {
      booking: confirmedBooking,
      message:
        paymentStage === PaymentStage.full
          ? 'Booking confirmed successfully'
          : 'Booking downpayment accepted. Balance remains pending.',
    };
  }

  async rejectPendingBooking(
    bookingId: string,
    actorUserId: string,
    reason?: string,
  ): Promise<{ booking: AmenityBooking; message: string }> {
    const booking =
      await this.bookingRepository.findBookingWithAmenityByIdOrThrow(bookingId);

    if (booking.status !== BookingStatus.pending) {
      throw new HttpException(
        {
          type: 'BUSINESS_RULE_VIOLATION',
          title: 'Booking Cannot Be Rejected',
          status: 422,
          detail: 'Only pending bookings can be rejected.',
        },
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }

    const cancelledAt = new Date();
    const cancelledBooking = await this.bookingRepository.cancelBooking(
      bookingId,
      cancelledAt,
    );

    this.emitAudit({
      userId: actorUserId,
      action: AuditAction.BOOKING_CANCELLED,
      entity: 'AmenityBooking',
      entityId: bookingId,
      before: {
        status: booking.status,
        cancelled_at: booking.cancelled_at?.toISOString() ?? null,
        reason: null,
      } as Prisma.InputJsonValue,
      after: {
        status: BookingStatus.cancelled,
        cancelled_at: cancelledAt.toISOString(),
        reason: reason?.trim() || null,
      } as Prisma.InputJsonValue,
    });
    this.emitBookingCancelled({
      bookingId,
      userId: booking.user_id,
      amenityId: booking.amenity_id,
      cancelledAt: cancelledAt.toISOString(),
    });

    return {
      booking: cancelledBooking,
      message: 'Booking rejected successfully',
    };
  }

  async createBooking(
    userId: string,
    dto: CreateBookingDTO,
    idempotencyKey: string | undefined,
  ): Promise<BookingCheckoutResponseDTO> {
    const normalizedIdempotencyKey =
      this.normalizeAndValidateIdempotencyKey(idempotencyKey);
    const existingPayment =
      await this.paymentRepository.findPaymentByIdempotencyKey(
        normalizedIdempotencyKey,
      );
    const paymentStage = this.resolveInitialProviderPaymentStage(
      dto.provider,
      resolveBookingPaymentStage(dto.payment_stage),
    );

    if (existingPayment) {
      return this.resumeExistingCheckout(
        existingPayment,
        userId,
        dto.provider,
        paymentStage,
      );
    }

    const schedule = parseBookingSchedule(dto);
    const amenity = await this.amenityRepository.findActiveAmenityByIdOrThrow(
      dto.amenity_id,
    );
    this.assertAmenityReservable(amenity);

    const linkedCoach = dto.coach_id
      ? await this.coachService.assertCoachReservableForBookingWindow(
          dto.coach_id,
          schedule.startsAt,
          schedule.endsAt,
        )
      : null;

    if (amenity.requires_subscription) {
      const [hasSubscriptionAccess, hasMembershipCardAccess] =
        await Promise.all([
          this.subscriptionService.hasSubscriptionAccess(userId),
          this.membershipCardService.hasActiveMembershipCardAccess(userId),
        ]);

      if (!hasSubscriptionAccess && !hasMembershipCardAccess) {
        throw new ForbiddenException({
          type: 'FORBIDDEN',
          title: 'Membership Required',
          status: 403,
          detail: 'An active membership card is required to book this amenity.',
        });
      }
    }

    const amounts = calculateBookingAmounts(
      amenity,
      schedule.durationMinutes,
      paymentStage,
      linkedCoach,
    );

    const slotKeys = buildSlotKeys(
      dto.amenity_id,
      schedule.startsAt,
      schedule.endsAt,
    );
    await this.acquireSlotLocks(slotKeys);

    try {
      if (amounts.totalAmount.equals(0)) {
        const booking = await this.bookingRepository.createConfirmedFreeBooking(
          {
            userId,
            amenityId: dto.amenity_id,
            coachId: dto.coach_id,
            startsAt: schedule.startsAt,
            endsAt: schedule.endsAt,
            notes: dto.notes,
            totalAmount: amounts.totalAmount,
            downpaymentAmount: amounts.downpaymentAmount,
            balanceAmount: amounts.balanceAmount,
          },
        );

        this.emitBookingConfirmed({
          bookingId: booking.id,
          userId,
          amenityId: dto.amenity_id,
          startsAt: schedule.startsAt.toISOString(),
          endsAt: schedule.endsAt.toISOString(),
        });

        return {
          booking_id: booking.id,
          status: booking.status,
          checkout_url: null,
        };
      }

      try {
        const initiation =
          await this.bookingRepository.createPendingBookingWithPayment({
            userId,
            amenityId: dto.amenity_id,
            coachId: dto.coach_id,
            startsAt: schedule.startsAt,
            endsAt: schedule.endsAt,
            notes: dto.notes,
            totalAmount: amounts.totalAmount,
            downpaymentAmount: amounts.downpaymentAmount,
            balanceAmount: amounts.balanceAmount,
            idempotencyKey: normalizedIdempotencyKey,
            paymentAmount: amounts.paymentAmount,
            paymentStage: amounts.paymentStage,
            paymentStatus:
              dto.provider === PaymentProvider.cash
                ? PaymentStatus.awaiting_verification
                : PaymentStatus.pending,
            provider: dto.provider,
          });

        if (dto.provider === PaymentProvider.cash) {
          return {
            booking_id: initiation.booking.id,
            status: initiation.booking.status,
            checkout_url: null,
            payment_id: initiation.payment.id,
          };
        }

        return this.startCheckoutForPayment(
          initiation.payment,
          initiation.booking.id,
          amenity.name,
        );
      } catch (error) {
        const resumedPayment =
          await this.paymentRepository.findPaymentByIdempotencyKey(
            normalizedIdempotencyKey,
          );

        if (resumedPayment) {
          return this.resumeExistingCheckout(
            resumedPayment,
            userId,
            dto.provider,
            paymentStage,
          );
        }

        throw error;
      }
    } finally {
      await this.releaseSlotLocks(slotKeys);
    }
  }

  async createStaffManualBooking(
    userId: string,
    dto: CreateStaffVenueBookingDTO,
    actorUserId: string,
  ): Promise<BookingCheckoutResponseDTO> {
    const schedule = parseBookingSchedule(dto);
    const amenity = await this.amenityRepository.findActiveAmenityByIdOrThrow(
      dto.amenity_id,
    );

    const linkedCoach = dto.coach_id
      ? await this.coachService.assertCoachReservableForBookingWindow(
          dto.coach_id,
          schedule.startsAt,
          schedule.endsAt,
        )
      : null;

    const slotKeys = buildSlotKeys(
      dto.amenity_id,
      schedule.startsAt,
      schedule.endsAt,
    );
    await this.acquireSlotLocks(slotKeys);

    try {
      const amounts = calculateBookingAmounts(
        amenity,
        schedule.durationMinutes,
        resolveStaffInitialPaymentStage(dto.payment_stage),
        linkedCoach,
      );
      if (
        !amounts.totalAmount.equals(0) &&
        amounts.paymentStage !== PaymentStage.full
      ) {
        const initiation =
          await this.bookingRepository.createPendingBookingWithPayment({
            userId,
            amenityId: dto.amenity_id,
            coachId: dto.coach_id,
            startsAt: schedule.startsAt,
            endsAt: schedule.endsAt,
            notes: dto.notes,
            totalAmount: amounts.totalAmount,
            downpaymentAmount: amounts.downpaymentAmount,
            balanceAmount: amounts.balanceAmount,
            idempotencyKey: randomUUID(),
            paymentAmount: amounts.paymentAmount,
            paymentStage: amounts.paymentStage,
            paymentStatus: PaymentStatus.awaiting_verification,
            provider: PaymentProvider.cash,
          });

        return {
          booking_id: initiation.booking.id,
          status: initiation.booking.status,
          checkout_url: null,
          payment_id: initiation.payment.id,
        };
      }

      const booking = await this.bookingRepository.createConfirmedManualBooking(
        {
          userId,
          amenityId: dto.amenity_id,
          coachId: dto.coach_id,
          startsAt: schedule.startsAt,
          endsAt: schedule.endsAt,
          notes: dto.notes,
          totalAmount: amounts.totalAmount,
          downpaymentAmount: amounts.downpaymentAmount,
          balanceAmount: amounts.balanceAmount,
          idempotencyKey: randomUUID(),
          paymentAmount: amounts.paymentAmount,
          paymentStage: amounts.paymentStage,
          verifiedBy: actorUserId,
        },
      );

      this.emitBookingConfirmed({
        bookingId: booking.id,
        userId,
        amenityId: dto.amenity_id,
        startsAt: schedule.startsAt.toISOString(),
        endsAt: schedule.endsAt.toISOString(),
      });

      return {
        booking_id: booking.id,
        status: booking.status,
        checkout_url: null,
      };
    } finally {
      await this.releaseSlotLocks(slotKeys);
    }
  }

  async processBalance(
    bookingId: string,
    dto: ProcessBalanceDTO,
  ): Promise<BookingCheckoutResponseDTO> {
    const booking =
      await this.bookingRepository.findBookingWithAmenityByIdOrThrow(bookingId);
    this.assertBalanceCollectionAllowed(booking);

    const existingPayment =
      await this.paymentRepository.findLatestPaymentForPayableStage(
        PayableType.booking,
        booking.id,
        PaymentStage.balance,
      );

    if (existingPayment && existingPayment.status !== PaymentStatus.failed) {
      return this.resumeExistingBalancePayment(
        existingPayment,
        booking,
        dto.provider,
      );
    }

    const initiation = await this.bookingRepository.createBalancePendingPayment(
      {
        bookingId: booking.id,
        userId: booking.user_id,
        amount: booking.balance_amount,
        provider: dto.provider,
        referenceNo: dto.reference_no,
        screenshotUrl: dto.screenshot_url?.trim() || undefined,
        idempotencyKey: randomUUID(),
      },
    );

    if (dto.provider === PaymentProvider.cash) {
      return {
        booking_id: initiation.booking.id,
        status: initiation.booking.status,
        checkout_url: null,
        payment_id: initiation.payment.id,
      };
    }

    return this.startCheckoutForPayment(
      initiation.payment,
      initiation.booking.id,
      booking.amenity.name,
    );
  }

  @OnEvent(PAYMENT_COMPLETED_EVENT, { async: true })
  async handlePaymentCompleted(event: PaymentCompletedEvent): Promise<void> {
    if (event.payableType !== PayableType.booking) {
      return;
    }

    const payment = await this.paymentRepository.findPaymentByIdOrThrow(
      event.paymentId,
    );

    const booking =
      await this.bookingRepository.findBookingWithAmenityByIdOrThrow(
        event.payableId,
      );

    if (payment.payment_stage === PaymentStage.balance) {
      if (booking.balance_paid_at || booking.balance_amount.equals(0)) {
        return;
      }

      if (
        booking.status === BookingStatus.cancelled ||
        booking.status === BookingStatus.no_show
      ) {
        return;
      }

      await this.bookingRepository.completeBookingBalance(
        booking.id,
        new Date(),
      );
      return;
    }

    if (
      booking.status === BookingStatus.confirmed &&
      booking.downpayment_paid_at &&
      (payment.payment_stage !== PaymentStage.full || booking.balance_paid_at)
    ) {
      return;
    }

    if (booking.status !== BookingStatus.pending) {
      return;
    }

    const confirmedAt = new Date();
    const confirmedBooking =
      payment.payment_stage === PaymentStage.full
        ? await this.bookingRepository.confirmBookingFullPayment(
            booking.id,
            confirmedAt,
          )
        : await this.bookingRepository.confirmBookingDownpayment(
            booking.id,
            confirmedAt,
          );
    if (payment.payment_stage === PaymentStage.full) {
      this.emitBookingConfirmed({
        bookingId: confirmedBooking.id,
        userId: booking.user_id,
        amenityId: booking.amenity_id,
        startsAt: booking.starts_at.toISOString(),
        endsAt: booking.ends_at.toISOString(),
      });
    }
  }

  async cancelBooking(bookingId: string, userId: string): Promise<void> {
    const booking =
      await this.bookingRepository.findBookingByIdAndAssertOwnership(
        bookingId,
        userId,
      );

    if (
      booking.status !== BookingStatus.pending &&
      booking.status !== BookingStatus.confirmed
    ) {
      throw new HttpException(
        {
          type: 'BUSINESS_RULE_VIOLATION',
          title: 'Booking Cannot Be Cancelled',
          status: 422,
          detail:
            'Only pending or confirmed bookings can be cancelled. Downpayments remain non-refundable.',
        },
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }

    assertBookingCancellationWindow(booking.starts_at);

    const cancelledAt = new Date();
    await this.bookingRepository.cancelBooking(bookingId, cancelledAt);

    this.emitAudit({
      userId,
      action: AuditAction.BOOKING_CANCELLED,
      entity: 'AmenityBooking',
      entityId: bookingId,
      before: {
        status: booking.status,
        cancelled_at: booking.cancelled_at ?? null,
      } as Prisma.InputJsonValue,
      after: {
        status: BookingStatus.cancelled,
        cancelled_at: cancelledAt.toISOString(),
        refund: 'none',
      } as Prisma.InputJsonValue,
    });
    this.emitBookingCancelled({
      bookingId,
      userId,
      amenityId: booking.amenity_id,
      cancelledAt: cancelledAt.toISOString(),
    });
  }

  async completeConfirmedBooking(
    bookingId: string,
    actorUserId: string,
  ): Promise<void> {
    const booking =
      await this.bookingRepository.findBookingWithAmenityByIdOrThrow(bookingId);

    if (booking.status !== BookingStatus.confirmed) {
      throw new HttpException(
        {
          type: 'BUSINESS_RULE_VIOLATION',
          title: 'Booking Cannot Be Completed',
          status: 422,
          detail: 'Only confirmed venue bookings can be marked complete.',
        },
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }

    if (!booking.balance_amount.equals(0) && !booking.balance_paid_at) {
      throw new HttpException(
        {
          type: 'BUSINESS_RULE_VIOLATION',
          title: 'Booking Has Outstanding Balance',
          status: 422,
          detail:
            'Collect the remaining balance before marking this venue booking complete.',
        },
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }

    if (booking.ends_at > new Date()) {
      throw new HttpException(
        {
          type: 'BUSINESS_RULE_VIOLATION',
          title: 'Booking Not Finished Yet',
          status: 422,
          detail:
            'A venue booking can only be marked complete after its scheduled end time.',
        },
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }

    const completedAt = new Date();
    await this.bookingRepository.markBookingCompleted(bookingId, completedAt);

    this.emitAudit({
      userId: actorUserId,
      action: AuditAction.BOOKING_COMPLETED,
      entity: 'AmenityBooking',
      entityId: bookingId,
      before: { status: booking.status } as Prisma.InputJsonValue,
      after: {
        status: BookingStatus.completed,
        completed_at: completedAt.toISOString(),
      } as Prisma.InputJsonValue,
    });
  }

  async cancelBookingAsStaff(
    bookingId: string,
    actorUserId: string,
    reason?: string,
  ): Promise<void> {
    const booking =
      await this.bookingRepository.findBookingWithAmenityByIdOrThrow(bookingId);

    if (
      booking.status === BookingStatus.cancelled ||
      booking.status === BookingStatus.completed ||
      booking.status === BookingStatus.no_show
    ) {
      throw new HttpException(
        {
          type: 'BUSINESS_RULE_VIOLATION',
          title: 'Booking Cannot Be Cancelled',
          status: 422,
          detail:
            'Only active or pending venue bookings can be cancelled by staff.',
        },
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }

    assertBookingCancellationWindow(booking.starts_at);

    const cancelledAt = new Date();
    await this.bookingRepository.cancelBooking(bookingId, cancelledAt);

    this.emitAudit({
      userId: actorUserId,
      action: AuditAction.BOOKING_CANCELLED,
      entity: 'AmenityBooking',
      entityId: bookingId,
      before: {
        status: booking.status,
        cancelled_at: booking.cancelled_at ?? null,
      } as Prisma.InputJsonValue,
      after: {
        status: BookingStatus.cancelled,
        cancelled_at: cancelledAt.toISOString(),
        reason: reason ?? null,
        refund: 'none',
      } as Prisma.InputJsonValue,
    });
    this.emitBookingCancelled({
      bookingId,
      userId: booking.user_id,
      amenityId: booking.amenity_id,
      cancelledAt: cancelledAt.toISOString(),
    });
  }

  private normalizeAndValidateIdempotencyKey(
    idempotencyKey: string | undefined,
  ): string {
    const normalized = idempotencyKey?.trim();

    if (!normalized || !isUUID(normalized, '4')) {
      throw new HttpException(
        {
          type: 'BUSINESS_RULE_VIOLATION',
          title: 'Invalid Idempotency Key',
          status: 422,
          detail: 'Idempotency-Key header must be a valid UUID v4.',
        },
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }

    return normalized;
  }

  private resolveInitialProviderPaymentStage(
    provider: PaymentProvider,
    paymentStage: InitialBookingPaymentStage,
  ): InitialBookingPaymentStage {
    if (provider === PaymentProvider.paymongo) {
      return PaymentStage.downpayment;
    }

    return paymentStage;
  }

  private async resumeExistingCheckout(
    payment: Payment,
    userId: string,
    provider: PaymentProvider,
    paymentStage: InitialBookingPaymentStage,
  ): Promise<BookingCheckoutResponseDTO> {
    if (
      payment.user_id !== userId ||
      payment.payable_type !== PayableType.booking
    ) {
      throw new ConflictException({
        type: 'CONFLICT',
        title: 'Idempotency Key Already Used',
        status: 409,
        detail:
          'This Idempotency-Key is already associated with another payment request.',
      });
    }

    if (payment.provider !== provider) {
      throw new ConflictException({
        type: 'CONFLICT',
        title: 'Booking Payment Provider Mismatch',
        status: 409,
        detail:
          'This Idempotency-Key is already associated with another booking payment provider.',
      });
    }

    if (payment.payment_stage !== paymentStage) {
      throw new ConflictException({
        type: 'CONFLICT',
        title: 'Booking Payment Stage Mismatch',
        status: 409,
        detail:
          'This Idempotency-Key is already associated with another booking payment stage.',
      });
    }

    const booking =
      await this.bookingRepository.findBookingWithAmenityByIdOrThrow(
        payment.payable_id,
      );

    if (booking.user_id !== userId) {
      throw new ConflictException({
        type: 'CONFLICT',
        title: 'Booking Ownership Conflict',
        status: 409,
        detail:
          'This Idempotency-Key is already associated with another members booking.',
      });
    }

    const checkoutUrl = this.extractCheckoutUrl(payment.gateway_metadata);

    if (payment.status === PaymentStatus.completed) {
      return {
        booking_id: booking.id,
        status: booking.status,
        checkout_url: checkoutUrl,
        payment_id: payment.id,
      };
    }

    if (payment.provider === PaymentProvider.cash) {
      if (payment.status === PaymentStatus.failed) {
        throw new ConflictException({
          type: 'CONFLICT',
          title: 'Payment Attempt Already Failed',
          status: 409,
          detail:
            'This Idempotency-Key belongs to a failed payment attempt. Start a new attempt with a new key.',
        });
      }

      return {
        booking_id: booking.id,
        status: booking.status,
        checkout_url: null,
        payment_id: payment.id,
      };
    }

    if (checkoutUrl) {
      return {
        booking_id: booking.id,
        status: booking.status,
        checkout_url: checkoutUrl,
        payment_id: payment.id,
      };
    }

    if (payment.status === PaymentStatus.failed) {
      throw new ConflictException({
        type: 'CONFLICT',
        title: 'Payment Attempt Already Failed',
        status: 409,
        detail:
          'This Idempotency-Key belongs to a failed payment attempt. Start a new attempt with a new key.',
      });
    }

    return this.startCheckoutForPayment(
      payment,
      booking.id,
      booking.amenity.name,
    );
  }

  private async resumeExistingBalancePayment(
    payment: Payment,
    booking: Awaited<
      ReturnType<BookingRepository['findBookingWithAmenityByIdOrThrow']>
    >,
    provider: PaymentProvider,
  ): Promise<BookingCheckoutResponseDTO> {
    if (payment.provider !== provider) {
      throw new ConflictException({
        type: 'CONFLICT',
        title: 'Balance Payment Provider Mismatch',
        status: 409,
        detail:
          'A balance payment attempt already exists for another payment provider.',
      });
    }

    const checkoutUrl = this.extractCheckoutUrl(payment.gateway_metadata);

    if (payment.status === PaymentStatus.failed) {
      throw new ConflictException({
        type: 'CONFLICT',
        title: 'Balance Payment Attempt Already Failed',
        status: 409,
        detail:
          'This balance payment attempt has failed. Start a new balance collection.',
      });
    }

    if (payment.provider === PaymentProvider.cash) {
      return {
        booking_id: booking.id,
        status: BookingStatus.balance_pending,
        checkout_url: null,
        payment_id: payment.id,
      };
    }

    if (payment.status === PaymentStatus.completed || checkoutUrl) {
      return {
        booking_id: booking.id,
        status: booking.status,
        checkout_url: checkoutUrl,
        payment_id: payment.id,
      };
    }

    return this.startCheckoutForPayment(
      payment,
      booking.id,
      booking.amenity.name,
    );
  }

  private async startCheckoutForPayment(
    payment: Payment,
    bookingId: string,
    amenityName: string,
  ): Promise<BookingCheckoutResponseDTO> {
    const paymentLabel =
      payment.payment_stage === PaymentStage.balance
        ? 'balance'
        : payment.payment_stage === PaymentStage.full
          ? 'full payment'
          : 'downpayment';
    const checkout = await this.paymongoCheckoutService.createCheckoutSession({
      amount: this.toMinorAmount(payment.amount),
      description: `${amenityName} booking ${paymentLabel}`,
      idempotencyKey: payment.idempotency_key,
      metadata: {
        payment_id: payment.id,
        booking_id: bookingId,
      },
    });

    await this.paymentRepository.updatePayment(
      payment.id,
      this.toCheckoutUpdateInput(checkout),
    );

    return {
      booking_id: bookingId,
      status:
        payment.payment_stage === PaymentStage.balance
          ? BookingStatus.balance_pending
          : BookingStatus.pending,
      checkout_url: checkout.checkoutUrl,
      payment_id: payment.id,
    };
  }

  private async acquireSlotLocks(slotKeys: readonly string[]): Promise<void> {
    const acquiredKeys: string[] = [];

    try {
      for (const slotKey of slotKeys) {
        const result = await this.redis.set(
          slotKey,
          '1',
          'EX',
          BOOKING_LOCK_TTL_SECONDS,
          'NX',
        );

        if (result !== 'OK') {
          throw new ConflictException({
            type: 'CONFLICT',
            title: 'Double Booking Detected',
            status: 409,
            detail: 'The requested booking slot is already being reserved.',
          });
        }

        acquiredKeys.push(slotKey);
      }
    } catch (error) {
      await this.releaseSlotLocks(acquiredKeys);
      throw error;
    }
  }

  private async releaseSlotLocks(slotKeys: readonly string[]): Promise<void> {
    await Promise.all(slotKeys.map((slotKey) => this.redis.del(slotKey)));
  }

  private toMinorAmount(amount: Prisma.Decimal | number): number {
    return Math.round(Number(amount) * 100);
  }

  private toCheckoutUpdateInput(
    checkout: PaymongoCheckoutResult,
  ): Prisma.PaymentUpdateInput {
    return {
      status: PaymentStatus.processing,
      provider_ref: checkout.providerRef,
      gateway_metadata: checkout.gatewayMetadata as Prisma.InputJsonValue,
    };
  }

  private extractCheckoutUrl(
    gatewayMetadata: Prisma.JsonValue | null,
  ): string | null {
    if (
      gatewayMetadata &&
      typeof gatewayMetadata === 'object' &&
      !Array.isArray(gatewayMetadata)
    ) {
      const checkoutUrl = gatewayMetadata['checkout_url'];
      if (typeof checkoutUrl === 'string' && checkoutUrl.length > 0) {
        return checkoutUrl;
      }
    }

    return null;
  }

  private assertBalanceCollectionAllowed(
    booking: Awaited<
      ReturnType<BookingRepository['findBookingWithAmenityByIdOrThrow']>
    >,
  ): void {
    if (
      booking.status !== BookingStatus.confirmed &&
      booking.status !== BookingStatus.balance_pending
    ) {
      throw new HttpException(
        {
          type: 'BUSINESS_RULE_VIOLATION',
          title: 'Booking Balance Cannot Be Collected',
          status: 422,
          detail:
            'Only confirmed or balance-pending bookings can collect a remaining balance.',
        },
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }

    if (booking.balance_amount.equals(0)) {
      throw new HttpException(
        {
          type: 'BUSINESS_RULE_VIOLATION',
          title: 'No Outstanding Balance',
          status: 422,
          detail: 'This booking has no remaining balance to collect.',
        },
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }

    if (booking.balance_paid_at) {
      throw new ConflictException({
        type: 'CONFLICT',
        title: 'Balance Already Collected',
        status: 409,
        detail: 'This booking already has a recorded balance payment.',
      });
    }
  }

  async markBookingNoShowAsStaff(
    bookingId: string,
    actorUserId: string,
  ): Promise<void> {
    const booking =
      await this.bookingRepository.findBookingWithAmenityByIdOrThrow(bookingId);

    if (booking.status !== BookingStatus.confirmed) {
      throw new HttpException(
        {
          type: 'BUSINESS_RULE_VIOLATION',
          title: 'Booking Cannot Be Marked No-Show',
          status: 422,
          detail: 'Only confirmed venue bookings can be marked as no-show.',
        },
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }

    const noShowAt = new Date();
    const didMarkNoShow =
      await this.bookingRepository.markConfirmedBookingNoShow(
        bookingId,
        noShowAt,
      );

    if (!didMarkNoShow) {
      throw new HttpException(
        {
          type: 'BUSINESS_RULE_VIOLATION',
          title: 'Booking Cannot Be Marked No-Show Yet',
          status: 422,
          detail:
            'A venue booking can only be marked no-show on or after the booking start time.',
        },
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }

    this.emitAudit({
      userId: actorUserId,
      action: AuditAction.BOOKING_CANCELLED,
      entity: 'AmenityBooking',
      entityId: bookingId,
      before: { status: booking.status } as Prisma.InputJsonValue,
      after: {
        status: BookingStatus.no_show,
        no_show_at: noShowAt.toISOString(),
      } as Prisma.InputJsonValue,
    });
  }

  private assertAmenityReservable(amenity: Amenity): void {
    if (amenity.is_reservable === false) {
      throw new HttpException(
        {
          type: 'BUSINESS_RULE_VIOLATION',
          title: 'Venue Not Reservable',
          status: 422,
          detail:
            'This venue is marked facility-only and cannot be used for venue bookings.',
        },
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }
  }

  private emitAudit(event: AuditEvent): void {
    this.eventEmitter.emit('audit.log', event);
  }

  private emitBookingCancelled(event: BookingCancelledEvent): void {
    this.eventEmitter.emit(BOOKING_CANCELLED_EVENT, event);
  }

  private emitBookingConfirmed(event: BookingConfirmedEvent): void {
    this.eventEmitter.emit(BOOKING_CONFIRMED_EVENT, event);
  }

  private emitPaymentCompleted(event: PaymentCompletedEvent): void {
    this.eventEmitter.emit(PAYMENT_COMPLETED_EVENT, event);
  }
}

function parseAvailabilityRange(date: string): {
  dayStart: Date;
  dayEnd: Date;
} {
  const parts = date.split('-').map((value) => Number(value));
  if (parts.length !== 3 || parts.some((value) => Number.isNaN(value))) {
    throw invalidDateError();
  }

  const [year, month, day] = parts;
  const dayStart = new Date(Date.UTC(year, month - 1, day));

  if (
    dayStart.getUTCFullYear() !== year ||
    dayStart.getUTCMonth() !== month - 1 ||
    dayStart.getUTCDate() !== day
  ) {
    throw invalidDateError();
  }

  return {
    dayStart,
    dayEnd: new Date(dayStart.getTime() + SLOTS_PER_DAY * SLOT_INTERVAL_MS),
  };
}

function buildAvailabilitySlots(
  dayStart: Date,
  capacity: number,
  bookings: readonly BookingWindow[],
): AvailabilitySlotDTO[] {
  return Array.from({ length: SLOTS_PER_DAY }, (_, index) => {
    const startsAt = new Date(dayStart.getTime() + index * SLOT_INTERVAL_MS);
    const endsAt = new Date(startsAt.getTime() + SLOT_INTERVAL_MS);
    const overlappingBookings = bookings.filter(
      (booking) => booking.starts_at < endsAt && booking.ends_at > startsAt,
    ).length;

    return {
      starts_at: startsAt.toISOString(),
      ends_at: endsAt.toISOString(),
      available: overlappingBookings < capacity,
    };
  });
}

function invalidDateError(): BadRequestException {
  return new BadRequestException({
    type: 'INVALID_DATE',
    title: 'Invalid Date',
    status: 400,
    detail: 'date must be a valid YYYY-MM-DD calendar date.',
  });
}

function parseBookingSchedule(
  dto: Pick<CreateBookingDTO, 'starts_at' | 'ends_at'>,
): BookingSchedule {
  const startsAt = new Date(dto.starts_at);
  const endsAt = new Date(dto.ends_at);

  if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) {
    throw invalidBookingWindowError(
      'starts_at and ends_at must be valid ISO 8601 date strings.',
    );
  }

  if (startsAt <= new Date()) {
    throw invalidBookingWindowError('starts_at must be in the future.');
  }

  if (endsAt <= startsAt) {
    throw invalidBookingWindowError('ends_at must be after starts_at.');
  }

  if (toGymDateKey(startsAt) !== toGymDateKey(endsAt)) {
    throw invalidBookingWindowError(
      'Bookings must start and end on the same gym calendar day.',
    );
  }

  if (!isThirtyMinuteBoundary(startsAt) || !isThirtyMinuteBoundary(endsAt)) {
    throw invalidBookingWindowError(
      'starts_at and ends_at must align to 30-minute slot boundaries.',
    );
  }

  const durationMinutes = (endsAt.getTime() - startsAt.getTime()) / (60 * 1000);
  if (durationMinutes % SLOT_INTERVAL_MINUTES !== 0) {
    throw invalidBookingWindowError(
      'Booking duration must be in 30-minute increments.',
    );
  }

  return { startsAt, endsAt, durationMinutes };
}

function calculateBookingAmounts(
  amenity: Pick<Amenity, 'hourly_rate'>,
  durationMinutes: number,
  paymentStage: InitialBookingPaymentStage,
  coach?: { hourly_rate: Prisma.Decimal | number | string } | null,
): BookingAmounts {
  const hourlyRate = new Prisma.Decimal(amenity.hourly_rate).plus(
    coach?.hourly_rate ?? 0,
  );
  const totalAmount = hourlyRate
    .mul(durationMinutes)
    .div(60)
    .toDecimalPlaces(2);
  if (paymentStage === PaymentStage.full) {
    return {
      totalAmount,
      downpaymentAmount: totalAmount,
      balanceAmount: new Prisma.Decimal('0.00'),
      paymentAmount: totalAmount,
      paymentStage,
    };
  }
  const downpaymentAmount = totalAmount
    .mul(DOWNPAYMENT_RATE)
    .toDecimalPlaces(2);
  const balanceAmount = totalAmount.minus(downpaymentAmount).toDecimalPlaces(2);

  return {
    totalAmount,
    downpaymentAmount,
    balanceAmount,
    paymentAmount: downpaymentAmount,
    paymentStage,
  };
}

function resolveBookingPaymentStage(
  paymentStage?: CreateBookingPaymentStage,
): InitialBookingPaymentStage {
  return paymentStage === CreateBookingPaymentStage.full
    ? PaymentStage.full
    : PaymentStage.downpayment;
}

function resolveStaffInitialPaymentStage(
  paymentStage?: CreateStaffInitialPaymentStage,
): InitialBookingPaymentStage {
  return paymentStage === CreateStaffInitialPaymentStage.downpayment
    ? PaymentStage.downpayment
    : PaymentStage.full;
}

function buildSlotKeys(
  amenityId: string,
  startsAt: Date,
  endsAt: Date,
): string[] {
  const keys: string[] = [];

  for (
    let cursor = new Date(startsAt);
    cursor < endsAt;
    cursor = new Date(cursor.getTime() + SLOT_INTERVAL_MS)
  ) {
    keys.push(`booking_lock:${amenityId}:${formatSlotKeyTimestamp(cursor)}`);
  }

  return keys;
}

function formatSlotKeyTimestamp(value: Date): string {
  const year = value.getUTCFullYear().toString();
  const month = `${value.getUTCMonth() + 1}`.padStart(2, '0');
  const day = `${value.getUTCDate()}`.padStart(2, '0');
  const hours = `${value.getUTCHours()}`.padStart(2, '0');
  const minutes = `${value.getUTCMinutes()}`.padStart(2, '0');

  return `${year}${month}${day}-${hours}${minutes}`;
}

function isThirtyMinuteBoundary(value: Date): boolean {
  return (
    value.getUTCSeconds() === 0 &&
    value.getUTCMilliseconds() === 0 &&
    value.getUTCMinutes() % SLOT_INTERVAL_MINUTES === 0
  );
}

function toGymDateKey(value: Date): string {
  const gymTime = new Date(
    value.getTime() + GYM_TIMEZONE_OFFSET_MINUTES * 60 * 1000,
  );
  const year = gymTime.getUTCFullYear();
  const month = String(gymTime.getUTCMonth() + 1).padStart(2, '0');
  const day = String(gymTime.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function assertBookingCancellationWindow(startsAt: Date): void {
  if (toGymDateKey(new Date()) < toGymDateKey(startsAt)) {
    return;
  }

  throw new HttpException(
    {
      type: 'BUSINESS_RULE_VIOLATION',
      title: 'Booking Cannot Be Cancelled',
      status: 422,
      detail:
        'Venue bookings can only be cancelled until the day before the booking date.',
    },
    HttpStatus.UNPROCESSABLE_ENTITY,
  );
}

function invalidBookingWindowError(detail: string): BadRequestException {
  return new BadRequestException({
    type: 'INVALID_BOOKING_WINDOW',
    title: 'Invalid Booking Window',
    status: 400,
    detail,
  });
}
