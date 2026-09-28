import {
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { CoachReview, Prisma, RelationshipStatus } from '@prisma/client';

import { PaginatedResult } from '../../common/base-repository/base-repository';
import {
  CoachClientFilterDTO,
  CoachingReviewResponseDTO,
  CreateReviewDTO,
  RelationshipCoachSummaryResponseDTO,
  RelationshipMemberSummaryResponseDTO,
  RelationshipResponseDTO,
  RelationshipUpcomingSessionResponseDTO,
  RelationshipUserProfileResponseDTO,
  RequestRelationshipDTO,
  UpdateRelationshipDTO,
} from './dto/relationship.dto';
import {
  CoachClientRecord,
  RelationshipRecord,
  RelationshipRepository,
  ReviewAppointmentContext,
} from './relationship.repository';
import {
  RELATIONSHIP_STATUS_CHANGED_EVENT,
  type RelationshipStatusChangedEvent,
} from './events/relationship-status-changed.event';

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

function getReviewUserName(profile?: {
  first_name?: string | null;
  last_name?: string | null;
} | null) {
  const name = [profile?.first_name, profile?.last_name].filter(Boolean).join(' ').trim();
  return name || 'Unknown member';
}

@Injectable()
export class RelationshipService {
  constructor(
    private readonly repo: RelationshipRepository,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async requestRelationship(
    userId: string,
    dto: RequestRelationshipDTO,
  ): Promise<RelationshipResponseDTO> {
    void userId;
    void dto;
    throw new HttpException(
      {
        type: 'GONE',
        title: 'Relationship Requests Retired',
        status: HttpStatus.GONE,
        detail:
          'Coaching clients are created only after full online payment or an atomic staff cash enrollment.',
      },
      HttpStatus.GONE,
    );
  }

  async getMyRelationships(userId: string): Promise<RelationshipResponseDTO[]> {
    return (await this.repo.getMyRelationships(userId)).map((relationship) =>
      this.toRelationshipResponse(relationship),
    );
  }

  async getMyClients(
    coachUserId: string,
    dto: CoachClientFilterDTO,
  ): Promise<PaginatedResult<RelationshipResponseDTO>> {
    const coach = await this.repo.findCoachByUserIdOrThrow(coachUserId);
    const result = await this.repo.getCoachClients(coach.id, dto);

    return {
      data: result.data.map((relationship) =>
        this.toRelationshipResponse(relationship),
      ),
      meta: result.meta,
    };
  }

  async assertActiveClientRelationship(
    coachUserId: string,
    memberId: string,
  ): Promise<void> {
    const coach = await this.repo.findCoachByUserIdOrThrow(coachUserId);
    const relationship = await this.repo.findActiveRelationshipPair(
      coach.id,
      memberId,
    );

    if (!relationship) {
      throw new ForbiddenException({
        type: 'FORBIDDEN',
      title: 'Coach Client Relationship Required',
      status: 403,
      detail:
        'You can only create coach-managed appointments or assign training plans to members with an active coaching relationship.',
      });
    }
  }

  async assertCoachClientAccess(
    coachUserId: string,
    memberId: string,
  ): Promise<void> {
    const coach = await this.repo.findCoachByUserIdOrThrow(coachUserId);
    if (await this.repo.findValidPaidOneTimeAppointment(coach.id, memberId)) {
      return;
    }

    if (!(await this.repo.findActivePaidMonthlyPlan(coach.id, memberId))) {
      throw new ForbiddenException({
        type: 'FORBIDDEN',
        title: 'Coach Client Access Required',
        status: 403,
        detail:
          'You can only manage a member with an active monthly relationship or a valid paid one-time coaching appointment.',
      });
    }
  }

  hasActiveCoach(memberId: string): Promise<boolean> {
    return this.repo.hasActiveRelationshipForMember(memberId);
  }

  getActiveCoachUserId(memberId: string): Promise<string | null> {
    return this.repo.findActiveCoachUserIdForMember(memberId);
  }

  async updateRelationship(
    coachUserId: string,
    relationshipId: string,
    dto: UpdateRelationshipDTO,
  ): Promise<RelationshipResponseDTO> {
    const coach = await this.repo.findCoachByUserIdOrThrow(coachUserId);
    const relationship =
      await this.repo.findRelationshipByIdOrThrow(relationshipId);

    this.assertRelationshipOwnership(relationship, coach.id);

    const updated = await this.repo.updateRelationship(
      relationship.id,
      this.buildRelationshipUpdateInput(relationship, dto),
    );
    this.emitRelationshipStatusChanged({
      relationshipId: updated.id,
      coachId: updated.coach_id,
      memberId: updated.member_id,
      previousStatus: relationship.status,
      nextStatus: updated.status,
    });

    return this.toRelationshipResponse(updated);
  }

  async submitReview(
    userId: string,
    coachId: string,
    dto: CreateReviewDTO,
  ): Promise<CoachingReviewResponseDTO> {
    const appointment = await this.repo.findReviewAppointmentContextByIdOrThrow(
      dto.appointment_id,
    );

    this.assertReviewOwnership(appointment, userId);
    this.assertReviewCoachMatches(appointment, coachId);
    this.assertReviewAllowed(appointment);

    const reviewWrite = await this.repo.createReviewAndRefreshCoachRating({
      coachId,
      reviewerId: userId,
      appointmentId: dto.appointment_id,
      rating: dto.rating,
      comment: dto.comment,
    });

    return this.toReviewResponse(
      reviewWrite.review,
      reviewWrite.averageRating,
      reviewWrite.ratingCount,
    );
  }

  async getMyReceivedReviews(coachUserId: string) {
    const coach = await this.repo.findCoachByUserIdOrThrow(coachUserId);
    const reviews = await this.repo.listCoachReviewsForCoach(coach.id);

    return reviews.map((review) => ({
      appointment_id: review.appointment_id,
      comment: review.comment ?? null,
      created_at: review.created_at.toISOString(),
      id: review.id,
      rating: review.rating,
      reviewer: {
        id: review.reviewer.id,
        name: getReviewUserName(review.reviewer.profile),
      },
      scheduled_at: review.appointment.scheduled_at.toISOString(),
      updated_at: review.updated_at.toISOString(),
    }));
  }

  private assertRelationshipOwnership(
    relationship: RelationshipRecord,
    coachId: string,
  ): void {
    if (relationship.coach_id !== coachId) {
      throw new ForbiddenException({
        type: 'FORBIDDEN',
        title: 'Forbidden',
        status: 403,
        detail: 'You can only update your own coaching relationships.',
      });
    }
  }

  private buildRelationshipUpdateInput(
    relationship: RelationshipRecord,
    dto: UpdateRelationshipDTO,
  ): Prisma.CoachClientRelationshipUpdateInput {
    if (relationship.status === RelationshipStatus.terminated) {
      throw new HttpException(
        {
          type: 'BUSINESS_RULE_VIOLATION',
          title: 'Relationship Already Terminated',
          status: 422,
          detail: 'Terminated coaching relationships cannot be updated again.',
        },
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }

    if (
      dto.status === RelationshipStatus.paused &&
      relationship.status === RelationshipStatus.pending
    ) {
      throw new HttpException(
        {
          type: 'BUSINESS_RULE_VIOLATION',
          title: 'Relationship Cannot Be Paused',
          status: 422,
          detail:
            'A pending coaching relationship must be activated before it can be paused.',
        },
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }

    const baseUpdate = pickDefined(dto, ['notes']);

    if (dto.status === RelationshipStatus.active) {
      return {
        ...baseUpdate,
        status: RelationshipStatus.active,
        started_at: relationship.started_at ?? new Date(),
        ended_at: null,
      };
    }

    if (dto.status === RelationshipStatus.paused) {
      return {
        ...baseUpdate,
        status: RelationshipStatus.paused,
        ended_at: null,
      };
    }

    return {
      ...baseUpdate,
      status: RelationshipStatus.terminated,
      ended_at: new Date(),
    };
  }

  private assertReviewOwnership(
    appointment: ReviewAppointmentContext,
    userId: string,
  ): void {
    if (appointment.user_id !== userId) {
      throw new ForbiddenException({
        type: 'FORBIDDEN',
        title: 'Forbidden',
        status: 403,
        detail: 'You can only review your own completed coaching appointments.',
      });
    }
  }

  private assertReviewCoachMatches(
    appointment: ReviewAppointmentContext,
    coachId: string,
  ): void {
    if (appointment.coach_id !== coachId) {
      throw new HttpException(
        {
          type: 'BUSINESS_RULE_VIOLATION',
          title: 'Appointment Coach Mismatch',
          status: 422,
          detail:
            'The submitted appointment does not belong to the coach in this review route.',
        },
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }
  }

  private assertReviewAllowed(appointment: ReviewAppointmentContext): void {
    if (
      appointment.status !== 'completed' ||
      appointment.completed_at === null
    ) {
      throw new HttpException(
        {
          type: 'BUSINESS_RULE_VIOLATION',
          title: 'Review Not Allowed Yet',
          status: 422,
          detail:
            'Reviews can only be submitted after the coaching appointment is completed.',
        },
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }

    if (appointment.review) {
      throw new ConflictException({
        type: 'CONFLICT',
        title: 'Review Already Submitted',
        status: 409,
        detail:
          'A review has already been submitted for this coaching appointment.',
      });
    }
  }

  private toRelationshipResponse(
    relationship: CoachClientRecord,
  ): RelationshipResponseDTO {
    return {
      id: relationship.id,
      coach_id: relationship.coach_id,
      member_id: relationship.member_id,
      status: relationship.status,
      notes: relationship.notes ?? null,
      started_at: relationship.started_at?.toISOString() ?? null,
      ended_at: relationship.ended_at?.toISOString() ?? null,
      created_at: relationship.created_at.toISOString(),
      updated_at: relationship.updated_at.toISOString(),
      coach: this.toCoachSummary(relationship),
      member: this.toMemberSummary(relationship),
    };
  }

  private toCoachSummary(
    relationship: CoachClientRecord,
  ): RelationshipCoachSummaryResponseDTO {
    return {
      id: relationship.coach.id,
      specialization: relationship.coach.specialization,
      is_available_for_booking: relationship.coach.is_available_for_booking,
      profile: this.toUserProfile(null),
    };
  }

  private toMemberSummary(
    relationship: CoachClientRecord,
  ): RelationshipMemberSummaryResponseDTO {
    return {
      email:
        relationship.member.auth_identities.find(
          (identity) => identity.provider === 'email',
        )?.identifier ??
        relationship.member.auth_identities[0]?.identifier ??
        null,
      email_verified: relationship.member.email_verified_at !== null,
      id: relationship.member.id,
      last_check_in_at:
        relationship.member.attendance_logs[0]?.check_in_at?.toISOString() ??
        null,
      membership_card: relationship.member.membership_card
        ? { status: relationship.member.membership_card.status }
        : null,
      phone_no: relationship.member.profile?.phone ?? null,
      phone_verified: relationship.member.phone_verified_at !== null,
      profile: this.toUserProfile(relationship.member.profile),
      status: relationship.member.status,
      upcoming_sessions: (relationship.member.member_appointments ?? [])
        .filter((appointment) => appointment.coach_id === relationship.coach_id)
        .map(
          (appointment): RelationshipUpcomingSessionResponseDTO => ({
            duration_minutes: appointment.duration_minutes,
            id: appointment.id,
            scheduled_at: appointment.scheduled_at.toISOString(),
            status: appointment.status,
          }),
        ),
    };
  }

  private toUserProfile(
    profile:
      | {
          activity_level: string | null;
          date_of_birth: Date | null;
          first_name: string;
          fitness_goal: string | null;
          gender: string | null;
          height_cm: Prisma.Decimal | null;
           last_name: string;
           avatar_url: string | null;
           membership_type?: string | null;
          weight_kg: Prisma.Decimal | null;
        }
      | null
      | undefined,
  ): RelationshipUserProfileResponseDTO {
    return {
      activity_level: profile?.activity_level ?? null,
      date_of_birth: profile?.date_of_birth?.toISOString() ?? null,
      first_name: profile?.first_name ?? null,
      fitness_goal: profile?.fitness_goal ?? null,
      gender: profile?.gender ?? null,
      height_cm: profile?.height_cm?.toNumber() ?? null,
      last_name: profile?.last_name ?? null,
      avatar_url: profile?.avatar_url ?? null,
      membership_type: profile?.membership_type ?? null,
      weight_kg: profile?.weight_kg?.toNumber() ?? null,
    };
  }

  private toReviewResponse(
    review: CoachReview,
    averageRating: Prisma.Decimal,
    ratingCount: number,
  ): CoachingReviewResponseDTO {
    return {
      id: review.id,
      coach_id: review.coach_id,
      reviewer_id: review.reviewer_id,
      appointment_id: review.appointment_id,
      rating: review.rating,
      comment: review.comment ?? null,
      coach_average_rating: averageRating.toString(),
      coach_rating_count: ratingCount,
      created_at: review.created_at.toISOString(),
      updated_at: review.updated_at.toISOString(),
    };
  }

  private emitRelationshipStatusChanged(
    event: RelationshipStatusChangedEvent,
  ): void {
    this.eventEmitter.emit(RELATIONSHIP_STATUS_CHANGED_EVENT, event);
  }
}
