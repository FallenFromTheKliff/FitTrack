import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  BadRequestException,
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
  CreateStandaloneCoachDTO,
  CoachAvailabilitySlotResponseDTO,
  CoachDetailResponseDTO,
  CoachFilterDTO,
  CoachListItemResponseDTO,
  CoachPublicReviewResponseDTO,
  CoachSelfDetailResponseDTO,
  CoachSpecialtyFilterDTO,
  CoachSpecialtyResponseDTO,
  CoachUserProfileResponseDTO,
  UpdateCoachProfileDTO,
} from './dto/coach.dto';
import {
  CoachDetailRecord,
  CoachListRecord,
  CoachRepository,
  CoachSpecialtyRecord,
  CoachSpecialtySelection,
} from './coach.repository';

type CoachUserProfileRecord = NonNullable<CoachDetailRecord['user']>['profile'];

const COACH_SELF_UPDATE_FIELDS = [
  'display_name',
  'contact_email',
  'contact_phone',
  'specialization',
  'bio',
  'certification',
  'is_available_for_booking',
] as const;

const COACH_ADMIN_UPDATE_FIELDS = [
  ...COACH_SELF_UPDATE_FIELDS,
  'hourly_rate',
  'monthly_rate',
  'monthly_session_count',
  'monthly_session_duration_minutes',
  'monthly_offer_description',
  'monthly_offer_active',
  'gym_commission_pct',
  'schedule_type',
] as const;
const COACH_STAFF_UPDATE_FIELDS = [
  ...COACH_SELF_UPDATE_FIELDS,
  'monthly_rate',
  'monthly_session_count',
  'monthly_session_duration_minutes',
  'monthly_offer_description',
  'monthly_offer_active',
] as const;
const EMAIL_LIKE_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const GYM_TIMEZONE_OFFSET_MINUTES = 8 * 60;

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

function normalizeStandaloneDisplayName(value?: string | null) {
  const displayName = value?.trim();
  if (displayName && !EMAIL_LIKE_PATTERN.test(displayName)) {
    return displayName;
  }

  return null;
}

function getUserProfileDisplayName(profile?: CoachUserProfileRecord | null) {
  return [profile?.first_name, profile?.last_name]
    .map((part) => part?.trim() ?? '')
    .filter(Boolean)
    .join(' ')
    .trim();
}

function getCoachDisplayName(
  coach: Pick<CoachListRecord, 'display_name' | 'user'>,
) {
  return (
    normalizeStandaloneDisplayName(coach.display_name) ||
    getUserProfileDisplayName(coach.user?.profile) ||
    null
  );
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
    const bookedDatesByCoachId = new Map(
      await Promise.all(
        result.data.map(async (coach) => {
          const bookedDates = await this.repo.listActiveBookingDateKeys(
            coach.id,
            new Date(),
            120,
          );
          return [coach.id, bookedDates] as const;
        }),
      ),
    );

    return {
      data: result.data.map((coach) =>
        this.toCoachListItem(coach, bookedDatesByCoachId.get(coach.id) ?? []),
      ),
      meta: result.meta,
    };
  }

  async listSpecialties(
    dto: CoachSpecialtyFilterDTO,
  ): Promise<PaginatedResult<CoachSpecialtyResponseDTO>> {
    const result = await this.repo.listSpecialties(dto);

    return {
      data: result.data.map((specialty) => this.toCoachSpecialty(specialty)),
      meta: result.meta,
    };
  }

  async getCoachById(id: string): Promise<CoachDetailResponseDTO> {
    const coach = await this.repo.findCoachByIdOrThrow(id);
    const bookedDates = await this.repo.listActiveBookingDateKeys(
      id,
      new Date(),
      120,
    );

    return this.toCoachDetail(coach, bookedDates);
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

    const selection = this.toSpecialtySelection(dto);
    const data = this.toSelfUpdateInput(dto);
    const updated = selection
      ? await this.repo.updateCoachByUserIdWithSpecialties(
          userId,
          data,
          selection,
        )
      : await this.repo.updateCoachByUserId(userId, data);

    return this.toCoachDetail(updated);
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

    const selection = this.toSpecialtySelection(dto);
    const data = this.toAdminUpdateInput(dto);
    const updated = selection
      ? await this.repo.updateCoachByIdWithSpecialties(
          coachId,
          data,
          selection,
        )
      : await this.repo.updateCoachById(coachId, data);

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
    this.assertStaffManagedFields(dto);

    const selection = this.toSpecialtySelection(dto);
    const data = this.toStaffUpdateInput(dto);
    const updated = selection
      ? await this.repo.updateCoachByIdWithSpecialties(
          coachId,
          data,
          selection,
        )
      : await this.repo.updateCoachById(coachId, data);

    return this.toCoachDetail(updated);
  }

  createStandaloneCoach(
    dto: CreateStandaloneCoachDTO,
  ): Promise<CoachDetailResponseDTO> {
    void dto;
    return Promise.reject(
      new BadRequestException(
        'Create coach user accounts from the Accounts page. Coach profiles are tied to coach-role accounts only.',
      ),
    );
  }

  async assertCoachReservableForBookingWindow(
    coachId: string,
    startsAt: Date,
    endsAt: Date,
  ): Promise<CoachDetailRecord> {
    const coach = await this.repo.findCoachByIdOrThrow(coachId);

    if (!coach.is_available_for_booking) {
      throw this.buildCoachUnavailableError();
    }

    if (this.toGymDateKey(startsAt) !== this.toGymDateKey(endsAt)) {
      throw new HttpException(
        {
          type: 'BUSINESS_RULE_VIOLATION',
          title: 'Invalid Coach Reservation Window',
          status: 422,
          detail:
            'Coach-linked venue reservations must begin and end on the same gym calendar day.',
        },
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }

    const dayOfWeek = this.toGymDayOfWeek(startsAt);
    const slotStart = this.toTimeValue(this.toGymTimeString(startsAt));
    const slotEnd = this.toTimeValue(this.toGymTimeString(endsAt));
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

    return coach;
  }

  private assertCoachOwnedFields(dto: UpdateCoachProfileDTO): void {
    const commercialField = [
      'monthly_rate',
      'monthly_session_count',
      'monthly_session_duration_minutes',
      'monthly_offer_description',
      'monthly_offer_active',
    ].find((field) => dto[field as keyof UpdateCoachProfileDTO] !== undefined);

    if (commercialField) {
      throw new ForbiddenException({
        type: 'FORBIDDEN',
        title: 'Monthly Offer Update Forbidden',
        status: 403,
        detail:
          'Only admin or staff users can update the coach monthly coaching offer.',
      });
    }

    if (dto.gym_commission_pct !== undefined) {
      throw new ForbiddenException({
        type: 'FORBIDDEN',
        title: 'Commission Update Forbidden',
        status: 403,
        detail: 'Only admin users can update gym_commission_pct.',
      });
    }
    if (dto.schedule_type !== undefined) {
      throw new ForbiddenException({
        type: 'FORBIDDEN',
        title: 'Schedule Type Update Forbidden',
        status: 403,
        detail: 'Only admin users can update a coach schedule_type.',
      });
    }
    if (dto.hourly_rate !== undefined) {
      throw new ForbiddenException({
        type: 'FORBIDDEN',
        title: 'Rate Update Forbidden',
        status: 403,
        detail: 'Only admin users can update a coach hourly_rate.',
      });
    }
  }

  private assertStaffManagedFields(dto: UpdateCoachProfileDTO): void {
    if (dto.schedule_type !== undefined) {
      throw new ForbiddenException({
        type: 'FORBIDDEN',
        title: 'Schedule Type Update Forbidden',
        status: 403,
        detail: 'Only admin users can update a coach schedule_type.',
      });
    }
    if (dto.gym_commission_pct !== undefined) {
      throw new ForbiddenException({
        type: 'FORBIDDEN',
        title: 'Commission Update Forbidden',
        status: 403,
        detail: 'Only admin users can update gym_commission_pct.',
      });
    }
    if (dto.hourly_rate !== undefined) {
      throw new ForbiddenException({
        type: 'FORBIDDEN',
        title: 'Rate Update Forbidden',
        status: 403,
        detail: 'Only admin users can update a coach hourly_rate.',
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

  private toStaffUpdateInput(
    dto: UpdateCoachProfileDTO,
  ): Prisma.CoachProfileUpdateInput {
    return {
      ...pickDefined(dto, COACH_STAFF_UPDATE_FIELDS),
    };
  }

  private toAdminUpdateInput(
    dto: UpdateCoachProfileDTO,
  ): Prisma.CoachProfileUpdateInput {
    return {
      ...pickDefined(dto, COACH_ADMIN_UPDATE_FIELDS),
    };
  }

  private toSpecialtySelection(
    dto: UpdateCoachProfileDTO,
  ): CoachSpecialtySelection | undefined {
    if (dto.specialty_ids !== undefined || dto.specialty_labels !== undefined) {
      return {
        specialty_ids: dto.specialty_ids ?? [],
        specialty_labels: dto.specialty_labels ?? [],
      };
    }

    return undefined;
  }

  private toCoachListItem(
    coach: CoachListRecord,
    bookedDates: string[] = [],
  ): CoachListItemResponseDTO {
    return {
      id: coach.id,
      display_name: getCoachDisplayName(coach),
      contact_email: coach.contact_email,
      contact_phone: coach.contact_phone,
      specialization: coach.specialization,
      specialties: coach.specialties
        .map((entry) => this.toCoachSpecialty(entry.specialty))
        .sort((left, right) => left.label.localeCompare(right.label)),
      bio: coach.bio,
      certification: coach.certification,
      hourly_rate: coach.hourly_rate.toString(),
      monthly_rate: coach.monthly_rate.toString(),
      monthly_session_count: coach.monthly_session_count,
      monthly_session_duration_minutes: coach.monthly_session_duration_minutes,
      monthly_offer_description: coach.monthly_offer_description,
      monthly_offer_active: coach.monthly_offer_active,
      schedule_type: coach.schedule_type,
      average_rating: coach.average_rating?.toString() ?? null,
      rating_count: coach.rating_count,
      recent_reviews: (coach.reviews ?? []).map((review) =>
        this.toPublicReview(review),
      ),
      is_available_for_booking: coach.is_available_for_booking,
      profile: this.toCoachUserProfile(coach.user?.profile),
      availability_slots: coach.availability_slots.map((slot) =>
        this.toAvailabilitySlot(slot),
      ),
      booked_dates: bookedDates,
    };
  }

  private toPublicReview(
    review: CoachListRecord['reviews'][number],
  ): CoachPublicReviewResponseDTO {
    const firstName = review.reviewer.profile?.first_name?.trim();
    const lastInitial = review.reviewer.profile?.last_name?.trim()?.[0];
    const reviewerName = firstName
      ? `${firstName}${lastInitial ? ` ${lastInitial}.` : ''}`
      : 'FitTrack member';

    return {
      id: review.id,
      rating: review.rating,
      comment: review.comment,
      reviewer_name: reviewerName,
      created_at: review.created_at.toISOString(),
    };
  }

  private toCoachDetail(
    coach: CoachDetailRecord,
    bookedDates: string[] = [],
  ): CoachDetailResponseDTO {
    return {
      ...this.toCoachListItem(coach, bookedDates),
    };
  }

  private toCoachSpecialty(
    specialty: CoachSpecialtyRecord | CoachListRecord['specialties'][number]['specialty'],
  ): CoachSpecialtyResponseDTO {
    return {
      id: specialty.id,
      label: specialty.display_label,
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
    if (!coach.user) {
      throw new ForbiddenException({
        type: 'FORBIDDEN',
        title: 'Coach Self Profile Unavailable',
        status: 403,
        detail: 'Standalone coaches do not own a self-service profile.',
      });
    }

    return {
      ...this.toCoachDetail(coach),
      user: {
        id: coach.user.id,
        profile: this.toCoachUserProfile(coach.user.profile),
      },
    };
  }

  private toCoachUserProfile(
    profile?: CoachUserProfileRecord | null,
  ): CoachUserProfileResponseDTO {
    return {
      first_name: profile?.first_name ?? null,
      last_name: profile?.last_name ?? null,
      avatar_url: profile?.avatar_url ?? null,
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

  private toTimeValue(value: string): Date {
    const [hours = 0, minutes = 0] = value.split(':').map(Number);
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
