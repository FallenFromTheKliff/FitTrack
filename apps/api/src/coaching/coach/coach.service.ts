import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { AuditAction, AuditEvent } from '../../audit/audit.service';
import { PaginatedResult } from '../../common/base-repository/base-repository';
import {
  AdminCoachDetailResponseDTO,
  CoachAvailabilitySlotResponseDTO,
  CoachDetailResponseDTO,
  CoachFilterDTO,
  CoachListItemResponseDTO,
  CoachSelfDetailResponseDTO,
  CoachUserProfileResponseDTO,
  UpdateCoachProfileDTO,
} from './dto/coach.dto';
import {
  CoachDetailRecord,
  CoachListRecord,
  CoachRepository,
} from './coach.repository';

const COACH_SELF_UPDATE_FIELDS = [
  'specialization',
  'bio',
  'certification',
  'hourly_rate',
  'is_available_for_booking',
] as const;

const COACH_ADMIN_UPDATE_FIELDS = [
  ...COACH_SELF_UPDATE_FIELDS,
  'gym_commission_pct',
] as const;

function pickDefined<T extends object, K extends keyof T>(
  source: T,
  keys: readonly K[],
): Partial<Pick<T, K>> {
  const result: Partial<Pick<T, K>> = {};

  for (const key of keys) {
    const value = source[key];
    if (value !== undefined) {
      result[key] = value as T[K];
    }
  }

  return result;
}

@Injectable()
export class CoachService {
  constructor(
    private readonly repo: CoachRepository,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async listCoaches(
    dto: CoachFilterDTO,
  ): Promise<PaginatedResult<CoachListItemResponseDTO>> {
    const result = await this.repo.listAvailableCoaches(dto);

    return {
      data: result.data.map((coach) => this.toCoachListItem(coach)),
      meta: result.meta,
    };
  }

  async getCoachById(id: string): Promise<CoachDetailResponseDTO> {
    return this.toCoachDetail(await this.repo.findCoachByIdOrThrow(id));
  }

  async getMyProfile(userId: string): Promise<CoachSelfDetailResponseDTO> {
    return this.toCoachSelfDetail(
      await this.repo.findCoachByUserIdOrThrow(userId),
    );
  }

  async updateMyProfile(
    userId: string,
    dto: UpdateCoachProfileDTO,
  ): Promise<CoachDetailResponseDTO> {
    this.assertCoachOwnedFields(dto);

    return this.toCoachDetail(
      await this.repo.updateCoachByUserId(userId, this.toSelfUpdateInput(dto)),
    );
  }

  async adminUpdateCoach(
    actorId: string,
    coachId: string,
    dto: UpdateCoachProfileDTO,
  ): Promise<AdminCoachDetailResponseDTO> {
    const before =
      dto.gym_commission_pct !== undefined
        ? await this.repo.findCoachByIdOrThrow(coachId)
        : null;

    const updated = await this.repo.updateCoachById(
      coachId,
      this.toAdminUpdateInput(dto),
    );

    if (
      before &&
      this.didCommissionChange(
        before.gym_commission_pct,
        updated.gym_commission_pct,
      )
    ) {
      this.emitAudit({
        userId: actorId,
        action: AuditAction.COACH_COMMISSION_CHANGED,
        entity: 'CoachProfile',
        entityId: updated.id,
        before: this.toCommissionAuditSnapshot(before.gym_commission_pct),
        after: this.toCommissionAuditSnapshot(updated.gym_commission_pct),
      });
    }

    return this.toAdminCoachDetail(updated);
  }

  async updateManagedProfile(
    coachId: string,
    dto: UpdateCoachProfileDTO,
  ): Promise<CoachDetailResponseDTO> {
    this.assertCoachOwnedFields(dto);

    return this.toCoachDetail(
      await this.repo.updateCoachById(coachId, this.toSelfUpdateInput(dto)),
    );
  }

  async assertCoachReservableForBookingWindow(
    coachId: string,
    startsAt: Date,
    endsAt: Date,
  ): Promise<void> {
    const coach = await this.repo.findCoachByIdOrThrow(coachId);

    if (!coach.is_available_for_booking) {
      throw this.buildCoachUnavailableError();
    }

    if (this.toUtcCalendarDay(startsAt) !== this.toUtcCalendarDay(endsAt)) {
      throw new HttpException(
        {
          type: 'BUSINESS_RULE_VIOLATION',
          title: 'Invalid Coach Reservation Window',
          status: 422,
          detail:
            'Coach-linked venue reservations must begin and end on the same UTC calendar day.',
        },
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }

    const dayOfWeek = startsAt.getUTCDay();
    const slotStart = this.toTimeValue(startsAt);
    const slotEnd = this.toTimeValue(endsAt);
    const hasAvailability = coach.availability_slots.some(
      (slot) =>
        slot.day_of_week === dayOfWeek &&
        slot.start_time.getTime() <= slotStart.getTime() &&
        slot.end_time.getTime() >= slotEnd.getTime(),
    );

    if (!hasAvailability) {
      throw this.buildCoachUnavailableError();
    }

    const hasAppointmentConflict = await this.repo.hasActiveAppointmentConflict(
      coachId,
      startsAt,
      endsAt,
    );
    if (hasAppointmentConflict) {
      throw this.buildCoachConflictError();
    }

    const hasLinkedBookingConflict =
      await this.repo.hasActiveLinkedBookingConflict(coachId, startsAt, endsAt);
    if (hasLinkedBookingConflict) {
      throw this.buildCoachConflictError();
    }
  }

  private assertCoachOwnedFields(dto: UpdateCoachProfileDTO): void {
    if (dto.gym_commission_pct !== undefined) {
      throw new ForbiddenException({
        type: 'FORBIDDEN',
        title: 'Commission Update Forbidden',
        status: 403,
        detail: 'Only admin users can update gym_commission_pct.',
      });
    }
  }

  private toSelfUpdateInput(
    dto: UpdateCoachProfileDTO,
  ): Prisma.CoachProfileUpdateInput {
    return {
      ...pickDefined(dto, COACH_SELF_UPDATE_FIELDS),
    };
  }

  private toAdminUpdateInput(
    dto: UpdateCoachProfileDTO,
  ): Prisma.CoachProfileUpdateInput {
    return {
      ...pickDefined(dto, COACH_ADMIN_UPDATE_FIELDS),
    };
  }

  private toCoachListItem(coach: CoachListRecord): CoachListItemResponseDTO {
    return {
      id: coach.id,
      specialization: coach.specialization,
      bio: coach.bio,
      certification: coach.certification,
      hourly_rate: coach.hourly_rate.toString(),
      average_rating: coach.average_rating?.toString() ?? null,
      rating_count: coach.rating_count,
      is_available_for_booking: coach.is_available_for_booking,
      profile: this.toCoachUserProfile(coach),
    };
  }

  private toCoachDetail(coach: CoachDetailRecord): CoachDetailResponseDTO {
    return {
      ...this.toCoachListItem(coach),
      availability_slots: coach.availability_slots.map((slot) =>
        this.toAvailabilitySlot(slot),
      ),
    };
  }

  private toAdminCoachDetail(
    coach: CoachDetailRecord,
  ): AdminCoachDetailResponseDTO {
    return {
      ...this.toCoachDetail(coach),
      gym_commission_pct: coach.gym_commission_pct.toString(),
    };
  }

  private toCoachSelfDetail(
    coach: CoachDetailRecord,
  ): CoachSelfDetailResponseDTO {
    return {
      ...this.toCoachDetail(coach),
      user: {
        id: coach.user.id,
        profile: this.toCoachUserProfile(coach),
      },
    };
  }

  private toCoachUserProfile(
    coach: CoachListRecord,
  ): CoachUserProfileResponseDTO {
    return {
      first_name: coach.user.profile?.first_name ?? null,
      last_name: coach.user.profile?.last_name ?? null,
      avatar_url: coach.user.profile?.avatar_url ?? null,
    };
  }

  private toAvailabilitySlot(
    slot: CoachDetailRecord['availability_slots'][number],
  ): CoachAvailabilitySlotResponseDTO {
    return {
      id: slot.id,
      day_of_week: slot.day_of_week,
      start_time: this.toTimeString(slot.start_time),
      end_time: this.toTimeString(slot.end_time),
    };
  }

  private toTimeString(value: Date): string {
    const hours = value.getUTCHours().toString().padStart(2, '0');
    const minutes = value.getUTCMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  }

  private toTimeValue(value: Date): Date {
    return new Date(
      Date.UTC(1970, 0, 1, value.getUTCHours(), value.getUTCMinutes(), 0, 0),
    );
  }

  private toUtcCalendarDay(value: Date): string {
    return value.toISOString().slice(0, 10);
  }

  private buildCoachUnavailableError(): HttpException {
    return new HttpException(
      {
        type: 'BUSINESS_RULE_VIOLATION',
        title: 'Coach Unavailable',
        status: 422,
        detail:
          'The selected coach is not currently available for this reservation window.',
      },
      HttpStatus.UNPROCESSABLE_ENTITY,
    );
  }

  private buildCoachConflictError(): ConflictException {
    return new ConflictException({
      type: 'SCHEDULE_CONFLICT',
      title: 'Coach Schedule Conflict',
      status: 409,
      detail:
        'The selected coach already has another appointment or reservation during that time.',
    });
  }

  private didCommissionChange(
    before: CoachDetailRecord['gym_commission_pct'],
    after: CoachDetailRecord['gym_commission_pct'],
  ): boolean {
    return before.toString() !== after.toString();
  }

  private toCommissionAuditSnapshot(
    value: CoachDetailRecord['gym_commission_pct'],
  ): Prisma.InputJsonValue {
    return {
      gym_commission_pct: value.toString(),
    } as Prisma.InputJsonValue;
  }

  private emitAudit(event: AuditEvent): void {
    this.eventEmitter.emit('audit.log', event);
  }
}
