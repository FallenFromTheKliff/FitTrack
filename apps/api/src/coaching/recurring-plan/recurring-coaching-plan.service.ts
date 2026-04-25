import {
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AppointmentStatus,
  Prisma,
  RecurringCoachingFrequency,
  RecurringCoachingPlanStatus,
  RecurringCoachingSessionState,
  UserRole,
} from '@prisma/client';

import type { JwtPayload } from '../../auth/types/jwt-payload.type';
import {
  BulkUpdateRecurringPlanSessionsDTO,
  CancelRecurringCoachingPlanDTO,
  CreateRecurringCoachingPlanDTO,
  PreviewRecurringCoachingPlanDTO,
  RecurringCoachingPlanBaseDTO,
  RecurringCoachingPlanResponseDTO,
  RecurringCoachingPlanSessionResponseDTO,
  RecurringPlanSessionOverrideDTO,
  UpdateRecurringPlanSessionDTO,
} from './dto/recurring-coaching-plan.dto';
import {
  RecurringCoachingPlanRepository,
  RecurringPlanCoachContext,
  RecurringPlanWithSessions,
} from './recurring-coaching-plan.repository';

type GeneratedSessionDraft = {
  coachId: string;
  conflict: boolean;
  conflictReasons: string[];
  durationMinutes: number;
  endsAt: Date;
  originalScheduledAt: Date | null;
  scheduledAt: Date;
  state: RecurringCoachingSessionState;
  status: AppointmentStatus;
};

type PreviewSession = {
  coach_id: string;
  conflict: boolean;
  conflict_reasons: string[];
  duration_minutes: number;
  ends_at: string;
  original_scheduled_at: string | null;
  recurring_state: RecurringCoachingSessionState;
  scheduled_at: string;
  status: AppointmentStatus | 'preview';
};

const ZERO_DECIMAL = new Prisma.Decimal('0');
const MAX_GENERATED_SESSIONS = 120;

@Injectable()
export class RecurringCoachingPlanService {
  constructor(private readonly repo: RecurringCoachingPlanRepository) {}

  async previewPlan(actor: JwtPayload, dto: PreviewRecurringCoachingPlanDTO) {
    this.assertPlanAccess(actor, dto.member_id);
    await this.assertActiveMember(dto.member_id);

    const normalized = this.normalizePlanInput(dto);
    const generatedSessions = await this.buildGeneratedSessions({
      coachId: dto.coach_id,
      durationMinutes: normalized.durationMinutes,
      endDate: normalized.endDate,
      frequency: dto.frequency,
      preferredDays: normalized.preferredDays,
      preferredTime: dto.preferred_time,
      startDate: normalized.startDate,
    });

    return {
      can_confirm: generatedSessions.every((session) => !session.conflict),
      total_sessions: generatedSessions.length,
      conflict_count: generatedSessions.filter((session) => session.conflict)
        .length,
      venue_conflicts_checked: false,
      venue_conflicts_note:
        'Coach appointments do not currently reserve venues, so venue conflict checks are deferred.',
      sessions: generatedSessions.map((session) =>
        this.toPreviewSession(session),
      ),
    };
  }

  async createPlan(actor: JwtPayload, dto: CreateRecurringCoachingPlanDTO) {
    this.assertPlanAccess(actor, dto.member_id);
    await this.assertActiveMember(dto.member_id);

    const normalized = this.normalizePlanInput(dto);
    const baseSessions = await this.buildGeneratedSessions({
      coachId: dto.coach_id,
      durationMinutes: normalized.durationMinutes,
      endDate: normalized.endDate,
      frequency: dto.frequency,
      preferredDays: normalized.preferredDays,
      preferredTime: dto.preferred_time,
      startDate: normalized.startDate,
    });
    const sessions = await this.applySessionOverrides(
      baseSessions,
      dto.session_overrides ?? [],
    );
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
          'Resolve conflicting sessions by skipping, rescheduling, or swapping coach before confirming the plan.',
        conflicts: unresolvedConflicts.map((session) =>
          this.toPreviewSession(session),
        ),
      });
    }

    const plan = await this.repo.createPlanWithSessions({
      plan: {
        member: { connect: { id: dto.member_id } },
        coach: { connect: { id: dto.coach_id } },
        created_by: actor.sub,
        frequency: dto.frequency,
        preferred_days: normalized.preferredDays,
        preferred_time: this.toTimeValue(dto.preferred_time),
        start_date: normalized.startDate,
        end_date: normalized.endDate,
        duration_minutes: normalized.durationMinutes,
        status: RecurringCoachingPlanStatus.active,
        total_sessions: sessions.length,
        completed_sessions: 0,
      },
      appointments: sessions.map((session) => ({
        user_id: dto.member_id,
        coach_id: session.coachId,
        status: session.status,
        recurring_state: session.state,
        original_scheduled_at: session.originalScheduledAt,
        is_free_session: true,
        scheduled_at: session.scheduledAt,
        duration_minutes: session.durationMinutes,
        total_amount: ZERO_DECIMAL,
        downpayment_amount: ZERO_DECIMAL,
        balance_amount: ZERO_DECIMAL,
        gym_revenue: ZERO_DECIMAL,
        coach_earnings: ZERO_DECIMAL,
        member_notes: dto.member_notes ?? null,
        cancellation_reason:
          session.state === RecurringCoachingSessionState.skipped
            ? 'Skipped during recurring plan confirmation.'
            : null,
        cancelled_at:
          session.state === RecurringCoachingSessionState.skipped
            ? new Date()
            : null,
      })),
    });

    return {
      plan: this.toPlanResponse(plan),
      sessions: plan.appointments.map((session) =>
        this.toSessionResponse(session),
      ),
    };
  }

  async getPlanSessions(actor: JwtPayload, planId: string) {
    const plan = await this.findPlanOrThrow(planId);
    await this.assertPlanVisibility(actor, plan);

    return {
      plan: this.toPlanResponse(plan),
      sessions: plan.appointments.map((session) =>
        this.toSessionResponse(session),
      ),
    };
  }

  async updateSingleSession(
    actor: JwtPayload,
    planId: string,
    sessionId: string,
    dto: UpdateRecurringPlanSessionDTO,
  ) {
    const session = await this.repo.findSessionForPlan({ planId, sessionId });

    if (!session || !session.recurring_plan) {
      throw this.notFound('Recurring coaching session not found.');
    }

    await this.assertPlanVisibility(actor, session.recurring_plan);
    this.assertSessionEditable(session.status);

    if (dto.action === 'skip') {
      const updated = await this.repo.updateSession(session.id, {
        status: AppointmentStatus.cancelled,
        recurring_state: RecurringCoachingSessionState.skipped,
        cancellation_reason: dto.reason ?? 'Skipped recurring session.',
        cancelled_at: new Date(),
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
    await this.assertPlanVisibility(actor, plan);

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
    await this.assertPlanVisibility(actor, plan);

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
        coachId: input.coachId,
        conflict: candidate.conflict,
        conflictReasons: candidate.conflictReasons,
        durationMinutes: input.durationMinutes,
        endsAt: this.addMinutes(scheduledAt, input.durationMinutes),
        originalScheduledAt: null,
        scheduledAt,
        state: RecurringCoachingSessionState.generated,
        status: AppointmentStatus.confirmed,
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
    const endsAt = this.addMinutes(input.scheduledAt, input.durationMinutes);

    if (!coach) {
      return {
        conflict: true,
        conflictReasons: ['coach_not_found'],
      };
    }

    if (!coach.is_available_for_booking) {
      conflictReasons.push('coach_hidden_from_booking');
    }

    if (endsAt.getUTCDate() !== input.scheduledAt.getUTCDate()) {
      conflictReasons.push('appointment_crosses_utc_day');
    }

    if (!this.coachHasAvailability(coach, input.scheduledAt, endsAt)) {
      conflictReasons.push('coach_unavailable');
    }

    const conflicts = await this.repo.findConflictingAppointments({
      coachId: input.coachId,
      endsAt,
      excludeAppointmentIds: input.excludeAppointmentIds,
      startsAt: input.scheduledAt,
    });

    if (conflicts.length > 0) {
      conflictReasons.push('coach_appointment_conflict');
    }

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
    const slotStart = this.toTimeValue(this.toTimeString(startsAt));
    const slotEnd = this.toTimeValue(this.toTimeString(endsAt));

    return coach.availability_slots.some(
      (slot) =>
        slot.day_of_week === startsAt.getUTCDay() &&
        slot.start_time.getTime() <= slotStart.getTime() &&
        slot.end_time.getTime() >= slotEnd.getTime(),
    );
  }

  private normalizePlanInput(dto: RecurringCoachingPlanBaseDTO) {
    const startDate = this.toDateOnlyValue(this.parseDateOnly(dto.start_date));
    const endDate = dto.end_date
      ? this.toDateOnlyValue(this.parseDateOnly(dto.end_date))
      : this.addMonths(startDate, dto.duration_months ?? 1);

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

    return {
      durationMinutes: dto.duration_minutes ?? 60,
      endDate,
      preferredDays: this.normalizePreferredDays(dto.preferred_days),
      startDate,
    };
  }

  private normalizePreferredDays(days: number[]) {
    return [...new Set(days)].sort((left, right) => left - right);
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

  private assertPlanAccess(actor: JwtPayload, memberId: string) {
    if (actor.role === UserRole.admin || actor.role === UserRole.staff) {
      return;
    }

    if (actor.role === UserRole.member && actor.sub === memberId) {
      return;
    }

    throw new ForbiddenException({
      type: 'FORBIDDEN',
      title: 'Forbidden',
      status: 403,
      detail: 'You cannot create a recurring plan for another member.',
    });
  }

  private async assertPlanVisibility(
    actor: JwtPayload,
    plan: Pick<RecurringPlanWithSessions, 'member_id' | 'coach_id'> & {
      coach?: { user_id?: string };
    },
  ) {
    if (actor.role === UserRole.admin || actor.role === UserRole.staff) {
      return;
    }

    if (actor.role === UserRole.member && actor.sub === plan.member_id) {
      return;
    }

    const coach = await this.repo.findCoachContext(plan.coach_id);
    if (actor.role === UserRole.coach && coach?.user_id === actor.sub) {
      return;
    }

    throw new ForbiddenException({
      type: 'FORBIDDEN',
      title: 'Forbidden',
      status: 403,
      detail: 'You do not have access to this recurring coaching plan.',
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
      coach_id: session.coachId,
      conflict: session.conflict,
      conflict_reasons: session.conflictReasons,
      duration_minutes: session.durationMinutes,
      ends_at: session.endsAt.toISOString(),
      original_scheduled_at: session.originalScheduledAt?.toISOString() ?? null,
      recurring_state: session.state,
      scheduled_at: session.scheduledAt.toISOString(),
      status: session.status,
    };
  }

  private toPlanResponse(
    plan: Pick<
      RecurringPlanWithSessions,
      | 'id'
      | 'member_id'
      | 'coach_id'
      | 'frequency'
      | 'preferred_days'
      | 'preferred_time'
      | 'start_date'
      | 'end_date'
      | 'status'
      | 'total_sessions'
      | 'completed_sessions'
    >,
  ): RecurringCoachingPlanResponseDTO {
    return {
      id: plan.id,
      member_id: plan.member_id,
      coach_id: plan.coach_id,
      frequency: plan.frequency,
      preferred_days: plan.preferred_days,
      preferred_time: this.toTimeString(plan.preferred_time),
      start_date: this.toDateString(plan.start_date),
      end_date: this.toDateString(plan.end_date),
      status: plan.status,
      total_sessions: plan.total_sessions,
      completed_sessions: plan.completed_sessions,
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
  }): RecurringCoachingPlanSessionResponseDTO {
    return {
      id: session.id,
      recurring_plan_id: session.recurring_plan_id ?? '',
      coach_id: session.coach_id,
      scheduled_at: session.scheduled_at.toISOString(),
      duration_minutes: session.duration_minutes,
      recurring_state: session.recurring_state ?? null,
      status: session.status,
      exception_override: Boolean(session.original_scheduled_at),
      conflict: false,
    };
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

  private toTimeValue(value: string): Date {
    const [hours, minutes] = value.split(':').map((part) => Number(part));
    return new Date(Date.UTC(1970, 0, 1, hours, minutes, 0, 0));
  }

  private toTimeString(value: Date): string {
    const hours = value.getUTCHours().toString().padStart(2, '0');
    const minutes = value.getUTCMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  }

  private combineDateAndTime(date: Date, time: string): Date {
    const [hours, minutes] = time.split(':').map((part) => Number(part));
    return new Date(
      Date.UTC(
        date.getUTCFullYear(),
        date.getUTCMonth(),
        date.getUTCDate(),
        hours,
        minutes,
        0,
        0,
      ),
    );
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

  private weekStartUtc(value: Date): Date {
    return this.addDays(this.toDateOnlyValue(value), -value.getUTCDay());
  }
}
