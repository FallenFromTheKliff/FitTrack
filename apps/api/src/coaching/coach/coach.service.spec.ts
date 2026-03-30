import { EventEmitter2 } from '@nestjs/event-emitter';
import { ForbiddenException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { AuditAction } from '../../audit/audit.service';
import { CoachRepository } from './coach.repository';
import { CoachService } from './coach.service';

const START_TIME = new Date(Date.UTC(1970, 0, 1, 8, 0, 0));
const END_TIME = new Date(Date.UTC(1970, 0, 1, 10, 0, 0));

describe('CoachService', () => {
  let service: CoachService;

  const repo = {
    listAvailableCoaches: jest.fn(),
    findCoachByIdOrThrow: jest.fn(),
    updateCoachByUserId: jest.fn(),
    updateCoachById: jest.fn(),
  };
  const eventEmitter = {
    emit: jest.fn(),
  };

  const makeCoach = (overrides: Record<string, unknown> = {}) => ({
    id: 'coach-1',
    specialization: 'Strength and conditioning',
    bio: 'Builds athletic performance programs.',
    certification: 'NASM-CPT',
    hourly_rate: 1200,
    average_rating: 4.75,
    rating_count: 12,
    gym_commission_pct: 20,
    is_available_for_booking: true,
    user: {
      profile: {
        first_name: 'Maria',
        last_name: 'Santos',
        avatar_url: 'https://cdn.fittrack.test/avatars/maria.png',
      },
    },
    availability_slots: [
      {
        id: 'slot-1',
        day_of_week: 1,
        start_time: START_TIME,
        end_time: END_TIME,
      },
    ],
    ...overrides,
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CoachService,
        { provide: CoachRepository, useValue: repo },
        { provide: EventEmitter2, useValue: eventEmitter },
      ],
    }).compile();

    service = module.get<CoachService>(CoachService);
    jest.clearAllMocks();
  });

  it('maps paginated coach browse results to response DTOs', async () => {
    repo.listAvailableCoaches.mockResolvedValue({
      data: [makeCoach()],
      meta: { page: 1, limit: 20, total: 1, total_pages: 1 },
    });

    await expect(service.listCoaches({})).resolves.toEqual({
      data: [
        expect.objectContaining({
          id: 'coach-1',
          hourly_rate: '1200',
          average_rating: '4.75',
          profile: {
            first_name: 'Maria',
            last_name: 'Santos',
            avatar_url: 'https://cdn.fittrack.test/avatars/maria.png',
          },
        }),
      ],
      meta: { page: 1, limit: 20, total: 1, total_pages: 1 },
    });
  });

  it('formats active availability when loading a coach profile', async () => {
    repo.findCoachByIdOrThrow.mockResolvedValue(makeCoach());

    await expect(service.getCoachById('coach-1')).resolves.toEqual(
      expect.objectContaining({
        availability_slots: [
          {
            id: 'slot-1',
            day_of_week: 1,
            start_time: '08:00',
            end_time: '10:00',
          },
        ],
      }),
    );
  });

  it('rejects gym commission updates from coach self-service', async () => {
    await expect(
      service.updateMyProfile('user-1', { gym_commission_pct: 25 }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(repo.updateCoachByUserId).not.toHaveBeenCalled();
  });

  it('lets admins update commission fields', async () => {
    repo.findCoachByIdOrThrow.mockResolvedValue(makeCoach());
    repo.updateCoachById.mockResolvedValue(
      makeCoach({ gym_commission_pct: 25 }),
    );

    await expect(
      service.adminUpdateCoach('admin-1', 'coach-1', {
        gym_commission_pct: 25,
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        gym_commission_pct: '25',
      }),
    );
    expect(repo.updateCoachById).toHaveBeenCalledWith('coach-1', {
      gym_commission_pct: 25,
    });
    expect(eventEmitter.emit).toHaveBeenCalledWith('audit.log', {
      userId: 'admin-1',
      action: AuditAction.COACH_COMMISSION_CHANGED,
      entity: 'CoachProfile',
      entityId: 'coach-1',
      before: { gym_commission_pct: '20' },
      after: { gym_commission_pct: '25' },
    });
  });

  it('does not emit a commission audit event for non-commission admin updates', async () => {
    repo.updateCoachById.mockResolvedValue(makeCoach({ bio: 'Updated bio' }));

    await expect(
      service.adminUpdateCoach('admin-1', 'coach-1', { bio: 'Updated bio' }),
    ).resolves.toEqual(
      expect.objectContaining({
        bio: 'Updated bio',
      }),
    );

    expect(repo.findCoachByIdOrThrow).not.toHaveBeenCalled();
    expect(eventEmitter.emit).not.toHaveBeenCalled();
  });
});
