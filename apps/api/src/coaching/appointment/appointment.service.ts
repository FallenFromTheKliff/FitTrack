import {
  ConflictException,
  ForbiddenException,
  GoneException,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import {
  AppointmentStatus,
  CoachAppointment,
  CoachProfile,
  PayableType,
  Payment,
  PaymentProvider,
  PaymentStage,
  PaymentStatus,
  Prisma,
  RecurringCoachingSessionState,
  UserRole,
} from '@prisma/client';
import { isUUID } from 'class-validator';

import { AuditAction, AuditEvent } from '../../audit/audit.service';
import { PaginatedResult } from '../../common/base-repository/base-repository';
import { PaymentRepository } from '../../membership/payment/payment.repository';
import { PAYMENT_COMPLETED_EVENT } from '../../membership/payment/events/payment-completed.event';
import type { PaymentCompletedEvent } from '../../membership/payment/events/payment-completed.event';
import {
  PaymongoCheckoutResult,
  PaymongoCheckoutService,
} from '../../membership/payment/paymongo-checkout.service';
import { SubscriptionService } from '../../membership/subscription/subscription.service';
import {
  CreateStaffCoachBookingDTO,
  CreateStaffInitialPaymentStage,
} from '../../staff/dto/staff-schedule.dto';
import { DateRangeDTO } from '../../user/dto/user-dto';
import {
  AppointmentBalanceDTO,
  AppointmentCheckoutResponseDTO,
  AppointmentResponseDTO,
  CancelAppointmentDTO,
  CoachAppointmentBookingMode,
  CoachScheduleAppointmentResponseDTO,
  CompleteAppointmentDTO,
  CreateCoachManagedAppointmentDTO,
  CreateAppointmentDTO,
  InitiateAppointmentPaymentDTO,
  RespondAppointmentDTO,
  RescheduleAppointmentDTO,
  SetAvailabilityDTO,
  StaffAppointmentFilterDTO,
  StaffAppointmentResponseDTO,
  SubmitCoachFeedbackDTO,
} from './dto/appointment.dto';
import {
  AppointmentLifecycleRecord,
  MemberAppointmentRecord,
  AppointmentRepository,
  CoachScheduleRecord,
  StaffAppointmentRecord,
} from './appointment.repository';
import {
  APPOINTMENT_CANCELLED_EVENT,
  type AppointmentCancelledEvent,
} from './events/appointment-cancelled.event';
import {
  APPOINTMENT_COMPLETED_EVENT,
  type AppointmentCompletedEvent,
} from './events/appointment-completed.event';
import {
  APPOINTMENT_CONFIRMED_EVENT,
  type AppointmentConfirmedEvent,
} from './events/appointment-confirmed.event';
import { RecurringCoachingPlanService } from '../recurring-plan/recurring-coaching-plan.service';
import { RelationshipService } from '../relationship/relationship.service';
import {
  CoachAvailabilityQueryDTO,
} from './dto/appointment.dto';
import { CoachAvailabilityService } from '../availability/coach-availability.service';
import {
  CoachingCheckoutResponse,
  CoachingCommerceService,
} from '../commerce/coaching-commerce.service';

const DOWNPAYMENT_RATE = new Prisma.Decimal('0.30');
const ZERO_DECIMAL = new Prisma.Decimal('0');
const EMAIL_LIKE_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const GYM_TIMEZONE_OFFSET_MINUTES = 8 * 60;
type ActiveAppointmentPayment = Pick<
  Payment,
  'id' | 'payment_stage' | 'provider' | 'status'
>;

type AppointmentAmounts = {
  totalAmount: Prisma.Decimal;
  downpaymentAmount: Prisma.Decimal;
  balanceAmount: Prisma.Decimal;
  gymRevenue: Prisma.Decimal;
  coachEarnings: Prisma.Decimal;
};

type InitialAppointmentPaymentStage = Extract<
  PaymentStage,
  typeof PaymentStage.downpayment | typeof PaymentStage.full
>;

type NormalizedAvailabilitySlot = {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  startMinutes: number;
  endMinutes: number;
};

function findPrimaryIdentifier(
  identities:
    | Array<{
        identifier: string;
        is_primary: boolean;
      }>
    | undefined,
): string | null {
  return (
    identities?.find((identity) => identity.is_primary)?.identifier ??
    identities?.[0]?.identifier ??
    null
  );
}

function toDecimalString(
  value: { toString(): string } | number | string | null | undefined,
) {
  return value == null ? '0' : value.toString();
}

function normalizeStandaloneDisplayName(value?: string | null) {
  const displayName = value?.trim();
  if (displayName && !EMAIL_LIKE_PATTERN.test(displayName)) {
    return displayName;
  }

  return null;
}

@Injectable()
export class AppointmentService {
  constructor(
    private readonly repo: AppointmentRepository,
    private readonly subscriptionService: SubscriptionService,
    private readonly paymentRepository: PaymentRepository,
    private readonly paymongoCheckoutService: PaymongoCheckoutService,
    private readonly eventEmitter: EventEmitter2,
    private readonly recurringPlanService: RecurringCoachingPlanService,
    private readonly relationshipService: RelationshipService,
    private readonly coachingCommerceService: CoachingCommerceService,
    private readonly coachAvailabilityService: CoachAvailabilityService,
  ) {}

  getAvailability(coachId: string, dto: CoachAvailabilityQueryDTO) {
    return this.coachAvailabilityService.getSlots({
      coachId,
      date: dto.date,
      durationMinutes: dto.duration_minutes,
    });
  }

  async setAvailability(
    userId: string,
    dto: SetAvailabilityDTO,
  ): Promise<void> {
    const coach = await this.repo.findCoachByUserIdOrThrow(userId);
    const normalizedSlots = this.normalizeAvailabilitySlots(dto);

    await this.repo.replaceAvailabilitySlots({
      coachId: coach.id,
      slots: normalizedSlots.map((slot) => ({
        dayOfWeek: slot.dayOfWeek,
        startTime: this.toTimeValue(slot.startTime),
        endTime: this.toTimeValue(slot.endTime),
      })),
    });
  }

  async setAvailabilityForCoach(
    coachId: string,
    dto: SetAvailabilityDTO,
  ): Promise<void> {
    await this.repo.findCoachScheduleContextOrThrow(coachId);
    const normalizedSlots = this.normalizeAvailabilitySlots(dto);

    await this.repo.replaceAvailabilitySlots({
      coachId,
      slots: normalizedSlots.map((slot) => ({
        dayOfWeek: slot.dayOfWeek,
        startTime: this.toTimeValue(slot.startTime),
        endTime: this.toTimeValue(slot.endTime),
      })),
    });
  }

  async createAppointment(
    userId: string,
    dto: CreateAppointmentDTO,
    idempotencyKey?: string,
  ): Promise<CoachingCheckoutResponse> {
    const scheduledAt = this.parseScheduledAt(dto.scheduled_at);
    const coach = await this.repo.findCoachScheduleContextOrThrow(dto.coach_id);
    const appointmentEndsAt = new Date(
      scheduledAt.getTime() + dto.duration_minutes * 60 * 1000,
    );

    if (
      this.toGymDateKey(appointmentEndsAt) !== this.toGymDateKey(scheduledAt)
    ) {
      throw new HttpException(
        {
          type: 'BUSINESS_RULE_VIOLATION',
          title: 'Invalid Appointment Window',
          status: 422,
          detail:
            'Appointments must start and end on the same gym calendar day.',
        },
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }

    if (!coach.is_available_for_booking) {
      throw this.buildUnavailableCoachError();
    }

    // Book a Trainer is always a paid flow. Subscription/free-session records
    // remain readable, but a new member booking must not bypass checkout.
    const isFreeSession = false;
    const amounts = calculateAppointmentAmounts(
      coach,
      dto.duration_minutes,
      isFreeSession,
    );

    // A member checkout reserves an internal hold only. No product-visible
    // appointment exists until the PayMongo webhook consumes that hold.
    return this.coachingCommerceService.createOneTimeCheckout({
      amount: amounts.totalAmount,
      coachId: coach.id,
      durationMinutes: dto.duration_minutes,
      idempotencyKey: idempotencyKey ?? '',
      memberNotes: this.formatMemberAppointmentNotes(dto),
      scheduledAt,
      userId,
    });
  }

  private formatMemberAppointmentNotes(dto: CreateAppointmentDTO) {
    const bookingMode = dto.booking_mode ?? CoachAppointmentBookingMode.single;
    const sessionCount =
      bookingMode === CoachAppointmentBookingMode.single
        ? 1
        : Math.max(1, dto.session_count ?? 1);
    const memberNotes = dto.member_notes?.trim();

    if (bookingMode === CoachAppointmentBookingMode.single) {
      return memberNotes;
    }

    const intentLabel =
      bookingMode === CoachAppointmentBookingMode.pack
        ? `Multi-session pack request (${sessionCount} sessions)`
        : `Recurring coach plan request (${sessionCount} sessions)`;

    return [intentLabel, memberNotes].filter(Boolean).join(' - ');
  }

  createCoachManagedAppointment(
    coachUserId: string,
    dto: CreateCoachManagedAppointmentDTO,
  ): Promise<AppointmentResponseDTO> {
    void coachUserId;
    void dto;
    return Promise.reject(new GoneException({
      type: 'GONE',
      title: 'Coach Commercial Booking Retired',
      status: 410,
      detail:
        'Coaches cannot create new commercial paid appointments. Members must complete full PayMongo checkout or staff/admin must use atomic full-cash registration.',
    }));
  }

  async rescheduleAppointment(
    requesterId: string,
    role: UserRole,
    appointmentId: string,
    dto: RescheduleAppointmentDTO,
    idempotencyKey?: string,
  ): Promise<AppointmentResponseDTO> {
    const appointment =
      await this.repo.findAppointmentLifecycleContextByIdOrThrow(appointmentId);

    this.assertRescheduleOwnership(appointment, requesterId, role);
    this.assertPaidOneTimeAppointment(appointment);
    this.normalizeAndValidateIdempotencyKey(idempotencyKey);

    const scheduledAt = this.parseScheduledAt(dto.scheduled_at);
    const durationMinutes = dto.duration_minutes;
    const isReplay =
      appointment.scheduled_at.getTime() === scheduledAt.getTime() &&
      appointment.duration_minutes === durationMinutes;

    if (!isReplay) {
      await this.coachAvailabilityService.assertAvailable({
        coachId: appointment.coach_id,
        durationMinutes,
        excludeAppointmentIds: [appointment.id],
        startsAt: scheduledAt,
      });
    }

    const updated = isReplay
      ? appointment
      : await this.repo.updateAppointment(appointment.id, {
          scheduled_at: scheduledAt,
          duration_minutes: durationMinutes,
        });

    return this.toAppointmentResponseWithLatestPayment(updated);
  }

  async createStaffManualAppointment(
    userId: string,
    dto: CreateStaffCoachBookingDTO,
    actorUserId: string,
    idempotencyKey?: string,
  ): Promise<AppointmentResponseDTO> {
    if (
      dto.payment_stage !== undefined &&
      dto.payment_stage !== CreateStaffInitialPaymentStage.full
    ) {
      throw new HttpException(
        {
          type: 'BUSINESS_RULE_VIOLATION',
          title: 'Full Cash Payment Required',
          status: 422,
          detail:
            'Staff-created coaching appointments must record full cash payment. Partial-payment appointments are not available in the staff flow.',
        },
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }
    const normalizedIdempotencyKey =
      this.normalizeAndValidateIdempotencyKey(idempotencyKey);

    const scheduledAt = this.parseScheduledAt(dto.scheduled_at);
    const coach = await this.repo.findCoachScheduleContextOrThrow(dto.coach_id);
    const appointmentEndsAt = new Date(
      scheduledAt.getTime() + dto.duration_minutes * 60 * 1000,
    );

    if (
      this.toGymDateKey(appointmentEndsAt) !== this.toGymDateKey(scheduledAt)
    ) {
      throw new HttpException(
        {
          type: 'BUSINESS_RULE_VIOLATION',
          title: 'Invalid Appointment Window',
          status: 422,
          detail:
            'Appointments must start and end on the same gym calendar day.',
        },
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }

    const slotStart = this.toTimeValue(this.toGymTimeString(scheduledAt));
    const slotEnd = this.toTimeValue(this.toGymTimeString(appointmentEndsAt));

    if (!coach.is_available_for_booking) {
      throw this.buildUnavailableCoachError();
    }

    const amounts = calculateAppointmentAmounts(
      coach,
      dto.duration_minutes,
      false,
    );
    const paymentStage = PaymentStage.full;
    const paymentAmount =
      paymentStage === PaymentStage.full
        ? amounts.totalAmount
        : amounts.downpaymentAmount;
    const appointment = await this.repo.createConfirmedManualAppointment({
      userId,
      coachId: coach.id,
      scheduledAt,
      appointmentEndsAt,
      dayOfWeek: this.toGymDayOfWeek(scheduledAt),
      slotStart,
      slotEnd,
      durationMinutes: dto.duration_minutes,
      memberNotes: dto.member_notes,
      ...amounts,
      idempotencyKey: normalizedIdempotencyKey,
      paymentAmount,
      paymentStage,
      verifiedBy: actorUserId,
    });

    if (appointment.status === AppointmentStatus.confirmed && coach.user_id) {
      this.emitAppointmentConfirmed({
        appointmentId: appointment.id,
        userId: appointment.user_id,
        coachId: appointment.coach_id,
        scheduledAt: appointment.scheduled_at.toISOString(),
        durationMinutes: appointment.duration_minutes,
      });
    }

    return this.toAppointmentResponse(appointment);
  }

  async getMyAppointments(
    userId: string,
    dto: DateRangeDTO,
  ): Promise<PaginatedResult<AppointmentResponseDTO>> {
    const result = await this.repo.getMyAppointments(userId, dto);
    const latestPayments =
      await this.paymentRepository.findLatestPaymentsForPayableIds(
        PayableType.coaching,
        result.data.map((appointment) => appointment.id),
      );
    const latestPaymentByAppointmentId = new Map<
      string,
      ActiveAppointmentPayment
    >();

    for (const payment of latestPayments) {
      if (!latestPaymentByAppointmentId.has(payment.payable_id)) {
        latestPaymentByAppointmentId.set(payment.payable_id, payment);
      }
    }

    return {
      data: result.data.map((appointment) =>
        this.toAppointmentResponse(
          appointment,
          latestPaymentByAppointmentId.get(appointment.id) ?? null,
        ),
      ),
      meta: result.meta,
    };
  }

  async getCoachAppointments(
    coachUserId: string,
    dto: DateRangeDTO,
  ): Promise<PaginatedResult<CoachScheduleAppointmentResponseDTO>> {
    const result = await this.repo.getCoachAppointments(coachUserId, dto);
    const latestPayments =
      await this.paymentRepository.findLatestPaymentsForPayableIds(
        PayableType.coaching,
        result.data.map((appointment) => appointment.id),
      );
    const latestPaymentByAppointmentId = new Map<
      string,
      ActiveAppointmentPayment
    >();

    for (const payment of latestPayments) {
      if (!latestPaymentByAppointmentId.has(payment.payable_id)) {
        latestPaymentByAppointmentId.set(payment.payable_id, payment);
      }
    }

    return {
      data: result.data.map((appointment) =>
        this.toCoachScheduleResponse(
          appointment,
          latestPaymentByAppointmentId.get(appointment.id) ?? null,
        ),
      ),
      meta: result.meta,
    };
  }

  async getStaffAppointments(
    dto: StaffAppointmentFilterDTO,
  ): Promise<PaginatedResult<StaffAppointmentResponseDTO>> {
    const result = await this.repo.getStaffAppointments(dto);
    const latestPayments =
      await this.paymentRepository.findLatestPaymentsForPayableIds(
        PayableType.coaching,
        result.data.map((appointment) => appointment.id),
      );
    const latestPaymentByAppointmentId = new Map<
      string,
      ActiveAppointmentPayment
    >();

    for (const payment of latestPayments) {
      if (!latestPaymentByAppointmentId.has(payment.payable_id)) {
        latestPaymentByAppointmentId.set(payment.payable_id, payment);
      }
    }

    return {
      data: result.data.map((appointment) =>
        this.toStaffAppointmentResponse(
          appointment,
          latestPaymentByAppointmentId.get(appointment.id) ?? null,
        ),
      ),
      meta: result.meta,
    };
  }

  respondToAppointment(
    coachUserId: string,
    appointmentId: string,
    dto: RespondAppointmentDTO,
  ): Promise<AppointmentResponseDTO> {
    void coachUserId;
    void appointmentId;
    void dto;
    return Promise.reject(
      this.legacyCommercialRouteRetired(
        'Coach acceptance of pending appointment requests is retired. Coaches may mutate only paid entitlement sessions and approved reschedules.',
      ),
    );
  }

  respondToAppointmentAsStaff(
    actorId: string,
    appointmentId: string,
    dto: RespondAppointmentDTO,
  ): Promise<AppointmentResponseDTO> {
    void actorId;
    void appointmentId;
    void dto;
    return Promise.reject(
      this.legacyCommercialRouteRetired(
        'Staff confirmation of pending appointment requests is retired. New appointments are confirmed only after full payment or atomic staff cash registration.',
      ),
    );
  }

  async cancelAppointment(
    requesterId: string,
    role: UserRole,
    appointmentId: string,
    dto: CancelAppointmentDTO,
  ): Promise<void> {
    const appointment =
      await this.repo.findAppointmentLifecycleContextByIdOrThrow(appointmentId);

    this.assertCancellationOwnership(appointment, requesterId, role);
    this.assertCancellableStatus(appointment.status);
    this.assertCancellationWindow(appointment.scheduled_at);

    const cancelledAt = new Date();
    const updated = await this.repo.updateAppointment(appointment.id, {
      status: AppointmentStatus.cancelled,
      cancellation_reason: dto.reason ?? null,
      cancelled_at: cancelledAt,
    });

    this.emitAudit({
      userId: requesterId,
      action: AuditAction.APPOINTMENT_CANCELLED,
      entity: 'CoachAppointment',
      entityId: appointment.id,
      before: this.toAppointmentAuditBefore(appointment),
      after: this.toAppointmentAuditAfter(
        AppointmentStatus.cancelled,
        cancelledAt,
        dto.reason ?? null,
      ),
    });
    this.emitAppointmentCancelled({
      appointmentId: updated.id,
      userId: updated.user_id,
      coachId: updated.coach_id,
      cancelledAt: cancelledAt.toISOString(),
    });
  }

  initiateDownpayment(
    userId: string,
    userRole: UserRole,
    appointmentId: string,
    dto: InitiateAppointmentPaymentDTO,
    idempotencyKey: string | undefined,
  ): Promise<AppointmentCheckoutResponseDTO> {
    void userId;
    void userRole;
    void appointmentId;
    void dto;
    void idempotencyKey;
    return Promise.reject(new GoneException({
      type: 'GONE',
      title: 'Appointment Payment Route Retired',
      status: 410,
      detail:
        'Product-visible appointment payment initiation, downpayments, and cash verification are retired. New appointments use the checkout hold returned by POST /coaching/appointments.',
    }));
    /*
    const normalizedIdempotencyKey =
      this.normalizeAndValidateIdempotencyKey(idempotencyKey);
    this.assertMemberAppointmentPaymentPolicy(
      dto.provider,
      dto.payment_stage,
      userRole,
    );
    const paymentStage = this.resolveAppointmentInitialPaymentStage(
      dto.payment_stage,
      userRole,
    );
    this.assertSupportedDownpaymentProvider(dto.provider);

    const existingIdempotentPayment =
      await this.paymentRepository.findPaymentByIdempotencyKey(
        normalizedIdempotencyKey,
      );

    if (existingIdempotentPayment) {
      return this.resumeExistingDownpaymentPayment(
        existingIdempotentPayment,
        userId,
        userRole,
        appointmentId,
        dto.provider,
        paymentStage,
      );
    }

    const appointment =
      await this.repo.findAppointmentLifecycleContextByIdOrThrow(appointmentId);

    this.assertAppointmentPaymentAccess(appointment, userId, userRole);
    this.assertInitialPaymentAllowed(appointment, paymentStage);

    const existingStagePayment =
      await this.paymentRepository.findLatestPaymentForPayableStage(
        PayableType.coaching,
        appointment.id,
        paymentStage,
      );

    if (
      existingStagePayment &&
      existingStagePayment.status !== PaymentStatus.failed
    ) {
      return this.resumeExistingDownpaymentPayment(
        existingStagePayment,
        userId,
        userRole,
        appointmentId,
        dto.provider,
        paymentStage,
      );
    }

    const amount =
      paymentStage === PaymentStage.full
        ? appointment.total_amount
        : appointment.downpayment_amount;

    const payment = await this.paymentRepository.createPayment({
      user: { connect: { id: appointment.user_id } },
      payable_type: PayableType.coaching,
      payable_id: appointment.id,
      payment_stage: paymentStage,
      amount,
      provider: dto.provider,
      idempotency_key: normalizedIdempotencyKey,
      status:
        dto.provider === PaymentProvider.cash
          ? PaymentStatus.awaiting_verification
          : PaymentStatus.pending,
    });

    if (dto.provider === PaymentProvider.cash) {
      return {
        appointment_id: appointment.id,
        status: appointment.status,
        checkout_url: null,
        payment_id: payment.id,
      };
    }

    return this.startCheckoutForPayment(
      payment,
      appointment.id,
      appointment.status,
    );
    */
  }

  processBalance(
    _staffId: string,
    appointmentId: string,
    dto: AppointmentBalanceDTO,
  ): Promise<AppointmentCheckoutResponseDTO> {
    void _staffId;
    void appointmentId;
    void dto;
    return Promise.reject(
      this.legacyCommercialRouteRetired(
        'Coaching appointments are full-payment-only. Product-visible balance collection and cash verification are retired.',
      ),
    );
  }

  async completeAppointment(
    coachUserId: string,
    appointmentId: string,
    dto: CompleteAppointmentDTO,
  ): Promise<AppointmentResponseDTO> {
    const coach = await this.repo.findCoachByUserIdOrThrow(coachUserId);
    const appointment =
      await this.repo.findAppointmentLifecycleContextByIdOrThrow(appointmentId);

    this.assertCoachOwnership(appointment, coach.id);
    this.assertCompletionAllowed(appointment);

    return this.applyAppointmentCompletion(appointment, dto);
  }

  async completeAppointmentAsStaff(
    _actorId: string,
    appointmentId: string,
    dto: CompleteAppointmentDTO,
  ): Promise<AppointmentResponseDTO> {
    const appointment =
      await this.repo.findAppointmentLifecycleContextByIdOrThrow(appointmentId);

    this.assertCompletionAllowed(appointment);

    return this.applyAppointmentCompletion(appointment, dto);
  }

  async submitCoachFeedback(
    coachUserId: string,
    appointmentId: string,
    dto: SubmitCoachFeedbackDTO,
  ): Promise<AppointmentResponseDTO> {
    const coach = await this.repo.findCoachByUserIdOrThrow(coachUserId);
    const appointment =
      await this.repo.findAppointmentLifecycleContextByIdOrThrow(appointmentId);

    this.assertCoachOwnership(appointment, coach.id);

    const updated = await this.repo.updateAppointment(appointment.id, {
      coach_feedback: dto.coach_feedback,
      assessment_report: dto.assessment_report ?? null,
    });

    return this.toAppointmentResponse(updated);
  }

  async markCoachPayoutPaid(
    _actorId: string,
    appointmentId: string,
  ): Promise<AppointmentResponseDTO> {
    const appointment =
      await this.repo.findAppointmentLifecycleContextByIdOrThrow(appointmentId);

    if (appointment.status !== AppointmentStatus.completed) {
      throw new HttpException(
        {
          type: 'BUSINESS_RULE_VIOLATION',
          title: 'Coach Payout Not Ready',
          status: 422,
          detail:
            'Only completed coaching appointments can be marked as paid out.',
        },
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }

    if (appointment.coach_payout_paid_at) {
      throw new ConflictException({
        type: 'CONFLICT',
        title: 'Coach Payout Already Marked Paid',
        status: 409,
        detail: 'This coach payout has already been marked paid.',
      });
    }

    const updated = await this.repo.updateAppointment(appointment.id, {
      coach_payout_paid_at: new Date(),
    });

    return this.toAppointmentResponse(updated);
  }

  private async applyAppointmentResponse(
    actorId: string,
    appointment: AppointmentLifecycleRecord,
    dto: RespondAppointmentDTO,
  ): Promise<AppointmentResponseDTO> {
    if (dto.accepted) {
      const nextStatus = appointment.is_free_session
        ? AppointmentStatus.confirmed
        : appointment.downpayment_paid_at || appointment.balance_paid_at
          ? AppointmentStatus.confirmed
          : AppointmentStatus.pending_payment;
      const updated = await this.repo.updateAppointment(appointment.id, {
        status: nextStatus,
      });

      if (nextStatus === AppointmentStatus.confirmed) {
        this.emitAppointmentConfirmed({
          appointmentId: updated.id,
          userId: updated.user_id,
          coachId: updated.coach_id,
          scheduledAt: updated.scheduled_at.toISOString(),
          durationMinutes: updated.duration_minutes,
        });
      }

      return this.toAppointmentResponse(updated);
    }

    const cancelledAt = new Date();
    const updated = await this.repo.updateAppointment(appointment.id, {
      status: AppointmentStatus.cancelled,
      cancellation_reason: dto.rejection_reason ?? null,
      cancelled_at: cancelledAt,
    });

    this.emitAudit({
      userId: actorId,
      action: AuditAction.APPOINTMENT_CANCELLED,
      entity: 'CoachAppointment',
      entityId: appointment.id,
      before: this.toAppointmentAuditBefore(appointment),
      after: this.toAppointmentAuditAfter(
        AppointmentStatus.cancelled,
        cancelledAt,
        dto.rejection_reason ?? null,
      ),
    });
    this.emitAppointmentCancelled({
      appointmentId: updated.id,
      userId: updated.user_id,
      coachId: updated.coach_id,
      cancelledAt: cancelledAt.toISOString(),
    });

    return this.toAppointmentResponse(updated);
  }

  private async applyAppointmentCompletion(
    appointment: AppointmentLifecycleRecord,
    dto: CompleteAppointmentDTO,
  ): Promise<AppointmentResponseDTO> {
    const completedAt = new Date();
    const updated = await this.repo.updateAppointment(appointment.id, {
      status: AppointmentStatus.completed,
      session_notes: dto.session_notes ?? appointment.session_notes ?? null,
      coach_feedback: dto.coach_feedback ?? appointment.coach_feedback ?? null,
      assessment_report:
        dto.assessment_report ?? appointment.assessment_report ?? null,
      completed_at: completedAt,
      ...(appointment.recurring_plan_id
        ? { recurring_state: RecurringCoachingSessionState.completed }
        : {}),
    });

    if (appointment.recurring_plan_id) {
      await this.recurringPlanService.markWorkoutAssignmentCompleted({
        appointmentId: appointment.id,
        completedAt,
      });
    }

    this.emitAppointmentCompleted({
      appointmentId: updated.id,
      userId: updated.user_id,
      coachId: updated.coach_id,
      completedAt: completedAt.toISOString(),
    });
    await this.recurringPlanService.refreshPlanProgress(
      updated.recurring_plan_id,
    );

    return this.toAppointmentResponse(updated);
  }

  @OnEvent(PAYMENT_COMPLETED_EVENT, { async: true })
  async handlePaymentCompleted(event: PaymentCompletedEvent): Promise<void> {
    if (event.payableType !== PayableType.coaching) {
      return;
    }

    const payment = await this.paymentRepository.findPaymentByIdOrThrow(
      event.paymentId,
    );
    const appointment =
      await this.repo.findAppointmentLifecycleContextByIdOrThrow(
        event.payableId,
      );
    const paidAt = new Date();

    if (payment.payment_stage === PaymentStage.balance) {
      if (appointment.balance_paid_at) {
        return;
      }

      if (appointment.status !== AppointmentStatus.confirmed) {
        return;
      }

      await this.repo.updateAppointment(appointment.id, {
        balance_paid_at: paidAt,
      });
      return;
    }

    if (payment.payment_stage === PaymentStage.full) {
      if (appointment.downpayment_paid_at && appointment.balance_paid_at) {
        return;
      }

      if (appointment.status !== AppointmentStatus.pending_payment) {
        return;
      }

      const updated = await this.repo.updateAppointment(appointment.id, {
        status: AppointmentStatus.confirmed,
        downpayment_paid_at: appointment.downpayment_paid_at ?? paidAt,
        balance_paid_at: appointment.balance_paid_at ?? paidAt,
      });
      if (updated.status === AppointmentStatus.confirmed) {
        this.emitAppointmentConfirmed({
          appointmentId: updated.id,
          userId: updated.user_id,
          coachId: updated.coach_id,
          scheduledAt: updated.scheduled_at.toISOString(),
          durationMinutes: updated.duration_minutes,
        });
      }
      return;
    }

    if (appointment.downpayment_paid_at) {
      return;
    }

    if (appointment.status !== AppointmentStatus.pending_payment) {
      return;
    }

    const updated = await this.repo.updateAppointment(appointment.id, {
      status: AppointmentStatus.confirmed,
      downpayment_paid_at: paidAt,
    });
    if (updated.status === AppointmentStatus.confirmed) {
      this.emitAppointmentConfirmed({
        appointmentId: updated.id,
        userId: updated.user_id,
        coachId: updated.coach_id,
        scheduledAt: updated.scheduled_at.toISOString(),
        durationMinutes: updated.duration_minutes,
      });
    }
  }

  private normalizeAvailabilitySlots(
    dto: SetAvailabilityDTO,
  ): NormalizedAvailabilitySlot[] {
    const slots = dto.slots.map((slot) => {
      const startMinutes = this.toMinutes(slot.start_time);
      const endMinutes = this.toMinutes(slot.end_time);

      if (startMinutes >= endMinutes) {
        throw new HttpException(
          {
            type: 'BUSINESS_RULE_VIOLATION',
            title: 'Invalid Availability Window',
            status: 422,
            detail: 'Each availability slot must end after it starts.',
          },
          HttpStatus.UNPROCESSABLE_ENTITY,
        );
      }

      return {
        dayOfWeek: slot.day_of_week,
        startTime: slot.start_time,
        endTime: slot.end_time,
        startMinutes,
        endMinutes,
      };
    });

    slots.sort((left, right) => {
      if (left.dayOfWeek !== right.dayOfWeek) {
        return left.dayOfWeek - right.dayOfWeek;
      }

      return left.startMinutes - right.startMinutes;
    });

    for (let index = 1; index < slots.length; index += 1) {
      const previous = slots[index - 1];
      const current = slots[index];

      if (
        previous &&
        current.dayOfWeek === previous.dayOfWeek &&
        current.startMinutes < previous.endMinutes
      ) {
        throw new HttpException(
          {
            type: 'BUSINESS_RULE_VIOLATION',
            title: 'Overlapping Availability Slots',
            status: 422,
            detail:
              'Availability slots for the same day_of_week must not overlap.',
          },
          HttpStatus.UNPROCESSABLE_ENTITY,
        );
      }
    }

    return slots;
  }

  private parseScheduledAt(value: string): Date {
    const scheduledAt = new Date(value);

    if (Number.isNaN(scheduledAt.getTime())) {
      throw new HttpException(
        {
          type: 'BUSINESS_RULE_VIOLATION',
          title: 'Invalid Appointment Time',
          status: 422,
          detail: 'scheduled_at must be a valid ISO 8601 date string.',
        },
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }

    if (scheduledAt.getTime() <= Date.now()) {
      throw new HttpException(
        {
          type: 'BUSINESS_RULE_VIOLATION',
          title: 'Appointment Must Be In The Future',
          status: 422,
          detail: 'Appointments must be scheduled in the future.',
        },
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }

    return scheduledAt;
  }

  private buildUnavailableCoachError(): HttpException {
    return new HttpException(
      {
        type: 'BUSINESS_RULE_VIOLATION',
        title: 'Coach Unavailable',
        status: 422,
        detail:
          'The selected coach is not currently accepting appointment requests.',
      },
      HttpStatus.UNPROCESSABLE_ENTITY,
    );
  }

  private toAppointmentResponse(
    appointment: CoachAppointment | MemberAppointmentRecord,
    activePayment: ActiveAppointmentPayment | null = null,
  ): AppointmentResponseDTO {
    return {
      id: appointment.id,
      user_id: appointment.user_id,
      coach_id: appointment.coach_id,
      status: appointment.status,
      is_free_session: appointment.is_free_session,
      scheduled_at: appointment.scheduled_at.toISOString(),
      duration_minutes: appointment.duration_minutes,
      total_amount: appointment.total_amount.toString(),
      downpayment_amount: appointment.downpayment_amount.toString(),
      balance_amount: appointment.balance_amount.toString(),
      gym_revenue: toDecimalString(appointment.gym_revenue),
      coach_earnings: toDecimalString(appointment.coach_earnings),
      member_notes: appointment.member_notes ?? null,
      recurring_plan_id: appointment.recurring_plan_id ?? null,
      recurring_state: appointment.recurring_state ?? null,
      original_scheduled_at:
        appointment.original_scheduled_at?.toISOString() ?? null,
      downpayment_paid_at:
        appointment.downpayment_paid_at?.toISOString() ?? null,
      balance_paid_at: appointment.balance_paid_at?.toISOString() ?? null,
      active_payment_stage: activePayment?.payment_stage ?? null,
      active_payment_id: activePayment?.id ?? null,
      active_payment_status: activePayment?.status ?? null,
      active_payment_provider: activePayment?.provider ?? null,
      session_notes: appointment.session_notes ?? null,
      coach_feedback: appointment.coach_feedback ?? null,
      assessment_report: appointment.assessment_report ?? null,
      completed_at: appointment.completed_at?.toISOString() ?? null,
      coach_payout_paid_at:
        appointment.coach_payout_paid_at?.toISOString() ?? null,
      no_show_at: appointment.no_show_at?.toISOString() ?? null,
      cancellation_reason: appointment.cancellation_reason ?? null,
      cancelled_at: appointment.cancelled_at?.toISOString() ?? null,
      coach:
        'coach' in appointment && appointment.coach
          ? {
              id: appointment.coach.id,
              hourly_rate: appointment.coach.hourly_rate?.toString() ?? null,
              display_name: normalizeStandaloneDisplayName(
                appointment.coach.display_name,
              ),
              contact_email: appointment.coach.contact_email ?? null,
            }
          : null,
      review:
        'review' in appointment && appointment.review
          ? {
              id: appointment.review.id,
              rating: appointment.review.rating,
              comment: appointment.review.comment ?? null,
              created_at: appointment.review.created_at.toISOString(),
              updated_at: appointment.review.updated_at.toISOString(),
            }
          : null,
      created_at: appointment.created_at.toISOString(),
      updated_at: appointment.updated_at.toISOString(),
    };
  }

  private async toAppointmentResponseWithLatestPayment(
    appointment: CoachAppointment | AppointmentLifecycleRecord,
  ): Promise<AppointmentResponseDTO> {
    const latestPayments =
      await this.paymentRepository.findLatestPaymentsForPayableIds(
        PayableType.coaching,
        [appointment.id],
      );

    return this.toAppointmentResponse(appointment, latestPayments[0] ?? null);
  }

  private toCoachScheduleResponse(
    appointment: CoachScheduleRecord,
    activePayment: ActiveAppointmentPayment | null = null,
  ): CoachScheduleAppointmentResponseDTO {
    return {
      id: appointment.id,
      user_id: appointment.user_id,
      coach_id: appointment.coach_id,
      status: appointment.status,
      scheduled_at: appointment.scheduled_at.toISOString(),
      duration_minutes: appointment.duration_minutes,
      total_amount: appointment.total_amount.toString(),
      downpayment_amount: appointment.downpayment_amount.toString(),
      balance_amount: appointment.balance_amount.toString(),
      gym_revenue: toDecimalString(appointment.gym_revenue),
      coach_earnings: toDecimalString(appointment.coach_earnings),
      downpayment_paid_at:
        appointment.downpayment_paid_at?.toISOString() ?? null,
      balance_paid_at: appointment.balance_paid_at?.toISOString() ?? null,
      active_payment_stage: activePayment?.payment_stage ?? null,
      active_payment_id: activePayment?.id ?? null,
      active_payment_status: activePayment?.status ?? null,
      active_payment_provider: activePayment?.provider ?? null,
      member_notes: appointment.member_notes ?? null,
      session_notes: appointment.session_notes ?? null,
      coach_feedback: appointment.coach_feedback ?? null,
      assessment_report: appointment.assessment_report ?? null,
      completed_at: appointment.completed_at?.toISOString() ?? null,
      coach_payout_paid_at:
        appointment.coach_payout_paid_at?.toISOString() ?? null,
      no_show_at: appointment.no_show_at?.toISOString() ?? null,
      cancellation_reason: appointment.cancellation_reason ?? null,
      cancelled_at: appointment.cancelled_at?.toISOString() ?? null,
      recurring_plan_id: appointment.recurring_plan_id ?? null,
      recurring_state: appointment.recurring_state ?? null,
      original_scheduled_at:
        appointment.original_scheduled_at?.toISOString() ?? null,
      user: {
        id: appointment.user.id,
        email: findPrimaryIdentifier(appointment.user.auth_identities),
        profile: {
          first_name: appointment.user.profile?.first_name ?? null,
          last_name: appointment.user.profile?.last_name ?? null,
          avatar_url: appointment.user.profile?.avatar_url ?? null,
        },
      },
      review: appointment.review
        ? {
            id: appointment.review.id,
            rating: appointment.review.rating,
            comment: appointment.review.comment ?? null,
            created_at: appointment.review.created_at.toISOString(),
            updated_at: appointment.review.updated_at.toISOString(),
          }
        : null,
      created_at: appointment.created_at.toISOString(),
      updated_at: appointment.updated_at.toISOString(),
    };
  }

  private toStaffAppointmentResponse(
    appointment: StaffAppointmentRecord,
    activePayment: ActiveAppointmentPayment | null = null,
  ): StaffAppointmentResponseDTO {
    return {
      id: appointment.id,
      user_id: appointment.user_id,
      coach_id: appointment.coach_id,
      status: appointment.status,
      scheduled_at: appointment.scheduled_at.toISOString(),
      duration_minutes: appointment.duration_minutes,
      total_amount: appointment.total_amount.toString(),
      downpayment_amount: appointment.downpayment_amount.toString(),
      balance_amount: appointment.balance_amount.toString(),
      gym_revenue: toDecimalString(appointment.gym_revenue),
      coach_earnings: toDecimalString(appointment.coach_earnings),
      downpayment_paid_at:
        appointment.downpayment_paid_at?.toISOString() ?? null,
      balance_paid_at: appointment.balance_paid_at?.toISOString() ?? null,
      active_payment_stage: activePayment?.payment_stage ?? null,
      active_payment_id: activePayment?.id ?? null,
      active_payment_status: activePayment?.status ?? null,
      active_payment_provider: activePayment?.provider ?? null,
      member_notes: appointment.member_notes ?? null,
      session_notes: appointment.session_notes ?? null,
      coach_feedback: appointment.coach_feedback ?? null,
      assessment_report: appointment.assessment_report ?? null,
      completed_at: appointment.completed_at?.toISOString() ?? null,
      coach_payout_paid_at:
        appointment.coach_payout_paid_at?.toISOString() ?? null,
      no_show_at: appointment.no_show_at?.toISOString() ?? null,
      cancellation_reason: appointment.cancellation_reason ?? null,
      cancelled_at: appointment.cancelled_at?.toISOString() ?? null,
      recurring_plan_id: appointment.recurring_plan_id ?? null,
      recurring_state: appointment.recurring_state ?? null,
      original_scheduled_at:
        appointment.original_scheduled_at?.toISOString() ?? null,
      user: {
        id: appointment.user.id,
        email: findPrimaryIdentifier(appointment.user.auth_identities),
        profile: {
          first_name: appointment.user.profile?.first_name ?? null,
          last_name: appointment.user.profile?.last_name ?? null,
          avatar_url: appointment.user.profile?.avatar_url ?? null,
        },
      },
      coach: {
        id: appointment.coach.id,
        hourly_rate: appointment.coach.hourly_rate?.toString() ?? null,
        display_name: normalizeStandaloneDisplayName(
          appointment.coach.display_name,
        ),
        contact_email: appointment.coach.contact_email ?? null,
        profile: {
          first_name: null,
          last_name: null,
          avatar_url: null,
        },
      },
      review: appointment.review
        ? {
            id: appointment.review.id,
            rating: appointment.review.rating,
            comment: appointment.review.comment ?? null,
            created_at: appointment.review.created_at.toISOString(),
            updated_at: appointment.review.updated_at.toISOString(),
          }
        : null,
      created_at: appointment.created_at.toISOString(),
      updated_at: appointment.updated_at.toISOString(),
    };
  }

  private assertCoachOwnership(
    appointment: AppointmentLifecycleRecord,
    coachId: string,
  ): void {
    if (appointment.coach_id !== coachId) {
      throw new ForbiddenException({
        type: 'FORBIDDEN',
        title: 'Forbidden',
        status: 403,
        detail: 'You can only respond to your own appointment requests.',
      });
    }
  }

  private assertRescheduleOwnership(
    appointment: AppointmentLifecycleRecord,
    requesterId: string,
    role: UserRole,
  ): void {
    if (this.isStaffPaymentProcessor(role)) {
      return;
    }

    if (role === UserRole.coach && appointment.coach.user_id === requesterId) {
      return;
    }

    throw new ForbiddenException({
      type: 'FORBIDDEN',
      title: 'Forbidden',
      status: 403,
      detail:
        'Only the assigned coach or an admin/staff user can reschedule this appointment.',
    });
  }

  private assertPaidOneTimeAppointment(
    appointment: AppointmentLifecycleRecord,
  ): void {
    if (
      appointment.status !== AppointmentStatus.confirmed ||
      appointment.is_free_session ||
      Boolean(appointment.recurring_plan_id) ||
      Boolean(appointment.recurring_schedule_item_id)
    ) {
      throw new ConflictException({
        type: 'CONFLICT',
        title: 'Appointment Not Eligible For Reschedule',
        status: 409,
        detail:
          'Only paid, confirmed one-time coaching appointments can be rescheduled. This changes this session only.',
      });
    }
  }

  private assertAppointmentOwnership(
    appointment: AppointmentLifecycleRecord,
    userId: string,
  ): void {
    if (appointment.user_id !== userId) {
      throw new ForbiddenException({
        type: 'FORBIDDEN',
        title: 'Forbidden',
        status: 403,
        detail: 'You can only pay for your own coaching appointments.',
      });
    }
  }

  private assertAppointmentPaymentAccess(
    appointment: AppointmentLifecycleRecord,
    userId: string,
    role: UserRole,
  ): void {
    if (this.isStaffPaymentProcessor(role)) {
      return;
    }

    this.assertAppointmentOwnership(appointment, userId);
  }

  private assertMemberAppointmentPaymentPolicy(
    provider: PaymentProvider,
    paymentStage:
      | Extract<
          PaymentStage,
          typeof PaymentStage.downpayment | typeof PaymentStage.full
        >
      | undefined,
    role: UserRole,
  ): void {
    if (this.isStaffPaymentProcessor(role)) {
      return;
    }

    if (provider !== PaymentProvider.paymongo) {
      throw new ForbiddenException({
        type: 'FORBIDDEN',
        title: 'Online Payment Required',
        status: 403,
        detail:
          'Member and coach appointment payments must be completed in full through PayMongo. Cash is available through the cashier flow only.',
      });
    }

    if (paymentStage === PaymentStage.downpayment) {
      throw new HttpException(
        {
          type: 'BUSINESS_RULE_VIOLATION',
          title: 'Full Payment Required',
          status: 422,
          detail:
            'Appointment payments must be made in full before the appointment is confirmed.',
        },
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }
  }

  private resolveAppointmentInitialPaymentStage(
    paymentStage:
      | Extract<
          PaymentStage,
          typeof PaymentStage.downpayment | typeof PaymentStage.full
        >
      | undefined,
    role: UserRole,
  ): Extract<
    PaymentStage,
    typeof PaymentStage.downpayment | typeof PaymentStage.full
  > {
    if (!this.isStaffPaymentProcessor(role)) {
      return PaymentStage.full;
    }

    return paymentStage ?? PaymentStage.downpayment;
  }

  private isStaffPaymentProcessor(role: UserRole): boolean {
    return role === UserRole.admin || role === UserRole.staff;
  }

  private assertPendingCoachStatus(status: AppointmentStatus): void {
    if (status !== AppointmentStatus.pending_coach) {
      throw new HttpException(
        {
          type: 'BUSINESS_RULE_VIOLATION',
          title: 'Appointment Response Not Allowed',
          status: 422,
          detail:
            'Only legacy pending-coach appointments can be accepted or rejected.',
        },
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }
  }

  private assertRejectionReason(dto: RespondAppointmentDTO): void {
    if (!dto.accepted && !dto.rejection_reason) {
      throw new HttpException(
        {
          type: 'BUSINESS_RULE_VIOLATION',
          title: 'Rejection Reason Required',
          status: 422,
          detail: 'rejection_reason is required when accepted is false.',
        },
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }
  }

  private assertCancellationOwnership(
    appointment: AppointmentLifecycleRecord,
    requesterId: string,
    role: UserRole,
  ): void {
    if (role === UserRole.admin || role === UserRole.staff) {
      return;
    }

    if (role === UserRole.coach && appointment.coach.user_id === requesterId) {
      return;
    }

    if (appointment.user_id === requesterId) {
      return;
    }

    throw new ForbiddenException({
      type: 'FORBIDDEN',
      title: 'Forbidden',
      status: 403,
      detail: 'You do not have permission to cancel this appointment.',
    });
  }

  private assertCancellableStatus(status: AppointmentStatus): void {
    if (
      status !== AppointmentStatus.pending_coach &&
      status !== AppointmentStatus.pending_payment &&
      status !== AppointmentStatus.confirmed
    ) {
      throw new HttpException(
        {
          type: 'BUSINESS_RULE_VIOLATION',
          title: 'Appointment Cannot Be Cancelled',
          status: 422,
          detail:
            'Only pending, payment-pending, or confirmed appointments can be cancelled. Payment handling follows the applicable payment policy.',
        },
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }
  }

  private assertCancellationWindow(scheduledAt: Date): void {
    if (this.toGymDateKey(new Date()) < this.toGymDateKey(scheduledAt)) {
      return;
    }

    throw new HttpException(
      {
        type: 'BUSINESS_RULE_VIOLATION',
        title: 'Appointment Cannot Be Cancelled',
        status: 422,
        detail:
          'Coach appointments can only be cancelled until the day before the appointment date.',
      },
      HttpStatus.UNPROCESSABLE_ENTITY,
    );
  }

  private legacyCommercialRouteRetired(detail: string): GoneException {
    return new GoneException({
      type: 'GONE',
      title: 'Legacy Commercial Appointment Route Retired',
      status: 410,
      detail,
    });
  }

  private assertDownpaymentAllowed(
    appointment: AppointmentLifecycleRecord,
  ): void {
    if (
      appointment.is_free_session ||
      appointment.downpayment_amount.equals(0)
    ) {
      throw new HttpException(
        {
          type: 'BUSINESS_RULE_VIOLATION',
          title: 'No Downpayment Required',
          status: 422,
          detail: 'This coaching appointment does not require a downpayment.',
        },
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }

    if (appointment.downpayment_paid_at) {
      throw new ConflictException({
        type: 'CONFLICT',
        title: 'Downpayment Already Collected',
        status: 409,
        detail:
          'This coaching appointment already has a confirmed downpayment.',
      });
    }

    if (appointment.status !== AppointmentStatus.pending_payment) {
      throw new HttpException(
        {
          type: 'BUSINESS_RULE_VIOLATION',
          title: 'Downpayment Cannot Be Started',
          status: 422,
          detail:
            'Only coach-accepted appointments awaiting payment can start a downpayment.',
        },
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }
  }

  private assertBalanceCollectionAllowed(
    appointment: AppointmentLifecycleRecord,
  ): void {
    if (appointment.balance_amount.equals(0)) {
      throw new HttpException(
        {
          type: 'BUSINESS_RULE_VIOLATION',
          title: 'No Outstanding Balance',
          status: 422,
          detail:
            'This coaching appointment has no remaining balance to collect.',
        },
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }

    if (appointment.balance_paid_at) {
      throw new ConflictException({
        type: 'CONFLICT',
        title: 'Balance Already Collected',
        status: 409,
        detail:
          'This coaching appointment already has a recorded balance payment.',
      });
    }

    if (appointment.status !== AppointmentStatus.confirmed) {
      throw new HttpException(
        {
          type: 'BUSINESS_RULE_VIOLATION',
          title: 'Balance Cannot Be Collected',
          status: 422,
          detail:
            'Only confirmed coaching appointments can collect a remaining balance.',
        },
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }

    if (appointment.scheduled_at > new Date()) {
      throw new HttpException(
        {
          type: 'BUSINESS_RULE_VIOLATION',
          title: 'Balance Collection Not Yet Allowed',
          status: 422,
          detail:
            'Balance collection can only start on or after the appointment start time.',
        },
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }
  }

  private assertCompletionAllowed(
    appointment: AppointmentLifecycleRecord,
  ): void {
    if (appointment.status !== AppointmentStatus.confirmed) {
      throw new HttpException(
        {
          type: 'BUSINESS_RULE_VIOLATION',
          title: 'Appointment Cannot Be Completed',
          status: 422,
          detail: 'Only confirmed coaching appointments can be completed.',
        },
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }

    const appointmentEndsAt = new Date(
      appointment.scheduled_at.getTime() +
        appointment.duration_minutes * 60 * 1000,
    );

    if (appointmentEndsAt > new Date()) {
      throw new HttpException(
        {
          type: 'BUSINESS_RULE_VIOLATION',
          title: 'Appointment Not Finished Yet',
          status: 422,
          detail:
            'A coaching appointment can only be completed after its scheduled end time.',
        },
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }

    if (!appointment.balance_amount.equals(0) && !appointment.balance_paid_at) {
      throw new HttpException(
        {
          type: 'BUSINESS_RULE_VIOLATION',
          title: 'Outstanding Balance Required',
          status: 422,
          detail:
            'Paid coaching appointments must record the remaining balance before completion.',
        },
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }
  }

  private toAppointmentAuditBefore(
    appointment: Pick<
      CoachAppointment,
      'status' | 'cancelled_at' | 'cancellation_reason'
    >,
  ): Prisma.InputJsonValue {
    return {
      status: appointment.status,
      cancelled_at: appointment.cancelled_at?.toISOString() ?? null,
      cancellation_reason: appointment.cancellation_reason ?? null,
    } as Prisma.InputJsonValue;
  }

  private toAppointmentAuditAfter(
    status: AppointmentStatus,
    cancelledAt: Date,
    cancellationReason: string | null,
  ): Prisma.InputJsonValue {
    return {
      status,
      cancelled_at: cancelledAt.toISOString(),
      cancellation_reason: cancellationReason,
      refund: 'none',
    } as Prisma.InputJsonValue;
  }

  private emitAudit(event: AuditEvent): void {
    this.eventEmitter.emit('audit.log', event);
  }

  private emitAppointmentConfirmed(event: AppointmentConfirmedEvent): void {
    this.eventEmitter.emit(APPOINTMENT_CONFIRMED_EVENT, event);
  }

  private emitAppointmentCancelled(event: AppointmentCancelledEvent): void {
    this.eventEmitter.emit(APPOINTMENT_CANCELLED_EVENT, event);
  }

  private emitAppointmentCompleted(event: AppointmentCompletedEvent): void {
    this.eventEmitter.emit(APPOINTMENT_COMPLETED_EVENT, event);
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

  private assertSupportedDownpaymentProvider(provider: PaymentProvider): void {
    if (
      provider !== PaymentProvider.paymongo &&
      provider !== PaymentProvider.cash
    ) {
      throw new HttpException(
        {
          type: 'BUSINESS_RULE_VIOLATION',
          title: 'Unsupported Coaching Payment Provider',
          status: 422,
          detail:
            'Only PayMongo checkout and cash verification are supported for coaching payments.',
        },
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }
  }

  private assertInitialPaymentAllowed(
    appointment: AppointmentLifecycleRecord,
    paymentStage: InitialAppointmentPaymentStage,
  ): void {
    if (paymentStage === PaymentStage.downpayment) {
      this.assertDownpaymentAllowed(appointment);
      return;
    }

    if (appointment.is_free_session || appointment.total_amount.equals(0)) {
      throw new HttpException(
        {
          type: 'BUSINESS_RULE_VIOLATION',
          title: 'No Payment Required',
          status: 422,
          detail: 'This coaching appointment does not require a payment.',
        },
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }

    if (appointment.downpayment_paid_at || appointment.balance_paid_at) {
      throw new ConflictException({
        type: 'CONFLICT',
        title: 'Payment Already Collected',
        status: 409,
        detail:
          'This coaching appointment already has a recorded payment and cannot start a new full-payment request.',
      });
    }

    if (appointment.status !== AppointmentStatus.pending_payment) {
      throw new HttpException(
        {
          type: 'BUSINESS_RULE_VIOLATION',
          title: 'Payment Cannot Be Started',
          status: 422,
          detail:
            'Only coaching appointments in the pending-payment state can start a full payment.',
        },
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }
  }

  private async resumeExistingDownpaymentPayment(
    payment: Payment,
    userId: string,
    userRole: UserRole,
    expectedAppointmentId: string,
    provider: PaymentProvider,
    paymentStage: InitialAppointmentPaymentStage,
  ): Promise<AppointmentCheckoutResponseDTO> {
    if (
      (payment.user_id !== userId && !this.isStaffPaymentProcessor(userRole)) ||
      payment.payable_type !== PayableType.coaching
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
        title: 'Payment Provider Mismatch',
        status: 409,
        detail:
          'This Idempotency-Key is already associated with another coaching payment provider.',
      });
    }

    if (payment.payment_stage !== paymentStage) {
      throw new ConflictException({
        type: 'CONFLICT',
        title: 'Payment Stage Mismatch',
        status: 409,
        detail:
          'This Idempotency-Key is already associated with another coaching payment stage.',
      });
    }

    const appointment =
      await this.repo.findAppointmentLifecycleContextByIdOrThrow(
        payment.payable_id,
      );

    if (
      this.isStaffPaymentProcessor(userRole)
        ? appointment.id !== expectedAppointmentId
        : appointment.user_id !== userId
    ) {
      throw new ConflictException({
        type: 'CONFLICT',
        title: 'Appointment Ownership Conflict',
        status: 409,
        detail:
          'This Idempotency-Key is already associated with another members coaching appointment.',
      });
    }

    const checkoutUrl = this.extractCheckoutUrl(payment.gateway_metadata);

    if (payment.status === PaymentStatus.failed) {
      throw new ConflictException({
        type: 'CONFLICT',
        title: 'Payment Attempt Already Failed',
        status: 409,
        detail:
          'This Idempotency-Key belongs to a failed payment attempt. Start a new attempt with a new key.',
      });
    }

    if (payment.status === PaymentStatus.completed || checkoutUrl) {
      return {
        appointment_id: appointment.id,
        status: appointment.status,
        checkout_url: checkoutUrl,
        payment_id: payment.id,
      };
    }

    if (payment.provider === PaymentProvider.cash) {
      return {
        appointment_id: appointment.id,
        status: appointment.status,
        checkout_url: null,
        payment_id: payment.id,
      };
    }

    return this.startCheckoutForPayment(
      payment,
      appointment.id,
      appointment.status,
    );
  }

  private async resumeExistingBalancePayment(
    payment: Payment,
    appointment: AppointmentLifecycleRecord,
    provider: PaymentProvider,
  ): Promise<AppointmentCheckoutResponseDTO> {
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
        appointment_id: appointment.id,
        status: appointment.status,
        checkout_url: null,
        payment_id: payment.id,
      };
    }

    if (payment.status === PaymentStatus.completed || checkoutUrl) {
      return {
        appointment_id: appointment.id,
        status: appointment.status,
        checkout_url: checkoutUrl,
        payment_id: payment.id,
      };
    }

    return this.startCheckoutForPayment(
      payment,
      appointment.id,
      appointment.status,
    );
  }

  private async startCheckoutForPayment(
    payment: Payment,
    appointmentId: string,
    status: AppointmentStatus,
  ): Promise<AppointmentCheckoutResponseDTO> {
    const paymentLabel =
      payment.payment_stage === PaymentStage.balance
        ? 'balance'
        : payment.payment_stage === PaymentStage.full
          ? 'full payment'
          : 'downpayment';
    let checkout: PaymongoCheckoutResult;
    try {
      checkout = await this.paymongoCheckoutService.createCheckoutSession({
        amount: this.toMinorAmount(payment.amount),
        description: `Coaching appointment ${paymentLabel}`,
        idempotencyKey: payment.idempotency_key,
        metadata: {
          payment_id: payment.id,
          appointment_id: appointmentId,
        },
      });
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      throw new HttpException(
        {
          type: 'BAD_GATEWAY',
          title: 'Checkout Session Creation Failed',
          status: HttpStatus.BAD_GATEWAY,
          detail: 'Unable to start the PayMongo checkout session.',
        },
        HttpStatus.BAD_GATEWAY,
      );
    }

    await this.paymentRepository.updatePayment(
      payment.id,
      this.toCheckoutUpdateInput(checkout),
    );

    return {
      appointment_id: appointmentId,
      status,
      checkout_url: checkout.checkoutUrl,
      payment_id: payment.id,
    };
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

  private toMinutes(value: string): number {
    const [hours, minutes] = value.split(':').map((part) => Number(part));
    return hours * 60 + minutes;
  }

  private toTimeValue(value: string): Date {
    const [hours, minutes] = value.split(':').map((part) => Number(part));
    return new Date(Date.UTC(1970, 0, 1, hours, minutes, 0, 0));
  }

  private toGymWallClockDate(value: Date): Date {
    return new Date(value.getTime() + GYM_TIMEZONE_OFFSET_MINUTES * 60 * 1000);
  }

  private toGymDateKey(value: Date): string {
    return this.toGymWallClockDate(value).toISOString().slice(0, 10);
  }

  private toGymDayOfWeek(value: Date): number {
    return this.toGymWallClockDate(value).getUTCDay();
  }

  private toGymTimeString(value: Date): string {
    return this.toTimeString(this.toGymWallClockDate(value));
  }

  private toTimeString(value: Date): string {
    const hours = value.getUTCHours().toString().padStart(2, '0');
    const minutes = value.getUTCMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  }
}

function calculateAppointmentAmounts(
  coach: Pick<CoachProfile, 'hourly_rate' | 'gym_commission_pct'>,
  durationMinutes: number,
  isFreeSession: boolean,
): AppointmentAmounts {
  if (isFreeSession) {
    return {
      totalAmount: ZERO_DECIMAL,
      downpaymentAmount: ZERO_DECIMAL,
      balanceAmount: ZERO_DECIMAL,
      gymRevenue: ZERO_DECIMAL,
      coachEarnings: ZERO_DECIMAL,
    };
  }

  const totalAmount = new Prisma.Decimal(coach.hourly_rate)
    .mul(durationMinutes)
    .div(60)
    .toDecimalPlaces(2);
  const gymRevenue = totalAmount
    .mul(new Prisma.Decimal(coach.gym_commission_pct))
    .div(100)
    .toDecimalPlaces(2);
  const coachEarnings = totalAmount.minus(gymRevenue).toDecimalPlaces(2);
  const downpaymentAmount = totalAmount
    .mul(DOWNPAYMENT_RATE)
    .toDecimalPlaces(2);
  const balanceAmount = totalAmount.minus(downpaymentAmount).toDecimalPlaces(2);

  return {
    totalAmount,
    downpaymentAmount,
    balanceAmount,
    gymRevenue,
    coachEarnings,
  };
}
