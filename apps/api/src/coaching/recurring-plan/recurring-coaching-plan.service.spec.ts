import { HttpException } from '@nestjs/common';
import { UserRole } from '@prisma/client';

import { RecurringCoachingPlanService } from './recurring-coaching-plan.service';

describe('RecurringCoachingPlanService', () => {
  const repo = {
    findActiveMember: jest.fn(),
    findCoachContext: jest.fn(),
  };
  const paymentRepository = {};
  const paymongoCheckoutService = {};

  let service: RecurringCoachingPlanService;

  beforeEach(() => {
    jest.clearAllMocks();
    repo.findActiveMember.mockResolvedValue({ id: 'member-1' });
    repo.findCoachContext.mockResolvedValue({
      id: 'coach-1',
      is_available_for_booking: true,
    });
    service = new RecurringCoachingPlanService(
      repo as never,
      paymentRepository as never,
      paymongoCheckoutService as never,
    );
  });

  it('rejects recurring plan previews that start before the current gym date', async () => {
    try {
      await service.previewPlan(
        { role: UserRole.admin, sub: 'admin-1' } as never,
        {
          coach_id: 'coach-1',
          duration_minutes: 60,
          duration_months: 1,
          frequency: 'weekly',
          member_id: 'member-1',
          preferred_days: [1],
          preferred_time: '09:00',
          start_date: '2000-01-01',
        } as never,
      );
      throw new Error('Expected previewPlan to reject a past start date.');
    } catch (error) {
      expect(error).toBeInstanceOf(HttpException);
      expect((error as HttpException).getResponse()).toMatchObject({
        detail: 'start_date must be today or later.',
        status: 422,
        title: 'Invalid Recurring Plan Window',
        type: 'BUSINESS_RULE_VIOLATION',
      });
    }
  });
});
