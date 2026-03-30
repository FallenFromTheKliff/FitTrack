import { GUARDS_METADATA } from '@nestjs/common/constants';
import { UserRole } from '@prisma/client';

import { ROLES_KEY } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { AnalyticsController } from './analytics.controller';

function getGuardMetadata(
  methodName:
    | 'getOverview'
    | 'getRevenue'
    | 'getAttendance'
    | 'getMembers'
    | 'getCoaches',
): unknown[] | undefined {
  return Reflect.getMetadata(
    GUARDS_METADATA,
    AnalyticsController.prototype[methodName],
  ) as unknown[] | undefined;
}

function getRolesMetadata(
  methodName:
    | 'getOverview'
    | 'getRevenue'
    | 'getAttendance'
    | 'getMembers'
    | 'getCoaches',
): UserRole[] | undefined {
  return Reflect.getMetadata(
    ROLES_KEY,
    AnalyticsController.prototype[methodName],
  ) as UserRole[] | undefined;
}

describe('AnalyticsController', () => {
  const analyticsService = {
    getAttendance: jest.fn(),
    getCoaches: jest.fn(),
    getMembers: jest.fn(),
    getOverview: jest.fn(),
    getRevenue: jest.fn(),
  };

  let controller: AnalyticsController;

  beforeEach(() => {
    controller = new AnalyticsController(analyticsService as never);
    jest.clearAllMocks();
  });

  it('gets the overview through the service', async () => {
    analyticsService.getOverview.mockResolvedValue({ total_check_ins: 1 });

    await controller.getOverview({ period: 'monthly' });

    expect(analyticsService.getOverview).toHaveBeenCalledWith({
      period: 'monthly',
    });
  });

  it('gets revenue through the service', async () => {
    analyticsService.getRevenue.mockResolvedValue({ total_revenue: '10.00' });

    await controller.getRevenue({ period: 'weekly' });

    expect(analyticsService.getRevenue).toHaveBeenCalledWith({
      period: 'weekly',
    });
  });

  it('gets attendance through the service', async () => {
    analyticsService.getAttendance.mockResolvedValue({ series: [] });

    await controller.getAttendance({ period: 'daily' });

    expect(analyticsService.getAttendance).toHaveBeenCalledWith({
      period: 'daily',
    });
  });

  it('gets members through the service', async () => {
    analyticsService.getMembers.mockResolvedValue({ active_members: 2 });

    await controller.getMembers({ start_date: '2025-01-01' });

    expect(analyticsService.getMembers).toHaveBeenCalledWith({
      start_date: '2025-01-01',
    });
  });

  it('gets coach earnings through the service', async () => {
    analyticsService.getCoaches.mockResolvedValue({ coaches: [] });

    await controller.getCoaches({ end_date: '2025-01-31' });

    expect(analyticsService.getCoaches).toHaveBeenCalledWith({
      end_date: '2025-01-31',
    });
  });

  it.each([
    'getOverview',
    'getRevenue',
    'getAttendance',
    'getMembers',
    'getCoaches',
  ] as const)('locks %s to admin users', (methodName) => {
    expect(getGuardMetadata(methodName)).toEqual([JwtAuthGuard, RolesGuard]);
    expect(getRolesMetadata(methodName)).toEqual([UserRole.admin]);
  });
});
