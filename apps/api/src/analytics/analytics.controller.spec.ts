import { GUARDS_METADATA } from '@nestjs/common/constants';
import { UserRole } from '@prisma/client';

import { ROLES_KEY } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { AnalyticsController } from './analytics.controller';

function getGuardMetadata(
  methodName:
    | 'getSnapshot'
    | 'getOverview'
    | 'getRevenue'
    | 'getAttendance'
    | 'getMembers'
    | 'getCoaches'
    | 'exportPdf',
): unknown[] | undefined {
  return Reflect.getMetadata(
    GUARDS_METADATA,
    AnalyticsController.prototype[methodName],
  ) as unknown[] | undefined;
}

function getRolesMetadata(
  methodName:
    | 'getSnapshot'
    | 'getOverview'
    | 'getRevenue'
    | 'getAttendance'
    | 'getMembers'
    | 'getCoaches'
    | 'exportPdf',
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
    getSnapshot: jest.fn(),
  };
  const analyticsPdfExportService = {
    exportPdf: jest.fn(),
  };

  let controller: AnalyticsController;

  beforeEach(() => {
    controller = new AnalyticsController(
      analyticsService as never,
      analyticsPdfExportService as never,
    );
    jest.clearAllMocks();
  });

  it('gets the overview through the service', async () => {
    analyticsService.getOverview.mockResolvedValue({ total_check_ins: 1 });

    await controller.getOverview({ period: 'monthly' });

    expect(analyticsService.getOverview).toHaveBeenCalledWith({
      period: 'monthly',
    });
  });

  it('gets the snapshot through the service', async () => {
    analyticsService.getSnapshot.mockResolvedValue({ generated_at: 'now' });

    await controller.getSnapshot();

    expect(analyticsService.getSnapshot).toHaveBeenCalled();
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

  it('exports the analytics PDF through the export service', async () => {
    const response = {
      send: jest.fn(),
      setHeader: jest.fn(),
    };
    analyticsPdfExportService.exportPdf.mockResolvedValue({
      buffer: Buffer.from('%PDF-1.4'),
      fileName: 'fittrack-analytics-2026-04-23.pdf',
    });

    await controller.exportPdf(
      {
        attendance_period: 'daily',
      },
      response as never,
    );

    expect(analyticsPdfExportService.exportPdf).toHaveBeenCalledWith({
      attendance_period: 'daily',
    });
    expect(response.setHeader).toHaveBeenCalledWith(
      'content-type',
      'application/pdf',
    );
    expect(response.setHeader).toHaveBeenCalledWith(
      'content-disposition',
      'attachment; filename="fittrack-analytics-2026-04-23.pdf"',
    );
    expect(response.send).toHaveBeenCalledWith(Buffer.from('%PDF-1.4'));
  });

  it.each([
    'getSnapshot',
    'getOverview',
    'getRevenue',
    'getAttendance',
    'getMembers',
    'getCoaches',
    'exportPdf',
  ] as const)('locks %s to admin users', (methodName) => {
    expect(getGuardMetadata(methodName)).toEqual([JwtAuthGuard, RolesGuard]);
    expect(getRolesMetadata(methodName)).toEqual([UserRole.admin]);
  });
});
