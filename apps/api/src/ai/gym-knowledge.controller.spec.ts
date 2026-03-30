import { GUARDS_METADATA } from '@nestjs/common/constants';
import { GymFaqCategory, UserRole } from '@prisma/client';

import { ROLES_KEY } from '../common/decorators/roles.decorator';
import { JwtAuthGuard, RolesGuard } from '../common/guards';
import { GymKnowledgeController } from './gym-knowledge.controller';

describe('GymKnowledgeController', () => {
  const gymKnowledgeService = {
    getOperatingHours: jest.fn(),
    replaceOperatingHours: jest.fn(),
    getSpecialSchedules: jest.fn(),
    createSpecialSchedule: jest.fn(),
    getPromotions: jest.fn(),
    createPromotion: jest.fn(),
    getFaqEntries: jest.fn(),
    createFaqEntry: jest.fn(),
  };

  let controller: GymKnowledgeController;

  beforeEach(() => {
    controller = new GymKnowledgeController(gymKnowledgeService as never);
    jest.clearAllMocks();
  });

  it('protects the controller with JWT auth and admin roles', () => {
    expect(
      Reflect.getMetadata(GUARDS_METADATA, GymKnowledgeController) as
        | unknown[]
        | undefined,
    ).toEqual([JwtAuthGuard, RolesGuard]);
    expect(
      Reflect.getMetadata(ROLES_KEY, GymKnowledgeController) as
        | UserRole[]
        | undefined,
    ).toEqual([UserRole.admin]);
  });

  it('lists operating hours through the service', async () => {
    gymKnowledgeService.getOperatingHours.mockResolvedValue([]);

    await controller.getOperatingHours();

    expect(gymKnowledgeService.getOperatingHours).toHaveBeenCalledTimes(1);
  });

  it('replaces operating hours through the service', async () => {
    gymKnowledgeService.replaceOperatingHours.mockResolvedValue([]);

    await controller.replaceOperatingHours([
      {
        day_of_week: 1,
        opens_at: '06:00',
        closes_at: '22:00',
      },
    ]);

    expect(gymKnowledgeService.replaceOperatingHours).toHaveBeenCalledWith([
      {
        day_of_week: 1,
        opens_at: '06:00',
        closes_at: '22:00',
      },
    ]);
  });

  it('delegates paginated special-schedule reads and create writes', async () => {
    gymKnowledgeService.getSpecialSchedules.mockResolvedValue({
      data: [],
      meta: { page: 1, limit: 20, total: 0, total_pages: 0 },
    });
    gymKnowledgeService.createSpecialSchedule.mockResolvedValue({
      id: 'schedule-1',
    });

    await controller.getSpecialSchedules({ page: 2, limit: 10 });
    await controller.createSpecialSchedule({
      starts_on: '2026-12-24',
      ends_on: '2026-12-25',
      reason: 'Christmas schedule',
    });

    expect(gymKnowledgeService.getSpecialSchedules).toHaveBeenCalledWith({
      page: 2,
      limit: 10,
    });
    expect(gymKnowledgeService.createSpecialSchedule).toHaveBeenCalledWith({
      starts_on: '2026-12-24',
      ends_on: '2026-12-25',
      reason: 'Christmas schedule',
    });
  });

  it('delegates promotions and faq operations through the service', async () => {
    gymKnowledgeService.getPromotions.mockResolvedValue({
      data: [],
      meta: { page: 1, limit: 20, total: 0, total_pages: 0 },
    });
    gymKnowledgeService.createPromotion.mockResolvedValue({ id: 'promo-1' });
    gymKnowledgeService.getFaqEntries.mockResolvedValue({
      data: [],
      meta: { page: 1, limit: 20, total: 0, total_pages: 0 },
    });
    gymKnowledgeService.createFaqEntry.mockResolvedValue({ id: 'faq-1' });

    await controller.getPromotions({ page: 1, limit: 20 });
    await controller.createPromotion({
      title: 'Summer Starter Pack',
      description: 'Get two weeks free on annual plans.',
      starts_at: '2026-05-01T00:00:00.000Z',
      ends_at: '2026-05-31T23:59:59.000Z',
    });
    await controller.getFaqEntries({ page: 3, limit: 5 });
    await controller.createFaqEntry({
      category: GymFaqCategory.membership,
      question: 'Do you offer walk-in rates?',
      answer: 'Yes, day passes are available.',
    });

    expect(gymKnowledgeService.getPromotions).toHaveBeenCalledWith({
      page: 1,
      limit: 20,
    });
    expect(gymKnowledgeService.createPromotion).toHaveBeenCalledWith({
      title: 'Summer Starter Pack',
      description: 'Get two weeks free on annual plans.',
      starts_at: '2026-05-01T00:00:00.000Z',
      ends_at: '2026-05-31T23:59:59.000Z',
    });
    expect(gymKnowledgeService.getFaqEntries).toHaveBeenCalledWith({
      page: 3,
      limit: 5,
    });
    expect(gymKnowledgeService.createFaqEntry).toHaveBeenCalledWith({
      category: GymFaqCategory.membership,
      question: 'Do you offer walk-in rates?',
      answer: 'Yes, day passes are available.',
    });
  });
});
