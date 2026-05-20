import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
} from '@nestjs/common';
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
    hasActiveAppointmentConflict: jest.fn(),
    hasActiveLinkedBookingConflict: jest.fn(),
    findCoachByIdOrThrow: jest.fn(),
    findCoachByUserIdOrThrow: jest.fn(),
    listActiveBookingDateKeys: jest.fn(),
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
      id: 'user-1',
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
    repo.listActiveBookingDateKeys.mockResolvedValue([]);
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
          display_name: 'Maria Santos',
          hourly_rate: '1200',
          average_rating: '4.75',
          availability_slots: [
            {
              id: 'slot-1',
              day_of_week: 1,
              start_time: '08:00',
              end_time: '10:00',
            },
          ],
          booked_dates: [],
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

  it('returns the authenticated coach profile with nested user details', async () => {
    repo.findCoachByUserIdOrThrow.mockResolvedValue(makeCoach());

    await expect(service.getMyProfile('user-1')).resolves.toEqual(
      expect.objectContaining({
        id: 'coach-1',
        user: {
          id: 'user-1',
          profile: {
            first_name: 'Maria',
            last_name: 'Santos',
            avatar_url: 'https://cdn.fittrack.test/avatars/maria.png',
          },
        },
      }),
    );
  });

  it('rejects gym commission updates from coach self-service', async () => {
    await expect(
      service.updateMyProfile('user-1', { gym_commission_pct: 25 }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(repo.updateCoachByUserId).not.toHaveBeenCalled();
  });

  it('rejects hourly rate updates from coach self-service', async () => {
    await expect(
      service.updateMyProfile('user-1', { hourly_rate: 1500 }),
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

  it('lets staff-facing management update non-financial coach fields', async () => {
    repo.updateCoachById.mockResolvedValue(
      makeCoach({
        bio: 'Updated from schedule management.',
        certification: 'NASM-CPT, CPR',
        is_available_for_booking: false,
        specialization: 'Strength, Mobility',
      }),
    );

    await expect(
      service.updateManagedProfile('coach-1', {
        bio: 'Updated from schedule management.',
        certification: 'NASM-CPT, CPR',
        is_available_for_booking: false,
        specialization: 'Strength, Mobility',
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        bio: 'Updated from schedule management.',
        certification: 'NASM-CPT, CPR',
        is_available_for_booking: false,
        specialization: 'Strength, Mobility',
      }),
    );

    expect(repo.updateCoachById).toHaveBeenCalledWith('coach-1', {
      bio: 'Updated from schedule management.',
      certification: 'NASM-CPT, CPR',
      is_available_for_booking: false,
      specialization: 'Strength, Mobility',
    });
    expect(eventEmitter.emit).not.toHaveBeenCalled();
  });

  it('rejects hourly rate updates from the staff-facing management flow', async () => {
    await expect(
      service.updateManagedProfile('coach-1', { hourly_rate: 1500 }),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(repo.updateCoachById).not.toHaveBeenCalled();
  });

  it('rejects gym commission updates from the staff-facing management flow', async () => {
    await expect(
      service.updateManagedProfile('coach-1', { gym_commission_pct: 35 }),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(repo.updateCoachById).not.toHaveBeenCalled();
  });

  it('rejects standalone coach profile creation', async () => {
    await expect(
      service.createStandaloneCoach({
        display_name: 'Standalone Coach',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('accepts coach-linked reservation windows that fit active availability with no conflicts', async () => {
    const startsAt = new Date('2099-03-23T00:30:00.000Z');
    const endsAt = new Date('2099-03-23T01:30:00.000Z');
    repo.findCoachByIdOrThrow.mockResolvedValue(
      makeCoach({
        availability_slots: [
          {
            id: 'slot-1',
            day_of_week: 1,
            start_time: START_TIME,
            end_time: END_TIME,
          },
        ],
      }),
    );
    repo.hasActiveAppointmentConflict.mockResolvedValue(false);
    repo.hasActiveLinkedBookingConflict.mockResolvedValue(false);

    await expect(
      service.assertCoachReservableForBookingWindow(
        'coach-1',
        startsAt,
        endsAt,
      ),
    ).resolves.toMatchObject({ id: 'coach-1' });

    expect(repo.hasActiveAppointmentConflict).toHaveBeenCalledWith(
      'coach-1',
      startsAt,
      endsAt,
    );
    expect(repo.hasActiveLinkedBookingConflict).toHaveBeenCalledWith(
      'coach-1',
      startsAt,
      endsAt,
    );
  });

  it('rejects coach-linked reservation windows outside active availability', async () => {
    const startsAt = new Date('2099-03-23T03:00:00.000Z');
    const endsAt = new Date('2099-03-23T04:00:00.000Z');
    repo.findCoachByIdOrThrow.mockResolvedValue(
      makeCoach({
        availability_slots: [
          {
            id: 'slot-1',
            day_of_week: 1,
            start_time: START_TIME,
            end_time: END_TIME,
          },
        ],
      }),
    );

    await expect(
      service.assertCoachReservableForBookingWindow(
        'coach-1',
        startsAt,
        endsAt,
      ),
    ).rejects.toBeInstanceOf(HttpException);

    expect(repo.hasActiveAppointmentConflict).not.toHaveBeenCalled();
    expect(repo.hasActiveLinkedBookingConflict).not.toHaveBeenCalled();
  });

  it('rejects coach-linked reservation windows when another coach appointment overlaps', async () => {
    const startsAt = new Date('2099-03-23T00:30:00.000Z');
    const endsAt = new Date('2099-03-23T01:30:00.000Z');
    repo.findCoachByIdOrThrow.mockResolvedValue(
      makeCoach({
        availability_slots: [
          {
            id: 'slot-1',
            day_of_week: 1,
            start_time: START_TIME,
            end_time: END_TIME,
          },
        ],
      }),
    );
    repo.hasActiveAppointmentConflict.mockResolvedValue(true);
    repo.hasActiveLinkedBookingConflict.mockResolvedValue(false);

    await expect(
      service.assertCoachReservableForBookingWindow(
        'coach-1',
        startsAt,
        endsAt,
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
