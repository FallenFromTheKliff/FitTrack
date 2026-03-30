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
import { PaymentRepository } from '../../membership/payment/payment.repository';
import { PAYMENT_COMPLETED_EVENT } from '../../membership/payment/events/payment-completed.event';
import type { PaymentCompletedEvent } from '../../membership/payment/events/payment-completed.event';
import {
  PaymongoCheckoutResult,
  PaymongoCheckoutService,
} from '../../membership/payment/paymongo-checkout.service';
import { SubscriptionService } from '../../membership/subscription/subscription.service';
import { DateRangeDTO } from '../../user/dto/user-dto';
import { AmenityRepository } from '../amenity/amenity.repository';
import { BookingRepository } from './booking.repository';
import {
  AvailabilityQueryDTO,
  AvailabilitySlotDTO,
} from './dto/availability.dto';
import {
  BookingCheckoutResponseDTO,
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

type BookingWindow = Pick<AmenityBooking, 'starts_at' | 'ends_at'>;
type BookingAmounts = {
  balanceAmount: Prisma.Decimal;
  downpaymentAmount: Prisma.Decimal;
  totalAmount: Prisma.Decimal;
};
type BookingSchedule = {
  durationMinutes: number;
  endsAt: Date;
  startsAt: Date;
};

@Injectable()
export class BookingService {
  constructor(
    private readonly bookingRepository: BookingRepository,
    private readonly amenityRepository: AmenityRepository,
    private readonly paymentRepository: PaymentRepository,
    private readonly paymongoCheckoutService: PaymongoCheckoutService,
    private readonly subscriptionService: SubscriptionService,
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

    if (existingPayment) {
      return this.resumeExistingCheckout(existingPayment, userId);
    }

    const schedule = parseBookingSchedule(dto);
    const amenity = await this.amenityRepository.findActiveAmenityByIdOrThrow(
      dto.amenity_id,
    );

    if (amenity.requires_subscription) {
      const hasAccess =
        await this.subscriptionService.hasSubscriptionAccess(userId);

      if (!hasAccess) {
        throw new ForbiddenException({
          type: 'FORBIDDEN',
          title: 'Subscription Required',
          status: 403,
          detail: 'An active subscription is required to book this amenity.',
        });
      }
    }

    const amounts = calculateBookingAmounts(amenity, schedule.durationMinutes);
    if (
      !amounts.totalAmount.equals(0) &&
      dto.provider !== PaymentProvider.paymongo
    ) {
      throw new HttpException(
        {
          type: 'BUSINESS_RULE_VIOLATION',
          title: 'Unsupported Booking Provider',
          status: 422,
          detail:
            'Only PayMongo checkout is supported for paid booking initiation.',
        },
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }

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
            startsAt: schedule.startsAt,
            endsAt: schedule.endsAt,
            notes: dto.notes,
            totalAmount: amounts.totalAmount,
            downpaymentAmount: amounts.downpaymentAmount,
            balanceAmount: amounts.balanceAmount,
            idempotencyKey: normalizedIdempotencyKey,
            provider: 'paymongo',
          });

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
          return this.resumeExistingCheckout(resumedPayment, userId);
        }

        throw error;
      }
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
        screenshotUrl: dto.screenshot_url,
        idempotencyKey: randomUUID(),
      },
    );

    if (dto.provider === PaymentProvider.cash) {
      return {
        booking_id: initiation.booking.id,
        status: initiation.booking.status,
        checkout_url: null,
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
      if (
        booking.status === BookingStatus.completed &&
        booking.balance_paid_at
      ) {
        return;
      }

      if (booking.status !== BookingStatus.balance_pending) {
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
      booking.downpayment_paid_at
    ) {
      return;
    }

    if (booking.status !== BookingStatus.pending) {
      return;
    }

    const confirmedBooking =
      await this.bookingRepository.confirmBookingDownpayment(
        booking.id,
        new Date(),
      );
    this.emitBookingConfirmed({
      bookingId: confirmedBooking.id,
      userId: booking.user_id,
      amenityId: booking.amenity_id,
      startsAt: booking.starts_at.toISOString(),
      endsAt: booking.ends_at.toISOString(),
    });
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

  private async resumeExistingCheckout(
    payment: Payment,
    userId: string,
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

    if (payment.provider !== PaymentProvider.paymongo) {
      throw new ConflictException({
        type: 'CONFLICT',
        title: 'Payment Provider Mismatch',
        status: 409,
        detail:
          'This Idempotency-Key is already associated with a non-PayMongo payment.',
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
      };
    }

    if (checkoutUrl) {
      return {
        booking_id: booking.id,
        status: booking.status,
        checkout_url: checkoutUrl,
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

    if (payment.provider === PaymentProvider.cash) {
      return {
        booking_id: booking.id,
        status: BookingStatus.balance_pending,
        checkout_url: null,
      };
    }

    if (payment.status === PaymentStatus.completed || checkoutUrl) {
      return {
        booking_id: booking.id,
        status: booking.status,
        checkout_url: checkoutUrl,
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

    if (
      booking.status === BookingStatus.confirmed &&
      booking.starts_at > new Date()
    ) {
      throw new HttpException(
        {
          type: 'BUSINESS_RULE_VIOLATION',
          title: 'Balance Collection Not Yet Allowed',
          status: 422,
          detail:
            'Balance collection can only start on or after the booking start time.',
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

function parseBookingSchedule(dto: CreateBookingDTO): BookingSchedule {
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
): BookingAmounts {
  const totalAmount = new Prisma.Decimal(amenity.hourly_rate)
    .mul(durationMinutes)
    .div(60)
    .toDecimalPlaces(2);
  const downpaymentAmount = totalAmount
    .mul(DOWNPAYMENT_RATE)
    .toDecimalPlaces(2);
  const balanceAmount = totalAmount.minus(downpaymentAmount).toDecimalPlaces(2);

  return {
    totalAmount,
    downpaymentAmount,
    balanceAmount,
  };
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

function invalidBookingWindowError(detail: string): BadRequestException {
  return new BadRequestException({
    type: 'INVALID_BOOKING_WINDOW',
    title: 'Invalid Booking Window',
    status: 400,
    detail,
  });
}
