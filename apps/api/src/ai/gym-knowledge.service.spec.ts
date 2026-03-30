import { Test, TestingModule } from '@nestjs/testing';
import { GymFaqCategory } from '@prisma/client';

import { GymKnowledgeRepository } from './gym-knowledge.repository';
import { GymKnowledgeService } from './gym-knowledge.service';

describe('GymKnowledgeService', () => {
  let service: GymKnowledgeService;

  const gymKnowledgeRepository = {
    listOperatingHours: jest.fn(),
    replaceOperatingHours: jest.fn(),
    listSpecialSchedules: jest.fn(),
    createSpecialSchedule: jest.fn(),
    listPromotions: jest.fn(),
    createPromotion: jest.fn(),
    listFaqEntries: jest.fn(),
    createFaqEntry: jest.fn(),
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

  it('maps promotion creation responses directly from repository records', async () => {
    gymKnowledgeRepository.createPromotion.mockResolvedValue({
      id: 'promo-1',
      title: 'Summer Starter Pack',
      description: 'Get two weeks free on annual plans.',
      promo_code: 'SUMMER26',
      starts_at: new Date('2026-05-01T00:00:00.000Z'),
      ends_at: new Date('2026-05-31T23:59:59.000Z'),
      pricing_note: 'Applies only to new signups.',
      is_active: true,
      created_at: new Date('2026-03-29T09:00:00.000Z'),
      updated_at: new Date('2026-03-29T10:00:00.000Z'),
    });

    await expect(
      service.createPromotion({
        title: 'Summer Starter Pack',
        description: 'Get two weeks free on annual plans.',
        promo_code: 'SUMMER26',
        starts_at: '2026-05-01T00:00:00.000Z',
        ends_at: '2026-05-31T23:59:59.000Z',
        pricing_note: 'Applies only to new signups.',
      }),
    ).resolves.toEqual({
      id: 'promo-1',
      title: 'Summer Starter Pack',
      description: 'Get two weeks free on annual plans.',
      promo_code: 'SUMMER26',
      starts_at: '2026-05-01T00:00:00.000Z',
      ends_at: '2026-05-31T23:59:59.000Z',
      pricing_note: 'Applies only to new signups.',
      is_active: true,
      created_at: '2026-03-29T09:00:00.000Z',
      updated_at: '2026-03-29T10:00:00.000Z',
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
