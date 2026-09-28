import { GUARDS_METADATA } from '@nestjs/common/constants';
import { InsightFocus, UserRole } from '@prisma/client';

import { ROLES_KEY } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { BusinessAnalyticsController } from './business-analytics.controller';

function getGuardMetadata(
  methodName:
    | 'generateInsight'
    | 'getInsightHistory'
    | 'getInsightById'
    | 'exportInsightPdf'
    | 'exportInsightPdfWithOptions',
): unknown[] | undefined {
  return Reflect.getMetadata(
    GUARDS_METADATA,
    BusinessAnalyticsController.prototype[methodName],
  ) as unknown[] | undefined;
}

function getRolesMetadata(
  methodName:
    | 'generateInsight'
    | 'getInsightHistory'
    | 'getInsightById'
    | 'exportInsightPdf'
    | 'exportInsightPdfWithOptions',
): UserRole[] | undefined {
  return Reflect.getMetadata(
    ROLES_KEY,
    BusinessAnalyticsController.prototype[methodName],
  ) as UserRole[] | undefined;
}

describe('BusinessAnalyticsController', () => {
  const businessAnalyticsInsightService = {
    generateInsight: jest.fn(),
    getInsightHistory: jest.fn(),
    getInsightById: jest.fn(),
  };

  let controller: BusinessAnalyticsController;

  beforeEach(() => {
    controller = new BusinessAnalyticsController(
      businessAnalyticsInsightService as never,
    );
    jest.clearAllMocks();
  });

  it('generates an insight through the service', async () => {
    businessAnalyticsInsightService.generateInsight.mockResolvedValue({
      id: 'run-1',
    });

    await controller.generateInsight({ sub: 'admin-1' } as never, {
      focus: InsightFocus.overview,
    });

    expect(
      businessAnalyticsInsightService.generateInsight,
    ).toHaveBeenCalledWith('admin-1', { focus: InsightFocus.overview });
  });

  it('lists history through the service', async () => {
    businessAnalyticsInsightService.getInsightHistory.mockResolvedValue({
      data: [],
      meta: { page: 1, limit: 20, total: 0, total_pages: 0 },
    });

    await controller.getInsightHistory({ period: 'monthly' } as never);

    expect(
      businessAnalyticsInsightService.getInsightHistory,
    ).toHaveBeenCalledWith({
      period: 'monthly',
    });
  });

  it('loads one insight run through the service', async () => {
    businessAnalyticsInsightService.getInsightById.mockResolvedValue({
      id: 'run-1',
    });

    await controller.getInsightById('run-1');

    expect(businessAnalyticsInsightService.getInsightById).toHaveBeenCalledWith(
      'run-1',
    );
  });

  it.each([
    'generateInsight',
    'getInsightHistory',
    'getInsightById',
    'exportInsightPdf',
    'exportInsightPdfWithOptions',
  ] as const)('locks %s to admin users', (methodName) => {
    expect(getGuardMetadata(methodName)).toEqual([JwtAuthGuard, RolesGuard]);
    expect(getRolesMetadata(methodName)).toEqual([UserRole.admin]);
  });
});
