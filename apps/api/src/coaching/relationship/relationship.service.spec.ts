import {
  ConflictException,
  ForbiddenException,
  HttpException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Prisma, RelationshipStatus } from '@prisma/client';

import { RelationshipRepository } from './relationship.repository';
import { RELATIONSHIP_REQUESTED_EVENT } from './events/relationship-requested.event';
import { RELATIONSHIP_STATUS_CHANGED_EVENT } from './events/relationship-status-changed.event';
import { RelationshipService } from './relationship.service';

describe('RelationshipService', () => {
  let service: RelationshipService;

  const repo = {
    findCoachByIdOrThrow: jest.fn(),
    findCoachByUserIdOrThrow: jest.fn(),
    findOpenRelationshipPair: jest.fn(),
    findActiveRelationshipPair: jest.fn(),
    createRelationship: jest.fn(),
    getMyRelationships: jest.fn(),
    getCoachClients: jest.fn(),
    findRelationshipByIdOrThrow: jest.fn(),
    updateRelationship: jest.fn(),
    findReviewAppointmentContextByIdOrThrow: jest.fn(),
    createReviewAndRefreshCoachRating: jest.fn(),
  };

  const eventEmitter = {
    emit: jest.fn(),
  };

  const makeRelationship = (overrides: Record<string, unknown> = {}) => ({
    id: 'rel-1',
    coach_id: 'coach-1',
    member_id: 'member-1',
    status: RelationshipStatus.pending,
    notes: 'Looking for weekly coaching.',
    started_at: null,
    ended_at: null,
    created_at: new Date('2026-03-25T10:00:00.000Z'),
    updated_at: new Date('2026-03-25T10:00:00.000Z'),
    coach: {
      id: 'coach-1',
      specialization: 'Boxing',
      is_available_for_booking: true,
      user: {
        profile: {
          first_name: 'Maria',
          last_name: 'Santos',
          avatar_url: 'https://cdn.fittrack.test/avatars/maria.png',
        },
      },
    },
    member: {
      id: 'member-1',
      profile: {
        first_name: 'Juan',
        last_name: 'Dela Cruz',
        avatar_url: 'https://cdn.fittrack.test/avatars/juan.png',
      },
    },
    ...overrides,
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RelationshipService,
        { provide: RelationshipRepository, useValue: repo },
        { provide: EventEmitter2, useValue: eventEmitter },
      ],
    }).compile();

    service = module.get<RelationshipService>(RelationshipService);
    jest.clearAllMocks();
  });

  it('creates pending relationship requests for new coach-member pairs', async () => {
    repo.findCoachByIdOrThrow.mockResolvedValue({
      id: 'coach-1',
      user_id: 'coach-user-1',
    });
    repo.findOpenRelationshipPair.mockResolvedValue(null);
    repo.createRelationship.mockResolvedValue(makeRelationship());

    const result = await service.requestRelationship('member-1', {
      coach_id: 'coach-1',
      notes: 'Looking for weekly coaching.',
    });

    expect(result.id).toBe('rel-1');
    expect(result.status).toBe(RelationshipStatus.pending);
    expect(result.coach.id).toBe('coach-1');
    expect(eventEmitter.emit).toHaveBeenCalledWith(
      RELATIONSHIP_REQUESTED_EVENT,
      expect.objectContaining({
        relationshipId: 'rel-1',
      }),
    );
  });

  it('rejects duplicate pending or active relationship requests', async () => {
    repo.findCoachByIdOrThrow.mockResolvedValue({
      id: 'coach-1',
      user_id: 'coach-user-1',
    });
    repo.findOpenRelationshipPair.mockResolvedValue({
      id: 'rel-existing',
      status: RelationshipStatus.active,
    });

    await expect(
      service.requestRelationship('member-1', {
        coach_id: 'coach-1',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(repo.createRelationship).not.toHaveBeenCalled();
  });

  it('maps paginated coach client relationships', async () => {
    repo.findCoachByUserIdOrThrow.mockResolvedValue({
      id: 'coach-1',
      user_id: 'coach-user-1',
    });
    repo.getCoachClients.mockResolvedValue({
      data: [makeRelationship()],
      meta: { page: 1, limit: 20, total: 1, total_pages: 1 },
    });

    const result = await service.getMyClients('coach-user-1', {
      page: 1,
      limit: 20,
    });

    expect(result.meta).toEqual({
      page: 1,
      limit: 20,
      total: 1,
      total_pages: 1,
    });
    expect(result.data[0]?.id).toBe('rel-1');
    expect(result.data[0]?.member.id).toBe('member-1');
  });

  it('confirms active coach-member relationships for downstream domain work', async () => {
    repo.findCoachByUserIdOrThrow.mockResolvedValue({
      id: 'coach-1',
      user_id: 'coach-user-1',
    });
    repo.findActiveRelationshipPair.mockResolvedValue({
      id: 'rel-1',
      coach_id: 'coach-1',
      member_id: 'member-1',
      status: RelationshipStatus.active,
    });

    await expect(
      service.assertActiveClientRelationship('coach-user-1', 'member-1'),
    ).resolves.toBeUndefined();
  });

  it('rejects downstream coach actions without an active relationship', async () => {
    repo.findCoachByUserIdOrThrow.mockResolvedValue({
      id: 'coach-1',
      user_id: 'coach-user-1',
    });
    repo.findActiveRelationshipPair.mockResolvedValue(null);

    await expect(
      service.assertActiveClientRelationship('coach-user-1', 'member-1'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('activates pending relationships for the owning coach', async () => {
    repo.findCoachByUserIdOrThrow.mockResolvedValue({
      id: 'coach-1',
      user_id: 'coach-user-1',
    });
    repo.findRelationshipByIdOrThrow.mockResolvedValue(makeRelationship());
    repo.updateRelationship.mockResolvedValue(
      makeRelationship({
        status: RelationshipStatus.active,
        started_at: new Date('2026-03-26T09:00:00.000Z'),
      }),
    );

    const result = await service.updateRelationship('coach-user-1', 'rel-1', {
      status: RelationshipStatus.active,
      notes: 'Approved for weekly sessions.',
    });

    expect(repo.updateRelationship).toHaveBeenCalledWith(
      'rel-1',
      expect.objectContaining({
        status: RelationshipStatus.active,
        ended_at: null,
      }),
    );
    expect(result.status).toBe(RelationshipStatus.active);
    expect(result.started_at).toBe('2026-03-26T09:00:00.000Z');
    expect(eventEmitter.emit).toHaveBeenCalledWith(
      RELATIONSHIP_STATUS_CHANGED_EVENT,
      expect.objectContaining({
        relationshipId: 'rel-1',
        previousStatus: RelationshipStatus.pending,
        nextStatus: RelationshipStatus.active,
      }),
    );
  });

  it('rejects relationship updates from non-owning coaches', async () => {
    repo.findCoachByUserIdOrThrow.mockResolvedValue({
      id: 'coach-2',
      user_id: 'coach-user-2',
    });
    repo.findRelationshipByIdOrThrow.mockResolvedValue(makeRelationship());

    await expect(
      service.updateRelationship('coach-user-2', 'rel-1', {
        status: RelationshipStatus.active,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(repo.updateRelationship).not.toHaveBeenCalled();
  });

  it('submits reviews for completed appointments and returns refreshed rating stats', async () => {
    repo.findReviewAppointmentContextByIdOrThrow.mockResolvedValue({
      id: 'appt-1',
      user_id: 'member-1',
      coach_id: 'coach-1',
      status: 'completed',
      completed_at: new Date('2026-03-25T10:00:00.000Z'),
      review: null,
    });
    repo.createReviewAndRefreshCoachRating.mockResolvedValue({
      review: {
        id: 'review-1',
        coach_id: 'coach-1',
        reviewer_id: 'member-1',
        appointment_id: 'appt-1',
        rating: 5,
        comment: 'Great session.',
        created_at: new Date('2026-03-25T11:00:00.000Z'),
        updated_at: new Date('2026-03-25T11:00:00.000Z'),
      },
      averageRating: new Prisma.Decimal('4.50'),
      ratingCount: 8,
    });

    await expect(
      service.submitReview('member-1', 'coach-1', {
        appointment_id: 'appt-1',
        rating: 5,
        comment: 'Great session.',
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        id: 'review-1',
        coach_average_rating: '4.5',
        coach_rating_count: 8,
      }),
    );
  });

  it('rejects reviews before the appointment is completed', async () => {
    repo.findReviewAppointmentContextByIdOrThrow.mockResolvedValue({
      id: 'appt-1',
      user_id: 'member-1',
      coach_id: 'coach-1',
      status: 'confirmed',
      completed_at: null,
      review: null,
    });

    await expect(
      service.submitReview('member-1', 'coach-1', {
        appointment_id: 'appt-1',
        rating: 4,
      }),
    ).rejects.toBeInstanceOf(HttpException);
    expect(repo.createReviewAndRefreshCoachRating).not.toHaveBeenCalled();
  });
});
