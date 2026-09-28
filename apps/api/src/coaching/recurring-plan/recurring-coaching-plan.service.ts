import {
  ConflictException,
  ForbiddenException,
  GoneException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import {
  AppointmentStatus,
  CoachWorkoutAssignmentSource,
  CoachWorkoutAssignmentState,
  PayableType,
  PaymentProvider,
  PaymentStatus,
  Prisma,
  RecurringCoachingBillingCycleStatus,
  RecurringCoachingFrequency,
  RecurringCoachingPlanStatus,
  RecurringCoachingScheduleItemStatus,
  RecurringCoachingSessionState,
  UserRole,
} from '@prisma/client';
import { isUUID } from 'class-validator';

import type { JwtPayload } from '../../auth/types/jwt-payload.type';
import {
  PAYMENT_COMPLETED_EVENT,
  type PaymentCompletedEvent,
} from '../../membership/payment/events/payment-completed.event';
import { PaymentRepository } from '../../membership/payment/payment.repository';
import {
  CoachingCommerceService,
  CoachingCheckoutResponse,
} from '../commerce/coaching-commerce.service';
import { CoachAvailabilityService } from '../availability/coach-availability.service';
import {
  PaymongoCheckoutResult,
  PaymongoCheckoutService,
} from '../../membership/payment/paymongo-checkout.service';
import {
  BulkUpdateRecurringPlanSessionsDTO,
  CancelRecurringCoachingPlanDTO,
  CreateRecurringCoachingPlanDTO,
  CreateStaffRecurringCashEnrollmentDTO,
  EnrollRecurringCoachingPlanDTO,
  InitiateRecurringBillingCyclePaymentDTO,
  PreviewRecurringCoachingPlanDTO,
  RecurringCoachingBillingCycleResponseDTO,
  RecurringBillingCycleCheckoutResponseDTO,
  RecurringCoachingPlanBaseDTO,
  RecurringCoachingPlanResponseDTO,
  RecurringCoachingPlanSessionResponseDTO,
  RecurringCoachingScheduleItemResponseDTO,
  RecurringPlanSessionOverrideDTO,
  UpdateRecurringPlanSessionDTO,
} from './dto/recurring-coaching-plan.dto';
import {
  RECURRING_COACHING_ACTIVE_ENTITLEMENT_CONFLICT_TYPE,
  RecurringCoachingPlanRepository,
  RecurringClientProgram,
  RecurringPlanCoachContext,
  RecurringPlanWithSessions,
} from './recurring-coaching-plan.repository';

type GeneratedWorkout = {
  dayOfWeek: number;
  exerciseCount: number;
  exerciseNames: string[];
  id: string;
  label: string | null;
  weekNumber: number;
};

type GeneratedSessionDraft = {
  coachId: string;
  conflict: boolean;
  conflictReasons: string[];
  candidateIndex?: number;
  durationMinutes: number;
  endsAt: Date;
  originalScheduledAt: Date | null;
  scheduledAt: Date;
  selected?: boolean;
  state: RecurringCoachingSessionState;
  status: AppointmentStatus;
  workout?: GeneratedWorkout | null;
};

type PreviewSession = {
  candidate_index: number;
  coach_id: string;
  conflict: boolean;
  conflict_reasons: string[];
  date: string;
  duration_minutes: number;
  ends_at: string;
  original_scheduled_at: string | null;
  recurring_state: RecurringCoachingSessionState;
  selected: boolean;
  scheduled_at: string;
  status: AppointmentStatus | 'preview';
  time: string;
  workout: GeneratedWorkoutResponse | null;
};

type GeneratedWorkoutResponse = {
  day_of_week: number;
  exercise_count: number;
  exercise_names: string[];
  id: string;
  label: string | null;
  week_number: number;
};

const ZERO_DECIMAL = new Prisma.Decimal('0');
const MAX_GENERATED_SESSIONS = 120;
const MAX_SESSIONS_PER_GYM_WEEK = 5;
const GYM_TIMEZONE_OFFSET_MINUTES = 8 * 60;
const RECURRING_BILLING_GRACE_DAYS = 7;

@Injectable()
export class RecurringCoachingPlanService {
  constructor(
    private readonly repo: RecurringCoachingPlanRepository,
    private readonly paymentRepository: PaymentRepository,
    private readonly paymongoCheckoutService: PaymongoCheckoutService,
    private readonly commerceCheckoutService: CoachingCommerceService,
    private readonly coachAvailabilityService: CoachAvailabilityService,
  ) {}

  async enroll(
    actor: JwtPayload,
    dto: EnrollRecurringCoachingPlanDTO,
    idempotencyKey?: string,
  ): Promise<CoachingCheckoutResponse> {
    if (actor.role !== UserRole.member) {
      throw new ForbiddenException({
        type: 'FORBIDDEN',
        title: 'Member Enrollment Required',
        status: 403,
        detail: 'Only members can enroll in a recurring coaching offer.',
      });
    }

    await this.assertActiveMember(actor.sub);
    const coach = await this.assertCoachVisibleForNewPlan(dto.coach_id);
    const offer = this.assertMonthlyOffer(coach);
    const existing = await this.repo.findMemberCoachEnrollment({
      coachId: dto.coach_id,
      memberId: actor.sub,
    });

    if (
      existing &&
      (existing.status === RecurringCoachingPlanStatus.active ||
        existing.status === RecurringCoachingPlanStatus.paused)
    ) {
      throw this.buildActiveEntitlementConflict();
    }

    const { endDate, startDate } = this.getMonthlyPeriod(dto.start_date);
    return this.commerceCheckoutService.createMonthlyCheckout({
      amount: offer.monthlyRate,
      coachId: dto.coach_id,
      durationMinutes: offer.durationMinutes,
      endDate,
      returnTarget: dto.return_target,
      returnUrl: dto.return_url,
      idempotencyKey: idempotencyKey ?? '',
      sessionCount: offer.sessionCount,
      startDate,
      userId: actor.sub,
    });
  }

  async createStaffCashEnrollment(
    actor: JwtPayload,
    dto: CreateStaffRecurringCashEnrollmentDTO,
    idempotencyKey?: string,
  ) {
    if (actor.role !== UserRole.admin && actor.role !== UserRole.staff) {
      throw new ForbiddenException({
        type: 'FORBIDDEN',
        title: 'Staff Registration Required',
        status: 403,
        detail: 'Only admin or staff can register a cash enrollment.',
      });
    }
    if (!idempotencyKey || !isUUID(idempotencyKey.trim(), '4')) {
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

    await this.assertActiveMember(dto.member_id);
    const coach = await this.assertCoachVisibleForNewPlan(dto.coach_id);
    const offer = this.assertMonthlyOffer(coach);
    const existing = await this.repo.findMemberCoachEnrollment({
      coachId: dto.coach_id,
      memberId: dto.member_id,
    });
    if (
      existing &&
      (existing.status === RecurringCoachingPlanStatus.active ||
        existing.status === RecurringCoachingPlanStatus.paused)
    ) {
      throw this.buildActiveEntitlementConflict();
    }
    const { endDate, startDate } = this.getMonthlyPeriod(dto.start_date);
    return this.repo.createStaffCashEnrollment({
      actorId: actor.sub,
      amount: offer.monthlyRate,
      coachId: dto.coach_id,
      durationMinutes: offer.durationMinutes,
      endDate,
      idempotencyKey: idempotencyKey.trim(),
      memberId: dto.member_id,
      preferredDays: [],
      preferredTime: this.toTimeValue('00:00'),
      referenceNo: dto.reference_no,
      sessionCount: offer.sessionCount,
      startDate,
    });
  }

  async previewPlan(actor: JwtPayload, dto: PreviewRecurringCoachingPlanDTO) {
    await this.assertActiveMember(dto.member_id);
    const coach = await this.assertCoachVisibleForNewPlan(dto.coach_id);
    this.assertPlanCreator(actor, dto.member_id, coach);

    if (this.isDerivedMonthlyRequest(dto)) {
      this.assertFreshMonthlyPlanInput(dto);
      const offer = this.assertMonthlyOffer(coach);
      const period = this.getMonthlyPeriod(dto.start_date);
      const program = await this.assertClientProgram(
        dto.member_id,
        dto.training_plan_id!,
        this.requireCoachUserId(coach),
      );
      const candidates = await this.buildDerivedSessions({
        coach,
        coachId: dto.coach_id,
        durationMinutes: offer.durationMinutes,
        endDate: period.endDate,
        preferredTime: dto.preferred_time,
        program,
        startDate: period.startDate,
      });
      const selectedCandidates = this.selectGeneratedSessions(
        candidates,
        dto.selected_candidate_indexes,
        offer.sessionCount,
      );
      this.assertWeeklySessionLimit(selectedCandidates);
      return this.toPreviewResult(selectedCandidates, offer.sessionCount);
    }

    const normalized = this.normalizePlanInput(dto);
    const sessions = dto.schedule_items?.length
      ? await this.buildExplicitScheduleSessions({
          coachId: dto.coach_id,
          durationMinutes: normalized.durationMinutes,
          endDate: normalized.endDate,
          scheduleItems: dto.schedule_items,
          startDate: normalized.startDate,
        })
      : await this.buildGeneratedSessions({
          coachId: dto.coach_id,
          durationMinutes: normalized.durationMinutes,
          endDate: normalized.endDate,
          frequency: normalized.frequency,
          preferredDays: normalized.preferredDays,
          preferredTime: dto.preferred_time ?? '09:00',
          startDate: normalized.startDate,
        });

    if (!dto.schedule_items?.length) {
      const overridden = await this.applySessionOverrides(sessions, []);
      this.assertWeeklySessionLimit(overridden);
      return this.toPreviewResult(overridden);
    }

    this.assertWeeklySessionLimit(sessions);
    return this.toPreviewResult(sessions);
  }

  async createPlan(actor: JwtPayload, dto: CreateRecurringCoachingPlanDTO) {
    if (this.isDerivedMonthlyRequest(dto)) {
      return this.createDerivedPlan(actor, dto);
    }

    this.assertFreshMonthlyPlanInput(dto);
    await this.assertActiveMember(dto.member_id);
    const coach = await this.assertCoachVisibleForNewPlan(dto.coach_id);
    this.assertCoachPlanCreator(actor, coach);
    const offer = this.assertMonthlyOffer(coach);
    const monthlyRange = this.getExplicitMonthlyScheduleRange(
      dto.schedule_items!,
    );

    const normalized = this.normalizePlanInput({
      ...dto,
      duration_minutes: offer.durationMinutes,
      duration_months: 1,
      start_date: this.toDateString(monthlyRange.startDate),
      end_date: this.toDateString(monthlyRange.endDate),
    });

    const enrollment = await this.repo.findMemberCoachEnrollment({
      coachId: dto.coach_id,
      memberId: dto.member_id,
    });
    const paidCycle = this.assertPaidActiveUnscheduledEnrollment(enrollment);
    this.assertScheduleInsideEnrollmentWindow(
      dto.schedule_items!,
      enrollment!.start_date,
      enrollment!.end_date,
    );
    await this.assertCoachAuthoredTrainingPlan(dto, coach);

    if (
      normalized.endDate.getTime() >
      this.addMonths(normalized.startDate, 1).getTime()
    ) {
      throw new HttpException(
        {
          type: 'BUSINESS_RULE_VIOLATION',
          title: 'One-Month Plan Required',
          status: 422,
          detail:
            'New monthly coaching plans cannot extend beyond one month from their start date.',
        },
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }

    const sessions = await this.buildExplicitScheduleSessions({
      canonicalDurationMinutes: offer.durationMinutes,
      coachId: dto.coach_id,
      durationMinutes: offer.durationMinutes,
      endDate: normalized.endDate,
      scheduleItems: dto.schedule_items!,
      startDate: normalized.startDate,
    });

    this.assertWeeklySessionLimit(sessions);
    const unresolvedConflicts = sessions.filter(
      (session) =>
        session.conflict &&
        session.state !== RecurringCoachingSessionState.skipped,
    );
    if (unresolvedConflicts.length > 0) {
      throw new ConflictException({
        type: 'CONFLICT',
        title: 'Recurring Plan Conflicts',
        status: 409,
        detail:
          'Resolve conflicting sessions within the paid monthly enrollment before activating its schedule.',
        conflicts: unresolvedConflicts.map((session) =>
          this.toPreviewSession(session),
        ),
      });
    }

    const activeSessions = sessions.filter(
      (session) =>
        session.state !== RecurringCoachingSessionState.skipped &&
        session.state !== RecurringCoachingSessionState.cancelled,
    );
    if (activeSessions.length === 0) {
      throw new HttpException(
        {
          type: 'BUSINESS_RULE_VIOLATION',
          title: 'Empty Coaching Schedule',
          status: 422,
          detail:
            'A recurring coaching plan must contain at least one actual session.',
        },
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }

    if (activeSessions.length !== offer.sessionCount) {
      throw new HttpException(
        {
          type: 'BUSINESS_RULE_VIOLATION',
          title: 'Monthly Session Count Mismatch',
          status: 422,
          detail: `This coach monthly offer includes exactly ${offer.sessionCount} sessions.`,
        },
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }

    const quotedAmount = new Prisma.Decimal(paidCycle.amount);
    if (
      dto.quoted_amount !== undefined &&
      !new Prisma.Decimal(dto.quoted_amount).eq(quotedAmount)
    ) {
      throw new HttpException(
        {
          type: 'BUSINESS_RULE_VIOLATION',
          title: 'Monthly Quote Mismatch',
          status: 422,
          detail:
            'The recurring coaching quote must match the coach monthly offer.',
        },
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }

    const scheduleItems = this.buildScheduleItems({
      quotedAmount,
      sessions: activeSessions,
      sourceItems: dto.schedule_items,
    }).map((item) => ({
      ...item,
      status: RecurringCoachingScheduleItemStatus.activated,
    }));
    const plan = await this.repo.fillPaidPlanWithSessions({
      appointments: this.buildPaidAppointmentRows({
        coach,
        memberId: dto.member_id,
        paidAt: paidCycle.paid_at,
        scheduleItems,
        sessions: activeSessions,
      }),
      paidAt: paidCycle.paid_at,
      paidCycleId: paidCycle.id,
      planId: enrollment!.id,
      planUpdate: {
        coach_approved_at: new Date(),
        completed_sessions: 0,
        duration_minutes: offer.durationMinutes,
        end_date: enrollment!.end_date,
        frequency: RecurringCoachingFrequency.monthly,
        preferred_days: normalized.preferredDays,
        preferred_time: this.toTimeValue(dto.preferred_time ?? '09:00'),
        quoted_amount: quotedAmount,
        start_date: enrollment!.start_date,
        status: RecurringCoachingPlanStatus.active,
        total_sessions: activeSessions.length,
        training_plan: { connect: { id: dto.training_plan_id! } },
      },
      scheduleItems,
      trainingPlanId: dto.training_plan_id!,
    });

    return {
      plan: this.toPlanResponse(plan),
      sessions: plan.appointments.map((session) =>
        this.toSessionResponse(session),
      ),
    };
  }

  private async createDerivedPlan(
    actor: JwtPayload,
    dto: CreateRecurringCoachingPlanDTO,
  ) {
    this.assertFreshMonthlyPlanInput(dto);
    await this.assertActiveMember(dto.member_id);
    const coach = await this.assertCoachVisibleForNewPlan(dto.coach_id);
    this.assertCoachPlanCreator(actor, coach);
    const offer = this.assertMonthlyOffer(coach);
    const period = this.getMonthlyPeriod(dto.start_date);
    const program = await this.assertClientProgram(
      dto.member_id,
      dto.training_plan_id!,
      this.requireCoachUserId(coach),
    );
    const allCandidates = await this.buildDerivedSessions({
      coach,
      coachId: dto.coach_id,
      durationMinutes: offer.durationMinutes,
      endDate: period.endDate,
      preferredTime: dto.preferred_time,
      program,
      startDate: period.startDate,
    });
    const candidates = this.selectGeneratedSessions(
      allCandidates,
      dto.selected_candidate_indexes,
      offer.sessionCount,
    );
    const sessions = candidates.filter(
      (session) =>
        session.selected !== false &&
        session.state !== RecurringCoachingSessionState.skipped &&
        session.state !== RecurringCoachingSessionState.cancelled,
    );

    if (sessions.length === 0) {
      throw new HttpException(
        {
          type: 'BUSINESS_RULE_VIOLATION',
          title: 'Empty Coaching Schedule',
          status: 422,
          detail:
            'The selected client program does not provide a usable workout candidate for this coaching period.',
        },
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }

    this.assertWeeklySessionLimit(candidates);
    const unresolvedConflicts = sessions.filter((session) => session.conflict);
    if (unresolvedConflicts.length > 0) {
      throw new ConflictException({
        type: 'CONFLICT',
        title: 'Recurring Plan Conflicts',
        status: 409,
        detail:
          'Resolve conflicting generated workout sessions within the paid monthly enrollment before activating its schedule.',
        conflicts: unresolvedConflicts.map((session) =>
          this.toPreviewSession(session),
        ),
      });
    }

    const selectedCount = Math.min(sessions.length, offer.sessionCount);
    if (sessions.length > selectedCount) {
      throw new HttpException(
        {
          type: 'BUSINESS_RULE_VIOLATION',
          title: 'Selected Session Count Mismatch',
          status: 422,
          detail: `Only ${offer.sessionCount} generated sessions can be included in this monthly offer.`,
        },
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }

    const existingEnrollment = await this.repo.findMemberCoachEnrollment({
      coachId: dto.coach_id,
      memberId: dto.member_id,
    });
    const activeCycle = existingEnrollment?.billing_cycles.find(
      (cycle) =>
        cycle.status === RecurringCoachingBillingCycleStatus.paid &&
        cycle.paid_at !== null,
    );
    const currentCycle = existingEnrollment?.billing_cycles.find(
      (cycle) =>
        cycle.status !== RecurringCoachingBillingCycleStatus.cancelled &&
        cycle.status !== RecurringCoachingBillingCycleStatus.overdue,
    );
    const quotedAmount = new Prisma.Decimal(
      currentCycle?.amount ?? offer.monthlyRate,
    );

    if (
      dto.quoted_amount !== undefined &&
      !new Prisma.Decimal(dto.quoted_amount).eq(quotedAmount)
    ) {
      throw new HttpException(
        {
          type: 'BUSINESS_RULE_VIOLATION',
          title: 'Monthly Quote Mismatch',
          status: 422,
          detail:
            'The recurring coaching quote must match the coach monthly offer.',
        },
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }

    const scheduleItems = this.buildScheduleItems({
      quotedAmount,
      sessions,
    });
    const preferredDays = [
      ...new Set(
        sessions.map((session) => this.toGymDayOfWeek(session.scheduledAt)),
      ),
    ].sort((left, right) => left - right);
    const preferredTime = this.toGymTimeString(sessions[0].scheduledAt);
    const planUpdate: Prisma.RecurringCoachingPlanUpdateInput = {
      coach_approved_at: new Date(),
      completed_sessions: 0,
      duration_minutes: offer.durationMinutes,
      end_date: period.endDate,
      frequency: RecurringCoachingFrequency.monthly,
      preferred_days: preferredDays,
      preferred_time: this.toTimeValue(preferredTime),
      quoted_amount: quotedAmount,
      start_date: period.startDate,
      status: RecurringCoachingPlanStatus.awaiting_payment,
      total_sessions: sessions.length,
      training_plan: { connect: { id: dto.training_plan_id! } },
    };

    if (existingEnrollment) {
      if (
        existingEnrollment.status === RecurringCoachingPlanStatus.active &&
        activeCycle?.paid_at
      ) {
        const activatedItems = scheduleItems.map((item) => ({
          ...item,
          status: RecurringCoachingScheduleItemStatus.activated,
        }));
        const plan = await this.repo.fillPaidPlanWithSessions({
          appointments: this.buildPaidAppointmentRows({
            coach,
            memberId: dto.member_id,
            paidAt: activeCycle.paid_at,
            scheduleItems: activatedItems,
            sessions,
          }),
          paidAt: activeCycle.paid_at,
          paidCycleId: activeCycle.id,
          planId: existingEnrollment.id,
          planUpdate: {
            ...planUpdate,
            status: RecurringCoachingPlanStatus.active,
          },
          scheduleItems: activatedItems,
          trainingPlanId: dto.training_plan_id!,
        });
        return {
          plan: this.toPlanResponse(plan),
          sessions: plan.appointments.map((session) =>
            this.toSessionResponse(session),
          ),
        };
      }

      throw new ForbiddenException({
        type: 'FORBIDDEN',
        title: 'Full Payment Required',
        status: 403,
        detail:
          'A recurring coaching schedule cannot be persisted until the enrollment is active and its monthly cycle is fully paid.',
      });
    }

    throw new ForbiddenException({
      type: 'FORBIDDEN',
      title: 'Member Enrollment Required',
      status: 403,
      detail:
        'A recurring coaching schedule cannot be created before the member completes full payment for the monthly enrollment.',
    });
  }

  private toPreviewResult(
    sessions: GeneratedSessionDraft[],
    purchasedSessionCount?: number,
  ) {
    const selectedSessions = sessions.filter(
      (session) =>
        session.selected !== false &&
        session.state !== RecurringCoachingSessionState.skipped &&
        session.state !== RecurringCoachingSessionState.cancelled,
    );
    return {
      can_confirm:
        selectedSessions.length > 0 &&
        selectedSessions.every((session) => !session.conflict),
      candidate_count: sessions.length,
      conflict_count: selectedSessions.filter((session) => session.conflict)
        .length,
      eligible_session_count: sessions.filter(
        (session) =>
          session.state !== RecurringCoachingSessionState.skipped &&
          session.state !== RecurringCoachingSessionState.cancelled,
      ).length,
      purchased_session_count: purchasedSessionCount ?? selectedSessions.length,
      selected_session_count: selectedSessions.length,
      total_sessions: selectedSessions.length,
      venue_conflicts_checked: false,
      venue_conflicts_note:
        'Coach appointments do not currently reserve venues, so venue conflict checks are deferred.',
      sessions: sessions.map((session) => this.toPreviewSession(session)),
    };
  }

  private buildScheduleItems(input: {
    quotedAmount: Prisma.Decimal;
    sessions: GeneratedSessionDraft[];
    sourceItems?: CreateRecurringCoachingPlanDTO['schedule_items'];
  }): Omit<
    Prisma.RecurringCoachingScheduleItemCreateManyInput,
    'recurring_plan_id'
  >[] {
    const sourceItems = input.sourceItems
      ? [...input.sourceItems].sort(
          (left, right) => left.sequence_index - right.sequence_index,
        )
      : undefined;
    const providedAmounts = sourceItems?.map((item) => item.amount);
    const hasAllProvidedAmounts =
      Boolean(providedAmounts?.length) &&
      providedAmounts?.every((amount) => amount !== undefined);
    if (hasAllProvidedAmounts) {
      const providedTotal = providedAmounts.reduce(
        (total, amount) => total.plus(new Prisma.Decimal(amount ?? 0)),
        ZERO_DECIMAL,
      );
      if (!providedTotal.eq(input.quotedAmount)) {
        throw new HttpException(
          {
            type: 'BUSINESS_RULE_VIOLATION',
            title: 'Schedule Quote Mismatch',
            status: 422,
            detail:
              'The schedule item amounts must add up exactly to the fixed recurring coaching quote.',
          },
          HttpStatus.UNPROCESSABLE_ENTITY,
        );
      }
    }

    let allocated = ZERO_DECIMAL;
    return input.sessions.map((session, index) => {
      const source = sourceItems?.[index];
      const amount = hasAllProvidedAmounts
        ? new Prisma.Decimal(source?.amount ?? 0)
        : index === input.sessions.length - 1
          ? input.quotedAmount.minus(allocated).toDecimalPlaces(2)
          : input.quotedAmount.div(input.sessions.length).toDecimalPlaces(2);
      allocated = allocated.plus(amount);
      return {
        training_schedule_day_id: session.workout?.id ?? null,
        sequence_index: index + 1,
        scheduled_at: session.scheduledAt,
        duration_minutes: session.durationMinutes,
        amount,
        status: RecurringCoachingScheduleItemStatus.pending_payment,
      };
    });
  }

  private buildPaidAppointmentRows(input: {
    coach: RecurringPlanCoachContext;
    memberId: string;
    paidAt: Date;
    scheduleItems: Array<{
      amount?: Prisma.Decimal | Prisma.DecimalJsLike | number | string;
      duration_minutes?: number;
      scheduled_at: Date | string;
      sequence_index: number;
    }>;
    sessions: GeneratedSessionDraft[];
  }): Array<
    Omit<
      Prisma.CoachAppointmentCreateManyInput,
      'recurring_plan_id' | 'recurring_schedule_item_id'
    >
  > {
    return input.scheduleItems.map((item, index) => {
      const session = input.sessions[index];
      if (!session) {
        throw new HttpException(
          {
            type: 'BUSINESS_RULE_VIOLATION',
            title: 'Schedule Session Mismatch',
            status: 422,
            detail:
              'Every recurring coaching schedule item must have a matching session.',
          },
          HttpStatus.UNPROCESSABLE_ENTITY,
        );
      }

      const totalAmount = new Prisma.Decimal(
        (item.amount ?? 0) as Prisma.Decimal.Value,
      );
      const gymRevenue = totalAmount
        .mul(new Prisma.Decimal(input.coach.gym_commission_pct))
        .div(100)
        .toDecimalPlaces(2);

      return {
        user_id: input.memberId,
        coach_id: session.coachId,
        status: AppointmentStatus.confirmed,
        recurring_state: RecurringCoachingSessionState.generated,
        original_scheduled_at: null,
        is_free_session: false,
        scheduled_at:
          item.scheduled_at instanceof Date
            ? item.scheduled_at
            : new Date(item.scheduled_at),
        duration_minutes: item.duration_minutes ?? 60,
        total_amount: totalAmount,
        downpayment_amount: ZERO_DECIMAL,
        balance_amount: ZERO_DECIMAL,
        gym_revenue: gymRevenue,
        coach_earnings: totalAmount.minus(gymRevenue).toDecimalPlaces(2),
        downpayment_paid_at: input.paidAt,
        balance_paid_at: input.paidAt,
      };
    });
  }

  private buildEnrollmentBillingCycle(input: {
    amount: Prisma.Decimal;
    endDate: Date;
    startDate: Date;
  }): Omit<
    Prisma.RecurringCoachingBillingCycleCreateManyInput,
    'recurring_plan_id'
  > {
    const cycleStart = this.toDateOnlyValue(input.startDate);
    return {
      amount: input.amount,
      cycle_start_date: cycleStart,
      cycle_end_date: this.toDateOnlyValue(input.endDate),
      due_date: cycleStart,
      grace_period_ends_at: this.addDays(
        cycleStart,
        RECURRING_BILLING_GRACE_DAYS,
      ),
      status: RecurringCoachingBillingCycleStatus.due,
    };
  }

  private buildFixedQuoteBillingCycles(input: {
    endDate: Date;
    scheduleItems: Array<{
      amount?: Prisma.Decimal | Prisma.DecimalJsLike | number | string;
      scheduled_at: Date | string;
    }>;
    startDate: Date;
  }): Omit<
    Prisma.RecurringCoachingBillingCycleCreateManyInput,
    'recurring_plan_id'
  >[] {
    if (input.scheduleItems.length === 0) {
      return [];
    }

    const amount = input.scheduleItems
      .reduce(
        (total, item) =>
          total.plus(
            new Prisma.Decimal((item.amount ?? 0) as Prisma.Decimal.Value),
          ),
        ZERO_DECIMAL,
      )
      .toDecimalPlaces(2);
    const cycleStart = this.toDateOnlyValue(input.startDate);
    const cycleEnd = this.toDateOnlyValue(input.endDate);

    return [
      {
        amount,
        cycle_start_date: cycleStart,
        cycle_end_date: cycleEnd,
        due_date: cycleStart,
        grace_period_ends_at: this.addDays(
          cycleStart,
          RECURRING_BILLING_GRACE_DAYS,
        ),
        status: RecurringCoachingBillingCycleStatus.due,
      },
    ];
  }

  private async buildExplicitScheduleSessions(input: {
    canonicalDurationMinutes?: number;
    coachId: string;
    durationMinutes: number;
    endDate: Date;
    scheduleItems: NonNullable<
      CreateRecurringCoachingPlanDTO['schedule_items']
    >;
    startDate: Date;
  }): Promise<GeneratedSessionDraft[]> {
    const sorted = [...input.scheduleItems].sort(
      (left, right) => left.sequence_index - right.sequence_index,
    );
    const seen = new Set<string>();
    const sessions: GeneratedSessionDraft[] = [];
    for (const item of sorted) {
      const scheduledAt = this.parseDateTime(item.scheduled_at);
      const scheduledKey = scheduledAt.toISOString();
      if (seen.has(scheduledKey)) {
        throw new ConflictException({
          type: 'CONFLICT',
          title: 'Duplicate Schedule Slot',
          status: 409,
          detail:
            'A recurring coaching plan cannot contain duplicate session timestamps.',
        });
      }
      seen.add(scheduledKey);
      if (
        scheduledAt.getTime() < input.startDate.getTime() ||
        scheduledAt.getTime() >= this.addDays(input.endDate, 1).getTime()
      ) {
        throw new HttpException(
          {
            type: 'BUSINESS_RULE_VIOLATION',
            title: 'Schedule Outside Plan Window',
            status: 422,
            detail:
              'Every scheduled session must fall inside the plan date window.',
          },
          HttpStatus.UNPROCESSABLE_ENTITY,
        );
      }
      const durationMinutes =
        input.canonicalDurationMinutes ??
        item.duration_minutes ??
        input.durationMinutes;
      const validation = await this.validateSessionCandidate({
        coachId: input.coachId,
        durationMinutes,
        scheduledAt,
      });
      const session: GeneratedSessionDraft = {
        candidateIndex: sessions.length,
        coachId: input.coachId,
        conflict: validation.conflict,
        conflictReasons: validation.conflictReasons,
        durationMinutes,
        endsAt: this.addMinutes(scheduledAt, durationMinutes),
        originalScheduledAt: null,
        scheduledAt,
        selected: true,
        state: RecurringCoachingSessionState.generated,
        status: AppointmentStatus.confirmed,
        workout: null,
      };
      if (
        sessions.some(
          (previous) =>
            previous.scheduledAt < session.endsAt &&
            previous.endsAt > session.scheduledAt,
        )
      ) {
        session.conflict = true;
        session.conflictReasons.push('plan_session_overlap');
      }
      sessions.push(session);
    }
    return sessions;
  }

  initiateBillingCyclePayment(
    actor: JwtPayload,
    planId: string,
    cycleId: string,
    dto: InitiateRecurringBillingCyclePaymentDTO,
  ): Promise<RecurringBillingCycleCheckoutResponseDTO> {
    void actor;
    void planId;
    void cycleId;
    void dto;
    return Promise.reject(new GoneException({
      type: 'GONE',
      title: 'Recurring Billing-Cycle Payment Retired',
      status: 410,
      detail:
        'Product-visible recurring billing-cycle payment and cash-verification flows are retired. A new monthly enrollment must be completed through the full-payment enrollment checkout or atomic staff cash enrollment.',
    }));
  }

  @OnEvent(PAYMENT_COMPLETED_EVENT, { async: true })
  async handlePaymentCompleted(event: PaymentCompletedEvent): Promise<void> {
    if (event.payableType !== PayableType.recurring_coaching) {
      return;
    }

    const cycle = await this.repo.findBillingCycleByPaymentId(event.paymentId);
    if (!cycle || cycle.status === RecurringCoachingBillingCycleStatus.paid) {
      return;
    }

    await this.repo.completeBillingCycle({
      cycleId: cycle.id,
      paidAt: new Date(),
      paymentId: event.paymentId,
    });
  }

  runBillingOverdueCron(now = new Date()): Promise<number> {
    return this.repo.cancelOverdueBillingCycles(now);
  }

  async getPlanSessions(actor: JwtPayload, planId: string) {
    const plan = await this.findPlanOrThrow(planId);
    this.assertPlanVisibility(actor, plan);

    return {
      plan: this.toPlanResponse(plan),
      sessions: plan.appointments.map((session) =>
        this.toSessionResponse(session),
      ),
    };
  }

  async listPlans(actor: JwtPayload) {
    const plans =
      actor.role === UserRole.member
        ? await this.repo.listPlansForMember(actor.sub)
        : actor.role === UserRole.coach
          ? await this.repo.listPlansForCoachUser(actor.sub)
          : await this.repo.listPlansForOperations();
    return plans.map((plan) => this.toPlanResponse(plan));
  }

  async updateSingleSession(
    actor: JwtPayload,
    planId: string,
    sessionId: string,
    dto: UpdateRecurringPlanSessionDTO,
  ) {
    const plan = await this.findPlanOrThrow(planId);
    this.assertPlanManagementAccess(actor, plan);
    const session = await this.repo.findSessionForPlan({ planId, sessionId });

    if (!session || !session.recurring_plan) {
      throw this.notFound('Recurring coaching session not found.');
    }

    this.assertSessionEditable(session.status);

    if (dto.action === 'skip') {
      const skippedAt = new Date();
      const updated = await this.repo.updateSession(session.id, {
        status: AppointmentStatus.cancelled,
        recurring_state: RecurringCoachingSessionState.skipped,
        cancellation_reason: dto.reason ?? 'Skipped recurring session.',
        cancelled_at: skippedAt,
      });
      await this.repo.skipWorkoutAssignmentAndShift({
        appointmentId: session.id,
        planId,
        skippedAt,
      });
      return this.toSessionResponse(updated);
    }

    const nextScheduledAt = this.parseDateTime(dto.new_scheduled_at);
    const nextCoachId = dto.coach_id ?? session.coach_id;
    const nextEndsAt = this.addMinutes(
      nextScheduledAt,
      session.duration_minutes,
    );
    const candidate = await this.validateSessionCandidate({
      coachId: nextCoachId,
      durationMinutes: session.duration_minutes,
      excludeAppointmentIds: [session.id],
      scheduledAt: nextScheduledAt,
    });

    if (candidate.conflict) {
      throw this.buildConflict(candidate);
    }

    const updated = await this.repo.updateSession(session.id, {
      coach: { connect: { id: nextCoachId } },
      scheduled_at: nextScheduledAt,
      original_scheduled_at:
        session.original_scheduled_at ?? session.scheduled_at,
      recurring_state: RecurringCoachingSessionState.individually_rescheduled,
      status: AppointmentStatus.confirmed,
      cancelled_at: null,
      cancellation_reason: null,
    });

    return this.toSessionResponse({
      ...updated,
      recurring_plan_id: planId,
      scheduled_at: nextScheduledAt,
      duration_minutes: Math.round(
        (nextEndsAt.getTime() - nextScheduledAt.getTime()) / 60_000,
      ),
    });
  }

  async bulkUpdateFutureSessions(
    actor: JwtPayload,
    planId: string,
    dto: BulkUpdateRecurringPlanSessionsDTO,
  ) {
    const plan = await this.findPlanOrThrow(planId);
    this.assertPlanManagementAccess(actor, plan);

    const fromSession = plan.appointments.find(
      (session) => session.id === dto.from_session_id,
    );

    if (!fromSession) {
      throw this.notFound('Starting session not found for this plan.');
    }

    const futureSessions = plan.appointments.filter(
      (session) =>
        session.scheduled_at.getTime() >= fromSession.scheduled_at.getTime() &&
        session.status !== AppointmentStatus.completed &&
        session.status !== AppointmentStatus.cancelled,
    );

    if (futureSessions.length === 0) {
      return {
        plan: this.toPlanResponse(plan),
        sessions: plan.appointments.map((session) =>
          this.toSessionResponse(session),
        ),
      };
    }

    const preferredDays = this.normalizePreferredDays(
      dto.preferred_days ?? plan.preferred_days,
    );
    const preferredTime =
      dto.preferred_time ?? this.toTimeString(plan.preferred_time);
    const frequency = dto.frequency ?? plan.frequency;
    const coachId = dto.coach_id ?? plan.coach_id;
    const replacementSchedule = await this.buildGeneratedSessions({
      coachId,
      durationMinutes: plan.duration_minutes,
      endDate: plan.end_date,
      frequency,
      preferredDays,
      preferredTime,
      startDate: this.toDateOnlyValue(fromSession.scheduled_at),
      excludeAppointmentIds: futureSessions.map((session) => session.id),
    });
    const usableReplacementSessions = replacementSchedule
      .filter(
        (session) => session.state !== RecurringCoachingSessionState.skipped,
      )
      .slice(0, futureSessions.length);

    this.assertWeeklySessionLimit(usableReplacementSessions);

    if (usableReplacementSessions.length < futureSessions.length) {
      throw new HttpException(
        {
          type: 'BUSINESS_RULE_VIOLATION',
          title: 'Not Enough Future Slots',
          status: 422,
          detail:
            'The updated recurrence pattern does not generate enough future sessions before the plan end date.',
        },
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }

    const conflicts = usableReplacementSessions.filter(
      (session) => session.conflict,
    );

    if (conflicts.length > 0) {
      return {
        can_confirm: false,
        conflict_count: conflicts.length,
        sessions: usableReplacementSessions.map((session) =>
          this.toPreviewSession(session),
        ),
      };
    }

    const updated = await this.repo.bulkRescheduleSessions({
      planId,
      planUpdate: {
        coach: { connect: { id: coachId } },
        frequency,
        preferred_days: preferredDays,
        preferred_time: this.toTimeValue(preferredTime),
      },
      sessions: futureSessions.map((session, index) => {
        const replacement = usableReplacementSessions[index];
        return {
          coachId: replacement.coachId,
          originalScheduledAt:
            session.original_scheduled_at ?? session.scheduled_at,
          scheduledAt: replacement.scheduledAt,
          sessionId: session.id,
        };
      }),
    });

    return {
      plan: this.toPlanResponse(updated),
      sessions: updated.appointments.map((session) =>
        this.toSessionResponse(session),
      ),
    };
  }

  async cancelPlan(
    actor: JwtPayload,
    planId: string,
    dto: CancelRecurringCoachingPlanDTO,
  ) {
    const plan = await this.findPlanOrThrow(planId);
    this.assertPlanCancellationAccess(actor, plan);

    if (plan.status === RecurringCoachingPlanStatus.cancelled) {
      throw new ConflictException({
        type: 'CONFLICT',
        title: 'Plan Already Cancelled',
        status: 409,
        detail: 'This recurring coaching plan is already cancelled.',
      });
    }

    const cancelled = await this.repo.cancelPlan({
      cancelledAt: new Date(),
      planId,
      reason: dto.reason,
    });

    return {
      plan: this.toPlanResponse(cancelled),
      sessions: cancelled.appointments.map((session) =>
        this.toSessionResponse(session),
      ),
    };
  }

  async refreshPlanProgress(planId: string | null | undefined): Promise<void> {
    if (!planId) return;
    await this.repo.refreshPlanProgress(planId);
  }

  async markWorkoutAssignmentCompleted(input: {
    appointmentId: string;
    completedAt: Date;
  }): Promise<void> {
    await this.repo.markWorkoutAssignmentCompleted(input);
  }

  private isDerivedMonthlyRequest(dto: RecurringCoachingPlanBaseDTO): boolean {
    return (
      (dto.frequency === undefined ||
        dto.frequency === RecurringCoachingFrequency.monthly) &&
      Boolean(dto.training_plan_id) &&
      !dto.schedule_items?.length
    );
  }

  private async assertClientProgram(
    memberId: string,
    trainingPlanId: string,
    coachUserId: string,
  ): Promise<RecurringClientProgram> {
    const program = await this.repo.findClientProgram({
      coachUserId,
      memberId,
      trainingPlanId,
    });
    if (!program) {
      throw new HttpException(
        {
          type: 'BUSINESS_RULE_VIOLATION',
          title: 'Client Program Not Found',
          status: 422,
          detail:
            'The selected client program must belong to the member and cannot be a template.',
        },
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }

    if (!program.schedule_days.some((day) => day.exercises.length > 0)) {
      throw new HttpException(
        {
          type: 'BUSINESS_RULE_VIOLATION',
          title: 'Client Program Has No Workouts',
          status: 422,
          detail:
            'The selected client program must contain at least one workout with exercises.',
        },
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }

    return program;
  }

  private requireCoachUserId(coach: RecurringPlanCoachContext): string {
    if (coach.user_id) return coach.user_id;

    throw new HttpException(
      {
        type: 'BUSINESS_RULE_VIOLATION',
        title: 'Coach Account Required',
        status: 422,
        detail: 'The selected coach must be linked to an authenticated user.',
      },
      HttpStatus.UNPROCESSABLE_ENTITY,
    );
  }

  private async buildDerivedSessions(input: {
    coach: RecurringPlanCoachContext;
    coachId: string;
    durationMinutes: number;
    endDate: Date;
    preferredTime?: string;
    program: RecurringClientProgram;
    startDate: Date;
  }): Promise<GeneratedSessionDraft[]> {
    const scheduleDays = input.program.schedule_days.filter(
      (day) => day.exercises.length > 0,
    );
    const weekNumbers = [
      ...new Set(scheduleDays.map((day) => day.week_number)),
    ].sort((left, right) => left - right);
    const startWeek = this.weekStartUtc(input.startDate);
    const sessions: GeneratedSessionDraft[] = [];

    for (
      let cursor = new Date(input.startDate);
      cursor.getTime() <= input.endDate.getTime();
      cursor = this.addDays(cursor, 1)
    ) {
      const weekIndex = Math.max(
        0,
        Math.floor(
          (this.weekStartUtc(cursor).getTime() - startWeek.getTime()) /
            (7 * 24 * 60 * 60 * 1000),
        ),
      );
      const weekNumber =
        weekNumbers[Math.min(weekIndex, weekNumbers.length - 1)];
      const dayOfWeek = this.toGymDayOfWeek(cursor);
      const scheduleDay = scheduleDays.find(
        (day) =>
          day.week_number === weekNumber && day.day_of_week === dayOfWeek,
      );
      if (!scheduleDay) {
        continue;
      }

      const time =
        input.preferredTime ??
        this.toTimeString(
          input.coach.availability_slots.find(
            (slot) => slot.day_of_week === dayOfWeek,
          )?.start_time ?? this.toTimeValue('09:00'),
        );
      const scheduledAt = this.combineDateAndTime(cursor, time);
      const validation = await this.validateSessionCandidate({
        coachId: input.coachId,
        durationMinutes: input.durationMinutes,
        scheduledAt,
      });
      const session: GeneratedSessionDraft = {
        candidateIndex: sessions.length,
        coachId: input.coachId,
        conflict: validation.conflict,
        conflictReasons: validation.conflictReasons,
        durationMinutes: input.durationMinutes,
        endsAt: this.addMinutes(scheduledAt, input.durationMinutes),
        originalScheduledAt: null,
        scheduledAt,
        selected: true,
        state: RecurringCoachingSessionState.generated,
        status: AppointmentStatus.confirmed,
        workout: {
          dayOfWeek: scheduleDay.day_of_week,
          exerciseCount: scheduleDay.exercises.length,
          exerciseNames: scheduleDay.exercises.map(
            (exercise) => exercise.exercise.name,
          ),
          id: scheduleDay.id,
          label: scheduleDay.focus_label,
          weekNumber: scheduleDay.week_number,
        },
      };

      if (
        sessions.some(
          (previous) =>
            previous.scheduledAt < session.endsAt &&
            previous.endsAt > session.scheduledAt,
        )
      ) {
        session.conflict = true;
        session.conflictReasons.push('plan_session_overlap');
      }
      sessions.push(session);

      if (sessions.length > MAX_GENERATED_SESSIONS) {
        throw new HttpException(
          {
            type: 'BUSINESS_RULE_VIOLATION',
            title: 'Too Many Sessions',
            status: 422,
            detail: `Recurring plans may generate at most ${MAX_GENERATED_SESSIONS} sessions.`,
          },
          HttpStatus.UNPROCESSABLE_ENTITY,
        );
      }
    }

    if (sessions.length === 0) {
      throw new HttpException(
        {
          type: 'BUSINESS_RULE_VIOLATION',
          title: 'No Workout Sessions Generated',
          status: 422,
          detail:
            'The selected client program has no workout days inside the requested coaching period.',
        },
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }

    return sessions;
  }

  private selectGeneratedSessions(
    sessions: GeneratedSessionDraft[],
    requestedIndexes: number[] | undefined,
    purchasedSessionCount: number,
  ): GeneratedSessionDraft[] {
    const candidates = sessions.filter(
      (session) =>
        session.state !== RecurringCoachingSessionState.skipped &&
        session.state !== RecurringCoachingSessionState.cancelled,
    );
    const candidateIndexes = new Set(
      candidates.map((session, index) => session.candidateIndex ?? index),
    );
    let selectedIndexes = requestedIndexes
      ? [...new Set(requestedIndexes)]
      : candidates
          .slice(0, purchasedSessionCount)
          .map((session, index) => session.candidateIndex ?? index);

    if (selectedIndexes.some((index) => !candidateIndexes.has(index))) {
      throw new HttpException(
        {
          type: 'BUSINESS_RULE_VIOLATION',
          title: 'Invalid Workout Candidate Selection',
          status: 422,
          detail:
            'selected_candidate_indexes must reference generated workout candidates from the preview.',
        },
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }

    selectedIndexes = selectedIndexes.slice(0, purchasedSessionCount);
    const selected = new Set(selectedIndexes);
    return sessions.map((session, index) => ({
      ...session,
      candidateIndex: session.candidateIndex ?? index,
      selected: selected.has(session.candidateIndex ?? index),
    }));
  }

  private async buildGeneratedSessions(input: {
    coachId: string;
    durationMinutes: number;
    endDate: Date;
    excludeAppointmentIds?: string[];
    frequency: RecurringCoachingFrequency;
    preferredDays: number[];
    preferredTime: string;
    startDate: Date;
  }): Promise<GeneratedSessionDraft[]> {
    const sessions: GeneratedSessionDraft[] = [];
    const startWeek = this.weekStartUtc(input.startDate);

    for (
      let cursor = new Date(input.startDate);
      cursor.getTime() <= input.endDate.getTime();
      cursor = this.addDays(cursor, 1)
    ) {
      if (!input.preferredDays.includes(cursor.getUTCDay())) {
        continue;
      }

      const weekDelta = Math.floor(
        (this.weekStartUtc(cursor).getTime() - startWeek.getTime()) /
          (7 * 24 * 60 * 60 * 1000),
      );

      if (
        input.frequency === RecurringCoachingFrequency.biweekly &&
        weekDelta % 2 !== 0
      ) {
        continue;
      }

      const scheduledAt = this.combineDateAndTime(cursor, input.preferredTime);
      const candidate = await this.validateSessionCandidate({
        coachId: input.coachId,
        durationMinutes: input.durationMinutes,
        excludeAppointmentIds: input.excludeAppointmentIds,
        scheduledAt,
      });

      sessions.push({
        candidateIndex: sessions.length,
        coachId: input.coachId,
        conflict: candidate.conflict,
        conflictReasons: candidate.conflictReasons,
        durationMinutes: input.durationMinutes,
        endsAt: this.addMinutes(scheduledAt, input.durationMinutes),
        originalScheduledAt: null,
        scheduledAt,
        selected: true,
        state: RecurringCoachingSessionState.generated,
        status: AppointmentStatus.confirmed,
        workout: null,
      });

      if (sessions.length > MAX_GENERATED_SESSIONS) {
        throw new HttpException(
          {
            type: 'BUSINESS_RULE_VIOLATION',
            title: 'Too Many Sessions',
            status: 422,
            detail: `Recurring plans may generate at most ${MAX_GENERATED_SESSIONS} sessions.`,
          },
          HttpStatus.UNPROCESSABLE_ENTITY,
        );
      }
    }

    if (sessions.length === 0) {
      throw new HttpException(
        {
          type: 'BUSINESS_RULE_VIOLATION',
          title: 'No Sessions Generated',
          status: 422,
          detail:
            'The selected dates, days, and frequency do not generate any sessions.',
        },
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }

    return sessions;
  }

  private async applySessionOverrides(
    sessions: GeneratedSessionDraft[],
    overrides: RecurringPlanSessionOverrideDTO[],
  ): Promise<GeneratedSessionDraft[]> {
    const sessionMap = new Map(
      sessions.map((session) => [session.scheduledAt.toISOString(), session]),
    );
    const nextSessions = [...sessions];

    for (const override of overrides) {
      const original = sessionMap.get(
        this.parseDateTime(override.scheduled_at).toISOString(),
      );

      if (!original) {
        throw new HttpException(
          {
            type: 'BUSINESS_RULE_VIOLATION',
            title: 'Unknown Session Override',
            status: 422,
            detail:
              'A session override references a scheduled_at value not present in the generated preview.',
          },
          HttpStatus.UNPROCESSABLE_ENTITY,
        );
      }

      const index = nextSessions.indexOf(original);

      if (override.action === 'skip') {
        nextSessions[index] = {
          ...original,
          conflict: false,
          conflictReasons: [],
          state: RecurringCoachingSessionState.skipped,
          status: AppointmentStatus.cancelled,
        };
        continue;
      }

      if (override.action === 'schedule') {
        continue;
      }

      const scheduledAt = override.new_scheduled_at
        ? this.parseDateTime(override.new_scheduled_at)
        : original.scheduledAt;
      const coachId = override.coach_id ?? original.coachId;
      const candidate = await this.validateSessionCandidate({
        coachId,
        durationMinutes: original.durationMinutes,
        scheduledAt,
      });

      nextSessions[index] = {
        coachId,
        conflict: candidate.conflict,
        conflictReasons: candidate.conflictReasons,
        durationMinutes: original.durationMinutes,
        endsAt: this.addMinutes(scheduledAt, original.durationMinutes),
        originalScheduledAt: original.scheduledAt,
        scheduledAt,
        state: RecurringCoachingSessionState.individually_rescheduled,
        status: AppointmentStatus.confirmed,
      };
    }

    return nextSessions;
  }

  private async validateSessionCandidate(input: {
    coachId: string;
    durationMinutes: number;
    excludeAppointmentIds?: string[];
    scheduledAt: Date;
  }) {
    const conflictReasons: string[] = [];
    const coach = await this.repo.findCoachContext(input.coachId);
    if (!coach) {
      return {
        conflict: true,
        conflictReasons: ['coach_not_found'],
      };
    }

    const availability = await this.coachAvailabilityService.check({
      coachId: input.coachId,
      durationMinutes: input.durationMinutes,
      excludeAppointmentIds: input.excludeAppointmentIds,
      startsAt: input.scheduledAt,
    });
    conflictReasons.push(...availability.conflictReasons);

    return {
      conflict: conflictReasons.length > 0,
      conflictReasons,
    };
  }

  private coachHasAvailability(
    coach: RecurringPlanCoachContext,
    startsAt: Date,
    endsAt: Date,
  ) {
    const slotStart = this.toTimeValue(this.toGymTimeString(startsAt));
    const slotEnd = this.toTimeValue(this.toGymTimeString(endsAt));

    return coach.availability_slots.some(
      (slot) =>
        slot.day_of_week === this.toGymDayOfWeek(startsAt) &&
        slot.start_time.getTime() <= slotStart.getTime() &&
        slot.end_time.getTime() >= slotEnd.getTime(),
    );
  }

  private normalizePlanInput(dto: RecurringCoachingPlanBaseDTO) {
    const startDate = this.toDateOnlyValue(this.parseDateOnly(dto.start_date));
    const endDate = dto.end_date
      ? this.toDateOnlyValue(this.parseDateOnly(dto.end_date))
      : this.addDays(this.addMonths(startDate, dto.duration_months ?? 1), -1);
    const today = this.getCurrentGymDateOnly();

    if (startDate.getTime() < today.getTime()) {
      throw new HttpException(
        {
          type: 'BUSINESS_RULE_VIOLATION',
          title: 'Invalid Recurring Plan Window',
          status: 422,
          detail: 'start_date must be today or later.',
        },
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }

    if (endDate.getTime() < startDate.getTime()) {
      throw new HttpException(
        {
          type: 'BUSINESS_RULE_VIOLATION',
          title: 'Invalid Recurring Plan Window',
          status: 422,
          detail: 'end_date must be on or after start_date.',
        },
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }

    const preferredDays = dto.schedule_items?.length
      ? [...new Set(dto.preferred_days ?? [])].sort(
          (left, right) => left - right,
        )
      : this.normalizePreferredDays(dto.preferred_days ?? []);

    return {
      durationMinutes: dto.duration_minutes ?? 60,
      endDate,
      frequency: dto.frequency ?? RecurringCoachingFrequency.monthly,
      preferredDays,
      startDate,
    };
  }

  private normalizePreferredDays(days: number[]) {
    const normalized = [...new Set(days)].sort((left, right) => left - right);
    if (normalized.length > MAX_SESSIONS_PER_GYM_WEEK) {
      throw new HttpException(
        {
          type: 'BUSINESS_RULE_VIOLATION',
          title: 'Weekly Session Limit Exceeded',
          status: 422,
          detail: `Recurring coaching plans may schedule at most ${MAX_SESSIONS_PER_GYM_WEEK} sessions per gym week.`,
        },
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }
    return normalized;
  }

  private assertWeeklySessionLimit(sessions: readonly GeneratedSessionDraft[]) {
    const counts = new Map<string, number>();
    for (const session of sessions) {
      if (
        session.state === RecurringCoachingSessionState.skipped ||
        session.state === RecurringCoachingSessionState.cancelled ||
        session.status === AppointmentStatus.cancelled ||
        session.selected === false
      ) {
        continue;
      }

      const weekKey = this.weekStartUtc(session.scheduledAt).toISOString();
      const nextCount = (counts.get(weekKey) ?? 0) + 1;
      if (nextCount > MAX_SESSIONS_PER_GYM_WEEK) {
        throw new HttpException(
          {
            type: 'BUSINESS_RULE_VIOLATION',
            title: 'Weekly Session Limit Exceeded',
            status: 422,
            detail: `Recurring coaching plans may schedule at most ${MAX_SESSIONS_PER_GYM_WEEK} sessions per gym week.`,
            week_start: weekKey.slice(0, 10),
          },
          HttpStatus.UNPROCESSABLE_ENTITY,
        );
      }
      counts.set(weekKey, nextCount);
    }
  }

  private assertFreshMonthlyPlanInput(
    dto: CreateRecurringCoachingPlanDTO,
  ): void {
    if (
      dto.frequency !== undefined &&
      dto.frequency !== RecurringCoachingFrequency.monthly
    ) {
      throw new HttpException(
        {
          type: 'BUSINESS_RULE_VIOLATION',
          title: 'Monthly Plans Only',
          status: 422,
          detail:
            'New recurring coaching plans must use the monthly coach offer. Legacy weekly and biweekly plans remain readable only.',
        },
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }

    if (dto.duration_months !== undefined && dto.duration_months !== 1) {
      throw new HttpException(
        {
          type: 'BUSINESS_RULE_VIOLATION',
          title: 'One-Month Plan Required',
          status: 422,
          detail: 'New monthly coaching plans must cover exactly one month.',
        },
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }

    if (
      !dto.schedule_items?.length &&
      (!dto.preferred_time || dto.preferred_time.trim() === '00:00')
    ) {
      throw new HttpException(
        {
          type: 'BUSINESS_RULE_VIOLATION',
          title: 'Monthly Session Time Required',
          status: 422,
          detail:
            'Monthly coaching setup requires a real coach availability time; 00:00 is treated as unset.',
        },
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }

    if (!dto.schedule_items?.length && !dto.training_plan_id) {
      throw new HttpException(
        {
          type: 'BUSINESS_RULE_VIOLATION',
          title: 'Monthly Schedule Required',
          status: 422,
          detail:
            'Monthly coaching plans require a selected client program before the coach can create the plan.',
        },
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }

    if (dto.session_overrides?.length) {
      throw new HttpException(
        {
          type: 'BUSINESS_RULE_VIOLATION',
          title: 'Schedule Overrides Not Allowed',
          status: 422,
          detail:
            'New monthly coaching plans must use the exact dates agreed by the coach; session overrides are not accepted at creation time.',
        },
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }
  }

  private assertPaidActiveUnscheduledEnrollment(
    enrollment: RecurringPlanWithSessions | null,
  ): { id: string; amount: Prisma.Decimal; paid_at: Date } {
    if (!enrollment) {
      throw new ForbiddenException({
        type: 'FORBIDDEN',
        title: 'Member Enrollment Required',
        status: 403,
        detail:
          'The member must enroll and complete the full monthly payment before a coach can author the schedule.',
      });
    }

    if (
      enrollment.status === RecurringCoachingPlanStatus.awaiting_payment ||
      enrollment.status === RecurringCoachingPlanStatus.draft
    ) {
      throw new ForbiddenException({
        type: 'FORBIDDEN',
        title: 'Full Payment Required',
        status: 403,
        detail:
          'The member must complete the full monthly payment before the coach can author dates or sessions.',
      });
    }

    if (enrollment.status !== RecurringCoachingPlanStatus.active) {
      throw new ConflictException({
        type: 'CONFLICT',
        title: 'Enrollment Not Active',
        status: 409,
        detail:
          'Only an active recurring coaching enrollment can receive its monthly schedule.',
      });
    }

    if (
      enrollment.schedule_items.length > 0 ||
      enrollment.appointments.length > 0
    ) {
      throw new ConflictException({
        type: 'CONFLICT',
        title: 'Recurring Coaching Schedule Already Exists',
        status: 409,
        detail:
          'This recurring coaching enrollment already has an authored schedule. A second plan cannot be created.',
      });
    }

    const paidCycle = enrollment.billing_cycles.find(
      (cycle) =>
        cycle.status === RecurringCoachingBillingCycleStatus.paid &&
        cycle.paid_at !== null,
    );
    if (!paidCycle || !paidCycle.paid_at) {
      throw new ForbiddenException({
        type: 'FORBIDDEN',
        title: 'Full Payment Required',
        status: 403,
        detail:
          'The member must complete the full monthly payment before the coach can author dates or sessions.',
      });
    }

    return {
      amount: new Prisma.Decimal(paidCycle.amount),
      id: paidCycle.id,
      paid_at: paidCycle.paid_at,
    };
  }

  private assertScheduleInsideEnrollmentWindow(
    scheduleItems: NonNullable<
      CreateRecurringCoachingPlanDTO['schedule_items']
    >,
    startDate: Date,
    endDate: Date,
  ): void {
    const startKey = this.toDateString(startDate);
    const endKey = this.toDateString(endDate);
    for (const item of scheduleItems) {
      const scheduledKey = this.toGymDateKey(
        this.parseDateTime(item.scheduled_at),
      );
      if (scheduledKey < startKey || scheduledKey > endKey) {
        throw new HttpException(
          {
            type: 'BUSINESS_RULE_VIOLATION',
            title: 'Schedule Outside Purchased Month',
            status: 422,
            detail:
              'Every authored session must fall inside the month purchased by the member.',
          },
          HttpStatus.UNPROCESSABLE_ENTITY,
        );
      }
    }
  }

  private getMonthlyPeriod(startDateInput?: string) {
    const startDate = startDateInput
      ? this.toDateOnlyValue(this.parseDateOnly(startDateInput))
      : this.getCurrentGymDateOnly();
    const today = this.getCurrentGymDateOnly();
    if (startDate.getTime() < today.getTime()) {
      throw new HttpException(
        {
          type: 'BUSINESS_RULE_VIOLATION',
          title: 'Invalid Recurring Plan Window',
          status: 422,
          detail: 'start_date must be today or later.',
        },
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }

    return {
      startDate,
      endDate: this.addDays(this.addCalendarMonthsClamped(startDate, 1), -1),
    };
  }

  private getExplicitMonthlyScheduleRange(
    scheduleItems: NonNullable<
      CreateRecurringCoachingPlanDTO['schedule_items']
    >,
  ) {
    const dates = scheduleItems
      .map((item) => this.parseDateTime(item.scheduled_at))
      .sort((left, right) => left.getTime() - right.getTime());
    const startDate = dates[0];
    const endDate = dates[dates.length - 1];
    const monthKey = this.toGymDateKey(startDate).slice(0, 7);

    if (
      dates.some((date) => this.toGymDateKey(date).slice(0, 7) !== monthKey)
    ) {
      throw new HttpException(
        {
          type: 'BUSINESS_RULE_VIOLATION',
          title: 'Single Monthly Period Required',
          status: 422,
          detail:
            'Every session in a fresh monthly coaching plan must stay inside the same calendar month.',
        },
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }

    return { startDate, endDate };
  }

  private assertMonthlyOffer(coach: RecurringPlanCoachContext) {
    if (coach.monthly_offer_active !== true) {
      throw new HttpException(
        {
          type: 'BUSINESS_RULE_VIOLATION',
          title: 'Monthly Offer Unavailable',
          status: 422,
          detail:
            'The coach must have an active monthly coaching offer before a plan can be created.',
        },
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }

    const monthlyRate = new Prisma.Decimal(coach.monthly_rate ?? 0);
    const sessionCount = Number(coach.monthly_session_count);
    const durationMinutes = Number(coach.monthly_session_duration_minutes);
    if (
      monthlyRate.lte(ZERO_DECIMAL) ||
      !Number.isInteger(sessionCount) ||
      sessionCount < 1 ||
      !Number.isInteger(durationMinutes) ||
      durationMinutes < 30 ||
      durationMinutes > 180
    ) {
      throw new HttpException(
        {
          type: 'BUSINESS_RULE_VIOLATION',
          title: 'Invalid Monthly Offer',
          status: 422,
          detail:
            'The coach monthly offer must define a positive rate, at least one included session, and a session duration from 30 to 180 minutes.',
        },
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }

    return { durationMinutes, monthlyRate, sessionCount };
  }

  private async assertCoachAuthoredTrainingPlan(
    dto: CreateRecurringCoachingPlanDTO,
    coach: Pick<RecurringPlanCoachContext, 'user_id'>,
  ): Promise<void> {
    if (!dto.training_plan_id) {
      throw new HttpException(
        {
          type: 'BUSINESS_RULE_VIOLATION',
          title: 'Coach Workout Plan Required',
          status: 422,
          detail:
            'A recurring monthly coaching plan must attach a workout plan authored by the assigned coach for this member.',
        },
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }

    if (!coach.user_id) {
      throw new HttpException(
        {
          type: 'BUSINESS_RULE_VIOLATION',
          title: 'Coach Workout Plan Required',
          status: 422,
          detail:
            'Standalone coaches cannot create recurring plans without a coach-owned workout plan.',
        },
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }

    const trainingPlan = await this.repo.findCoachAuthoredTrainingPlan({
      coachUserId: coach.user_id,
      memberId: dto.member_id,
      trainingPlanId: dto.training_plan_id,
    });
    if (!trainingPlan) {
      throw new HttpException(
        {
          type: 'BUSINESS_RULE_VIOLATION',
          title: 'Invalid Coach Workout Plan',
          status: 422,
          detail:
            'The attached workout plan must belong to the member and be authored by the assigned coach.',
        },
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }
  }

  private assertCoachPlanCreator(
    actor: JwtPayload,
    coach: Pick<RecurringPlanCoachContext, 'user_id'>,
  ): void {
    if (actor.role === UserRole.admin) {
      return;
    }

    if (actor.role === UserRole.coach && coach.user_id === actor.sub) {
      return;
    }

    throw new ForbiddenException({
      type: 'FORBIDDEN',
      title: 'Coach Creation Required',
      status: 403,
      detail:
        'Only the assigned coach or an administrator can author a monthly recurring coaching schedule.',
    });
  }

  private async assertActiveMember(memberId: string) {
    const member = await this.repo.findActiveMember(memberId);

    if (!member) {
      throw new HttpException(
        {
          type: 'BUSINESS_RULE_VIOLATION',
          title: 'Member Not Eligible',
          status: 422,
          detail:
            'Recurring coaching plans can only be created for active member accounts.',
        },
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }
  }

  private async assertCoachVisibleForNewPlan(
    coachId: string,
  ): Promise<RecurringPlanCoachContext> {
    const coach = await this.repo.findCoachContext(coachId);

    if (!coach) {
      throw this.notFound('Coach profile not found.');
    }

    if (!coach.is_available_for_booking) {
      throw new HttpException(
        {
          type: 'BUSINESS_RULE_VIOLATION',
          title: 'Coach Hidden From Booking',
          status: 422,
          detail:
            'Hidden coach profiles cannot be used to create new recurring coaching plans.',
        },
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }

    return coach;
  }

  private assertPlanCreator(
    actor: JwtPayload,
    memberId: string,
    coach: Pick<RecurringPlanCoachContext, 'user_id'>,
  ) {
    if (actor.role === UserRole.admin) {
      return;
    }

    if (
      actor.role === UserRole.coach &&
      coach.user_id === actor.sub &&
      memberId
    ) {
      return;
    }

    throw new ForbiddenException({
      type: 'FORBIDDEN',
      title: 'Forbidden',
      status: 403,
      detail:
        'Only the assigned coach can create a recurring coaching schedule for a member.',
    });
  }

  private assertRecurringPaymentProvider(
    role: UserRole,
    provider: PaymentProvider,
  ): void {
    if (provider !== PaymentProvider.paymongo) {
      throw new GoneException({
        type: 'GONE',
        title: 'Cash Billing Verification Retired',
        status: 410,
        detail:
          'Recurring billing-cycle cash verification is retired. Use the atomic staff cash enrollment route for a new fully paid monthly enrollment.',
      });
    }
    void role;
  }

  private assertPlanVisibility(
    actor: JwtPayload,
    plan: Pick<RecurringPlanWithSessions, 'member_id' | 'coach_id'> & {
      coach?: { user_id?: string | null };
    },
  ) {
    if (actor.role === UserRole.admin || actor.role === UserRole.staff) {
      return;
    }

    if (actor.role === UserRole.member && actor.sub === plan.member_id) {
      return;
    }

    if (actor.role === UserRole.coach && actor.sub === plan.coach?.user_id) {
      return;
    }

    throw new ForbiddenException({
      type: 'FORBIDDEN',
      title: 'Forbidden',
      status: 403,
      detail: 'You do not have access to this recurring coaching plan.',
    });
  }

  private assertPlanManagementAccess(
    actor: JwtPayload,
    plan: RecurringPlanWithSessions,
  ) {
    if (
      plan.status !== RecurringCoachingPlanStatus.active ||
      !plan.billing_cycles.some(
        (cycle) =>
          cycle.status === RecurringCoachingBillingCycleStatus.paid &&
          cycle.paid_at !== null,
      )
    ) {
      throw new ForbiddenException({
        type: 'FORBIDDEN',
        title: 'Full Payment Required',
        status: 403,
        detail:
          'Coach mutations are limited to sessions owned by an active, fully paid coaching enrollment.',
      });
    }

    if (actor.role === UserRole.admin) {
      return;
    }

    if (actor.role === UserRole.coach && actor.sub === plan.coach?.user_id) {
      return;
    }

    throw new ForbiddenException({
      type: 'FORBIDDEN',
      title: 'Forbidden',
      status: 403,
      detail:
        'Only the assigned coach or an administrator can change a recurring coaching plan.',
    });
  }

  private assertPlanCancellationAccess(
    actor: JwtPayload,
    plan: RecurringPlanWithSessions,
  ) {
    if (
      plan.status !== RecurringCoachingPlanStatus.active ||
      !plan.billing_cycles.some(
        (cycle) =>
          cycle.status === RecurringCoachingBillingCycleStatus.paid &&
          cycle.paid_at !== null,
      )
    ) {
      throw new ForbiddenException({
        type: 'FORBIDDEN',
        title: 'Full Payment Required',
        status: 403,
        detail:
          'Only an active, fully paid coaching enrollment can be cancelled.',
      });
    }

    if (actor.role === UserRole.admin) {
      return;
    }

    if (actor.role === UserRole.coach && actor.sub === plan.coach?.user_id) {
      return;
    }

    if (actor.role === UserRole.member && actor.sub === plan.member_id) {
      return;
    }

    throw new ForbiddenException({
      type: 'FORBIDDEN',
      title: 'Forbidden',
      status: 403,
      detail:
        'Only the plan owner, assigned coach, or an administrator can cancel a recurring coaching plan.',
    });
  }

  private assertSessionEditable(status: AppointmentStatus) {
    if (
      status === AppointmentStatus.completed ||
      status === AppointmentStatus.no_show
    ) {
      throw new HttpException(
        {
          type: 'BUSINESS_RULE_VIOLATION',
          title: 'Session Cannot Be Edited',
          status: 422,
          detail: 'Completed and no-show sessions are preserved as history.',
        },
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }
  }

  private async findPlanOrThrow(planId: string) {
    const plan = await this.repo.findPlanWithSessions(planId);

    if (!plan) {
      throw this.notFound('Recurring coaching plan not found.');
    }

    return plan;
  }

  private notFound(detail: string) {
    return new NotFoundException({
      type: 'NOT_FOUND',
      title: 'Not Found',
      status: 404,
      detail,
    });
  }

  private buildActiveEntitlementConflict(): ConflictException {
    return new ConflictException({
      type: RECURRING_COACHING_ACTIVE_ENTITLEMENT_CONFLICT_TYPE,
      title: 'Recurring Coaching Enrollment Already Exists',
      status: HttpStatus.CONFLICT,
      detail:
        'This member already has an active or paused recurring coaching entitlement with the selected coach.',
      conflict_kind: 'active_entitlement',
    });
  }

  private buildConflict(candidate: { conflictReasons: string[] }) {
    return new ConflictException({
      type: 'CONFLICT',
      title: 'Schedule Conflict',
      status: 409,
      detail: 'The requested recurring session slot is not available.',
      conflict_reasons: candidate.conflictReasons,
    });
  }

  private toPreviewSession(session: GeneratedSessionDraft): PreviewSession {
    return {
      candidate_index: session.candidateIndex ?? 0,
      coach_id: session.coachId,
      conflict: session.conflict,
      conflict_reasons: session.conflictReasons,
      date: this.toGymDateKey(session.scheduledAt),
      duration_minutes: session.durationMinutes,
      ends_at: session.endsAt.toISOString(),
      original_scheduled_at: session.originalScheduledAt?.toISOString() ?? null,
      recurring_state: session.state,
      selected: session.selected !== false,
      scheduled_at: session.scheduledAt.toISOString(),
      status: session.status,
      time: this.toGymTimeString(session.scheduledAt),
      workout: session.workout
        ? {
            day_of_week: session.workout.dayOfWeek,
            exercise_count: session.workout.exerciseCount,
            exercise_names: session.workout.exerciseNames,
            id: session.workout.id,
            label: session.workout.label,
            week_number: session.workout.weekNumber,
          }
        : null,
    };
  }

  private toPlanResponse(
    plan: Pick<
      RecurringPlanWithSessions,
      | 'id'
      | 'member_id'
      | 'coach_id'
      | 'training_plan_id'
      | 'frequency'
      | 'preferred_days'
      | 'preferred_time'
      | 'start_date'
      | 'end_date'
      | 'quoted_amount'
      | 'coach_approved_at'
      | 'status'
      | 'total_sessions'
      | 'completed_sessions'
      | 'billing_cycles'
      | 'schedule_items'
    > & { coach?: { display_name?: string | null } },
  ): RecurringCoachingPlanResponseDTO {
    return {
      id: plan.id,
      member_id: plan.member_id,
      coach_id: plan.coach_id,
      coach_name: plan.coach?.display_name?.trim() || null,
      training_plan_id: plan.training_plan_id ?? null,
      frequency: plan.frequency,
      preferred_days: plan.preferred_days,
      preferred_time: this.toTimeString(plan.preferred_time),
      start_date: this.toDateString(plan.start_date),
      end_date: this.toDateString(plan.end_date),
      quoted_amount: new Prisma.Decimal(plan.quoted_amount ?? 0).toFixed(2),
      coach_approved_at: plan.coach_approved_at?.toISOString() ?? null,
      status: plan.status,
      total_sessions: plan.total_sessions,
      completed_sessions: plan.completed_sessions,
      schedule_items: plan.schedule_items?.map((item) =>
        this.toScheduleItemResponse(item),
      ),
      billing_cycles: plan.billing_cycles?.map((cycle) =>
        this.toBillingCycleResponse(cycle),
      ),
    };
  }

  private toScheduleItemResponse(item: {
    id: string;
    training_schedule_day_id?: string | null;
    sequence_index: number;
    scheduled_at: Date;
    duration_minutes: number;
    amount: Prisma.Decimal | number | string;
    status: string;
    appointment?: { id: string } | null;
  }): RecurringCoachingScheduleItemResponseDTO {
    return {
      id: item.id,
      sequence_index: item.sequence_index,
      scheduled_at: item.scheduled_at.toISOString(),
      duration_minutes: item.duration_minutes,
      amount: new Prisma.Decimal(item.amount).toFixed(2),
      status: item.status,
      appointment_id: item.appointment?.id ?? null,
      training_schedule_day_id: item.training_schedule_day_id ?? null,
    };
  }

  private toBillingCycleResponse(cycle: {
    amount: Prisma.Decimal | number | string;
    cycle_end_date: Date;
    cycle_start_date: Date;
    due_date: Date;
    grace_period_ends_at: Date;
    id: string;
    paid_at: Date | null;
    payment_id: string | null;
    recurring_plan_id: string;
    status: RecurringCoachingBillingCycleStatus;
  }): RecurringCoachingBillingCycleResponseDTO {
    return {
      id: cycle.id,
      recurring_plan_id: cycle.recurring_plan_id,
      cycle_start_date: this.toDateString(cycle.cycle_start_date),
      cycle_end_date: this.toDateString(cycle.cycle_end_date),
      due_date: this.toDateString(cycle.due_date),
      grace_period_ends_at: cycle.grace_period_ends_at.toISOString(),
      amount: new Prisma.Decimal(cycle.amount).toFixed(2),
      status: cycle.status,
      payment_id: cycle.payment_id,
      paid_at: cycle.paid_at?.toISOString() ?? null,
    };
  }

  private toSessionResponse(session: {
    coach_id: string;
    duration_minutes: number;
    id: string;
    original_scheduled_at?: Date | null;
    recurring_plan_id?: string | null;
    recurring_state?: RecurringCoachingSessionState | null;
    scheduled_at: Date;
    status: AppointmentStatus;
    training_schedule_day_id?: string | null;
    workout_assignment?: {
      sequence_index: number;
      training_schedule_day_id: string;
      source: CoachWorkoutAssignmentSource;
      state: CoachWorkoutAssignmentState;
    } | null;
  }): RecurringCoachingPlanSessionResponseDTO {
    return {
      id: session.id,
      recurring_plan_id: session.recurring_plan_id ?? '',
      coach_id: session.coach_id,
      scheduled_at: session.scheduled_at.toISOString(),
      date: this.toGymDateKey(session.scheduled_at),
      time: this.toGymTimeString(session.scheduled_at),
      duration_minutes: session.duration_minutes,
      recurring_state: session.recurring_state ?? null,
      status: session.status,
      exception_override: Boolean(session.original_scheduled_at),
      conflict: false,
      workout_assignment: session.workout_assignment
        ? {
            sequence_index: session.workout_assignment.sequence_index,
            training_schedule_day_id:
              session.workout_assignment.training_schedule_day_id,
            source: session.workout_assignment.source,
            state: session.workout_assignment.state,
          }
        : null,
      workout: session.workout_assignment
        ? {
            id: session.workout_assignment.training_schedule_day_id,
            label: null,
            week_number: 0,
            day_of_week: 0,
            exercise_count: 0,
            exercise_names: [],
          }
        : null,
    };
  }

  private buildBillingCycles(input: {
    coach: RecurringPlanCoachContext;
    endDate: Date;
    sessions: GeneratedSessionDraft[];
    startDate: Date;
  }): Omit<
    Prisma.RecurringCoachingBillingCycleCreateManyInput,
    'recurring_plan_id'
  >[] {
    const billableSessions = input.sessions.filter(
      (session) => session.status !== AppointmentStatus.cancelled,
    );
    const cycles: Omit<
      Prisma.RecurringCoachingBillingCycleCreateManyInput,
      'recurring_plan_id'
    >[] = [];

    for (
      let monthCursor = this.toMonthStart(input.startDate);
      monthCursor.getTime() <= input.endDate.getTime();
      monthCursor = this.addMonths(monthCursor, 1)
    ) {
      const nextMonth = this.addMonths(monthCursor, 1);
      const cycleStart =
        monthCursor.getTime() < input.startDate.getTime()
          ? input.startDate
          : monthCursor;
      const cycleEndExclusive =
        nextMonth.getTime() > this.addDays(input.endDate, 1).getTime()
          ? this.addDays(input.endDate, 1)
          : nextMonth;
      const cycleSessions = billableSessions.filter(
        (session) =>
          session.scheduledAt.getTime() >= cycleStart.getTime() &&
          session.scheduledAt.getTime() < cycleEndExclusive.getTime(),
      );

      if (cycleSessions.length === 0) {
        continue;
      }

      const amount = cycleSessions
        .reduce(
          (total, session) =>
            total.plus(
              this.calculateSessionAmounts(input.coach, session.durationMinutes)
                .totalAmount,
            ),
          ZERO_DECIMAL,
        )
        .toDecimalPlaces(2);
      const dueDate = this.toDateOnlyValue(cycleStart);

      cycles.push({
        amount,
        cycle_start_date: dueDate,
        cycle_end_date: this.toDateOnlyValue(
          this.addDays(cycleEndExclusive, -1),
        ),
        due_date: dueDate,
        grace_period_ends_at: this.addDays(
          dueDate,
          RECURRING_BILLING_GRACE_DAYS,
        ),
        status: RecurringCoachingBillingCycleStatus.due,
      });
    }

    return cycles;
  }

  private buildSessionAmountFields(
    coach: RecurringPlanCoachContext,
    durationMinutes: number,
  ): Pick<
    Prisma.CoachAppointmentCreateManyInput,
    'coach_earnings' | 'gym_revenue' | 'total_amount'
  > {
    const amounts = this.calculateSessionAmounts(coach, durationMinutes);
    return {
      total_amount: amounts.totalAmount,
      gym_revenue: amounts.gymRevenue,
      coach_earnings: amounts.coachEarnings,
    };
  }

  private calculateSessionAmounts(
    coach: RecurringPlanCoachContext,
    durationMinutes: number,
  ) {
    const totalAmount = new Prisma.Decimal(coach.hourly_rate)
      .mul(durationMinutes)
      .div(60)
      .toDecimalPlaces(2);
    const gymRevenue = totalAmount
      .mul(new Prisma.Decimal(coach.gym_commission_pct))
      .div(100)
      .toDecimalPlaces(2);

    return {
      totalAmount,
      gymRevenue,
      coachEarnings: totalAmount.minus(gymRevenue).toDecimalPlaces(2),
    };
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

  private toMinorAmount(amount: Prisma.Decimal | number | string): number {
    return Math.round(Number(amount) * 100);
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

  private parseDateOnly(value: string): Date {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      throw new HttpException(
        {
          type: 'BUSINESS_RULE_VIOLATION',
          title: 'Invalid Date',
          status: 422,
          detail: 'Date fields must be valid ISO date strings.',
        },
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }
    return parsed;
  }

  private parseDateTime(value: string | undefined): Date {
    const parsed = value ? new Date(value) : null;
    if (!parsed || Number.isNaN(parsed.getTime())) {
      throw new HttpException(
        {
          type: 'BUSINESS_RULE_VIOLATION',
          title: 'Invalid Session Time',
          status: 422,
          detail: 'Session times must be valid ISO 8601 date strings.',
        },
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }
    return parsed;
  }

  private toDateOnlyValue(value: Date): Date {
    return new Date(
      Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()),
    );
  }

  private toDateString(value: Date): string {
    return value.toISOString().slice(0, 10);
  }

  private getCurrentGymDateOnly() {
    return this.toDateOnlyValue(
      this.parseDateOnly(this.toGymDateKey(new Date())),
    );
  }

  private toTimeValue(value: string): Date {
    const [hours, minutes] = value.split(':').map((part) => Number(part));
    return new Date(Date.UTC(1970, 0, 1, hours, minutes, 0, 0));
  }

  private toTimeString(value: Date): string {
    const hours = value.getUTCHours().toString().padStart(2, '0');
    const minutes = value.getUTCMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
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

  private combineDateAndTime(date: Date, time: string): Date {
    const [hours, minutes] = time.split(':').map((part) => Number(part));
    const gymLocalUtc = Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate(),
      hours,
      minutes,
      0,
      0,
    );

    return new Date(gymLocalUtc - GYM_TIMEZONE_OFFSET_MINUTES * 60 * 1000);
  }

  private addDays(value: Date, days: number): Date {
    return new Date(value.getTime() + days * 24 * 60 * 60 * 1000);
  }

  private addMinutes(value: Date, minutes: number): Date {
    return new Date(value.getTime() + minutes * 60 * 1000);
  }

  private addMonths(value: Date, months: number): Date {
    return new Date(
      Date.UTC(
        value.getUTCFullYear(),
        value.getUTCMonth() + months,
        value.getUTCDate(),
      ),
    );
  }

  private addCalendarMonthsClamped(value: Date, months: number): Date {
    const targetMonthStart = new Date(
      Date.UTC(value.getUTCFullYear(), value.getUTCMonth() + months, 1),
    );
    const targetMonthEnd = new Date(
      Date.UTC(
        targetMonthStart.getUTCFullYear(),
        targetMonthStart.getUTCMonth() + 1,
        0,
      ),
    );
    return new Date(
      Date.UTC(
        targetMonthStart.getUTCFullYear(),
        targetMonthStart.getUTCMonth(),
        Math.min(value.getUTCDate(), targetMonthEnd.getUTCDate()),
      ),
    );
  }

  private toMonthStart(value: Date): Date {
    return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), 1));
  }

  private weekStartUtc(value: Date): Date {
    const gymWallClockDate = this.toGymWallClockDate(value);
    return this.addDays(
      this.toDateOnlyValue(gymWallClockDate),
      -gymWallClockDate.getUTCDay(),
    );
  }
}
