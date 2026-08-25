import { GymFaqCategory, Prisma } from '@prisma/client';

import { GymKnowledgeRepository } from './gym-knowledge.repository';

describe('GymKnowledgeRepository', () => {
  const gymOperatingHour = {
    findMany: jest.fn(),
  };
  const gymSpecialSchedule = {
    findMany: jest.fn(),
    count: jest.fn(),
    create: jest.fn(),
  };
  const gymFaqEntry = {
    findMany: jest.fn(),
    count: jest.fn(),
    create: jest.fn(),
  };
  const tx = {
    gymOperatingHour: {
      updateMany: jest.fn(),
      upsert: jest.fn(),
      findMany: jest.fn(),
    },
  };
  const prisma = {
    gymOperatingHour,
    gymSpecialSchedule,
    gymFaqEntry,
    $transaction: jest.fn(),
  };

  let repo: GymKnowledgeRepository;

  beforeEach(() => {
    prisma.$transaction.mockImplementation(
      async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx),
    );
    repo = new GymKnowledgeRepository(prisma as never);
    jest.clearAllMocks();
  });

  it('lists active operating hours ordered by day_of_week ascending', async () => {
    gymOperatingHour.findMany.mockResolvedValue([{ id: 'hour-1' }]);

    await repo.listOperatingHours();

    expect(gymOperatingHour.findMany).toHaveBeenCalledWith({
      where: { is_active: true },
      include: undefined,
      orderBy: { day_of_week: 'asc' },
      select: undefined,
    });
  });

  it('replaces the weekly operating-hour snapshot atomically', async () => {
    tx.gymOperatingHour.updateMany.mockResolvedValue({ count: 5 });
    tx.gymOperatingHour.upsert.mockResolvedValue({});
    tx.gymOperatingHour.findMany.mockResolvedValue([{ id: 'hour-1' }]);

    await repo.replaceOperatingHours([
      {
        day_of_week: 1,
        opens_at: '06:00',
        closes_at: '22:00',
        label: 'Weekday hours',
      },
      {
        day_of_week: 6,
        opens_at: '08:00',
        closes_at: '20:00',
        is_closed: false,
      },
    ]);

    expect(tx.gymOperatingHour.updateMany).toHaveBeenCalledWith({
      where: { day_of_week: { notIn: [1, 6] } },
      data: { is_active: false },
    });
    expect(tx.gymOperatingHour.upsert).toHaveBeenNthCalledWith(1, {
      where: { day_of_week: 1 },
      create: {
        day_of_week: 1,
        opens_at: new Date('1970-01-01T06:00:00.000Z'),
        closes_at: new Date('1970-01-01T22:00:00.000Z'),
        is_closed: false,
        label: 'Weekday hours',
        is_active: true,
      },
      update: {
        opens_at: new Date('1970-01-01T06:00:00.000Z'),
        closes_at: new Date('1970-01-01T22:00:00.000Z'),
        is_closed: false,
        label: 'Weekday hours',
        is_active: true,
      },
    });
    expect(tx.gymOperatingHour.findMany).toHaveBeenCalledWith({
      where: { is_active: true },
      orderBy: { day_of_week: 'asc' },
    });
  });

  it('paginates special schedules with active chronological ordering', async () => {
    gymSpecialSchedule.findMany.mockResolvedValue([{ id: 'schedule-1' }]);
    gymSpecialSchedule.count.mockResolvedValue(1);

    await repo.listSpecialSchedules({ page: 2, limit: 5 });

    expect(gymSpecialSchedule.findMany).toHaveBeenCalledWith({
      where: { is_active: true },
      orderBy: [
        { starts_on: 'asc' },
        { ends_on: 'asc' },
        { created_at: 'desc' },
      ],
      skip: 5,
      take: 5,
    });
    expect(gymSpecialSchedule.count).toHaveBeenCalledWith({
      where: { is_active: true },
    });
  });

  it('creates special schedules with normalized date and time values', async () => {
    gymSpecialSchedule.create.mockResolvedValue({ id: 'schedule-1' });

    await repo.createSpecialSchedule({
      starts_on: '2026-12-24',
      ends_on: '2026-12-25',
      opens_at: '08:00',
      closes_at: '18:00',
      reason: 'Christmas schedule',
      pricing_note: 'Holiday class passes remain valid.',
    });

    expect(gymSpecialSchedule.create).toHaveBeenCalledWith({
      data: {
        starts_on: new Date('2026-12-24T00:00:00.000Z'),
        ends_on: new Date('2026-12-25T00:00:00.000Z'),
        opens_at: new Date('1970-01-01T08:00:00.000Z'),
        closes_at: new Date('1970-01-01T18:00:00.000Z'),
        is_closed: false,
        reason: 'Christmas schedule',
        pricing_note: 'Holiday class passes remain valid.',
      },
      include: undefined,
    });
  });

  it('creates faq entries with JsonNull when keywords are omitted', async () => {
    gymFaqEntry.create.mockResolvedValue({ id: 'faq-1' });

    await repo.createFaqEntry({
      category: GymFaqCategory.membership,
      question: 'Do you offer walk-in rates?',
      answer: 'Yes, day passes are available.',
    });

    expect(gymFaqEntry.create).toHaveBeenCalledWith({
      data: {
        category: GymFaqCategory.membership,
        question: 'Do you offer walk-in rates?',
        answer: 'Yes, day passes are available.',
        keywords: Prisma.JsonNull,
        sort_order: 0,
      },
      include: undefined,
    });
  });
});
