import { Test, TestingModule } from '@nestjs/testing';
import { GymFaqCategory } from '@prisma/client';

import { GymKnowledgeRepository } from './gym-knowledge.repository';
import { GymKnowledgeService } from './gym-knowledge.service';

describe('GymKnowledgeService', () => {
  let service: GymKnowledgeService;

  const gymKnowledgeRepository = {
    listOperatingHours: jest.fn(),
    listFaqEntriesByQuestions: jest.fn(),
    replaceOperatingHours: jest.fn(),
    listSpecialSchedules: jest.fn(),
    createSpecialSchedule: jest.fn(),
    listFaqEntries: jest.fn(),
    createFaqEntry: jest.fn(),
    upsertFaqEntries: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GymKnowledgeService,
        {
          provide: GymKnowledgeRepository,
          useValue: gymKnowledgeRepository,
        },
      ],
    }).compile();

    service = module.get<GymKnowledgeService>(GymKnowledgeService);
    jest.clearAllMocks();
  });

  it('maps operating hours to response DTOs with time strings', async () => {
    gymKnowledgeRepository.listOperatingHours.mockResolvedValue([
      {
        id: 'hour-1',
        day_of_week: 1,
        opens_at: new Date('1970-01-01T06:00:00.000Z'),
        closes_at: new Date('1970-01-01T22:00:00.000Z'),
        is_closed: false,
        label: 'Weekday hours',
        is_active: true,
        created_at: new Date('2026-03-29T09:00:00.000Z'),
        updated_at: new Date('2026-03-29T10:00:00.000Z'),
      },
    ]);

    await expect(service.getOperatingHours()).resolves.toEqual([
      {
        id: 'hour-1',
        day_of_week: 1,
        opens_at: '06:00',
        closes_at: '22:00',
        is_closed: false,
        label: 'Weekday hours',
        is_active: true,
        created_at: '2026-03-29T09:00:00.000Z',
        updated_at: '2026-03-29T10:00:00.000Z',
      },
    ]);
  });

  it('builds the shared gym profile from faq entries and operating hours', async () => {
    gymKnowledgeRepository.listFaqEntriesByQuestions.mockResolvedValue([
      {
        id: 'faq-name',
        category: GymFaqCategory.general,
        question: 'Gym name',
        answer: 'FitTrack Uptown',
        keywords: null,
        sort_order: 0,
        is_active: true,
        created_at: new Date('2026-03-29T09:00:00.000Z'),
        updated_at: new Date('2026-03-29T10:00:00.000Z'),
      },
      {
        id: 'faq-phone',
        category: GymFaqCategory.general,
        question: 'Gym phone',
        answer: '+639991112222',
        keywords: null,
        sort_order: 1,
        is_active: true,
        created_at: new Date('2026-03-29T09:00:00.000Z'),
        updated_at: new Date('2026-03-29T10:00:00.000Z'),
      },
    ]);
    gymKnowledgeRepository.listOperatingHours.mockResolvedValue([
      {
        id: 'hour-1',
        day_of_week: 1,
        opens_at: new Date('1970-01-01T05:30:00.000Z'),
        closes_at: new Date('1970-01-01T21:00:00.000Z'),
        is_closed: false,
        label: 'Daily gym hours',
        is_active: true,
        created_at: new Date('2026-03-29T09:00:00.000Z'),
        updated_at: new Date('2026-03-29T10:00:00.000Z'),
      },
    ]);

    await expect(service.getGymProfile()).resolves.toEqual({
      name: 'FitTrack Uptown',
      phone: '+639991112222',
      location: 'Pasay City, Metro Manila, Philippines',
      email: 'contact@sertfit.com',
      opening_time: '05:30',
      closing_time: '21:00',
    });
  });

  it('updates the shared gym profile through faq entries and daily hours', async () => {
    gymKnowledgeRepository.upsertFaqEntries.mockResolvedValue([
      {
        id: 'faq-name',
        category: GymFaqCategory.general,
        question: 'Gym name',
        answer: 'FitTrack Downtown',
        keywords: null,
        sort_order: 0,
        is_active: true,
        created_at: new Date('2026-03-29T09:00:00.000Z'),
        updated_at: new Date('2026-03-29T10:00:00.000Z'),
      },
      {
        id: 'faq-phone',
        category: GymFaqCategory.general,
        question: 'Gym phone',
        answer: '+639281234567',
        keywords: null,
        sort_order: 1,
        is_active: true,
        created_at: new Date('2026-03-29T09:00:00.000Z'),
        updated_at: new Date('2026-03-29T10:00:00.000Z'),
      },
      {
        id: 'faq-location',
        category: GymFaqCategory.general,
        question: 'Gym location',
        answer: 'Makati City',
        keywords: null,
        sort_order: 2,
        is_active: true,
        created_at: new Date('2026-03-29T09:00:00.000Z'),
        updated_at: new Date('2026-03-29T10:00:00.000Z'),
      },
      {
        id: 'faq-email',
        category: GymFaqCategory.general,
        question: 'Gym email',
        answer: 'contact@fittrack.com',
        keywords: null,
        sort_order: 3,
        is_active: true,
        created_at: new Date('2026-03-29T09:00:00.000Z'),
        updated_at: new Date('2026-03-29T10:00:00.000Z'),
      },
    ]);
    gymKnowledgeRepository.replaceOperatingHours.mockResolvedValue([
      {
        id: 'hour-1',
        day_of_week: 1,
        opens_at: new Date('1970-01-01T06:00:00.000Z'),
        closes_at: new Date('1970-01-01T22:00:00.000Z'),
        is_closed: false,
        label: 'Daily gym hours',
        is_active: true,
        created_at: new Date('2026-03-29T09:00:00.000Z'),
        updated_at: new Date('2026-03-29T10:00:00.000Z'),
      },
    ]);

    await expect(
      service.updateGymProfile({
        name: 'FitTrack Downtown',
        phone: '+639281234567',
        location: 'Makati City',
        email: 'contact@fittrack.com',
        opening_time: '06:00',
        closing_time: '22:00',
      }),
    ).resolves.toEqual({
      name: 'FitTrack Downtown',
      phone: '+639281234567',
      location: 'Makati City',
      email: 'contact@fittrack.com',
      opening_time: '06:00',
      closing_time: '22:00',
    });

    expect(gymKnowledgeRepository.upsertFaqEntries).toHaveBeenCalledTimes(1);
    expect(gymKnowledgeRepository.replaceOperatingHours).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          day_of_week: 0,
          opens_at: '06:00',
          closes_at: '22:00',
        }),
        expect.objectContaining({
          day_of_week: 6,
          opens_at: '06:00',
          closes_at: '22:00',
        }),
      ]),
    );
  });

  it('rejects duplicate weekday rows before hitting the repository', async () => {
    await expect(
      service.replaceOperatingHours([
        { day_of_week: 1, opens_at: '06:00', closes_at: '22:00' },
        { day_of_week: 1, opens_at: '08:00', closes_at: '20:00' },
      ]),
    ).rejects.toMatchObject({
      response: {
        message: 'day_of_week entries must be unique. Duplicate values: 1',
      },
    });

    expect(gymKnowledgeRepository.replaceOperatingHours).not.toHaveBeenCalled();
  });

  it('maps special schedule pagination to date and time strings', async () => {
    gymKnowledgeRepository.listSpecialSchedules.mockResolvedValue({
      data: [
        {
          id: 'schedule-1',
          starts_on: new Date('2026-12-24T00:00:00.000Z'),
          ends_on: new Date('2026-12-25T00:00:00.000Z'),
          opens_at: new Date('1970-01-01T08:00:00.000Z'),
          closes_at: null,
          is_closed: false,
          reason: 'Christmas schedule',
          pricing_note: 'Holiday class passes remain valid.',
          is_active: true,
          created_at: new Date('2026-03-29T09:00:00.000Z'),
          updated_at: new Date('2026-03-29T10:00:00.000Z'),
        },
      ],
      meta: { page: 1, limit: 20, total: 1, total_pages: 1 },
    });

    await expect(
      service.getSpecialSchedules({ page: 1, limit: 20 }),
    ).resolves.toEqual({
      data: [
        {
          id: 'schedule-1',
          starts_on: '2026-12-24',
          ends_on: '2026-12-25',
          opens_at: '08:00',
          closes_at: null,
          is_closed: false,
          reason: 'Christmas schedule',
          pricing_note: 'Holiday class passes remain valid.',
          is_active: true,
          created_at: '2026-03-29T09:00:00.000Z',
          updated_at: '2026-03-29T10:00:00.000Z',
        },
      ],
      meta: { page: 1, limit: 20, total: 1, total_pages: 1 },
    });
  });

  it('maps faq keyword JSON to string arrays only', async () => {
    gymKnowledgeRepository.listFaqEntries.mockResolvedValue({
      data: [
        {
          id: 'faq-1',
          category: GymFaqCategory.membership,
          question: 'Do you offer walk-in rates?',
          answer: 'Yes, day passes are available.',
          keywords: ['walk-in', 99, 'day pass'],
          sort_order: 10,
          is_active: true,
          created_at: new Date('2026-03-29T09:00:00.000Z'),
          updated_at: new Date('2026-03-29T10:00:00.000Z'),
        },
      ],
      meta: { page: 1, limit: 20, total: 1, total_pages: 1 },
    });

    await expect(
      service.getFaqEntries({ page: 1, limit: 20 }),
    ).resolves.toEqual({
      data: [
        {
          id: 'faq-1',
          category: GymFaqCategory.membership,
          question: 'Do you offer walk-in rates?',
          answer: 'Yes, day passes are available.',
          keywords: ['walk-in', 'day pass'],
          sort_order: 10,
          is_active: true,
          created_at: '2026-03-29T09:00:00.000Z',
          updated_at: '2026-03-29T10:00:00.000Z',
        },
      ],
      meta: { page: 1, limit: 20, total: 1, total_pages: 1 },
    });
  });
});
