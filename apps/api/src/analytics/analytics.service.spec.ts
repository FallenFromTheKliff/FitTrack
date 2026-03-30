import { Test, TestingModule } from '@nestjs/testing';
import { InsightFocus, InsightPeriod, Prisma } from '@prisma/client';

import { AnalyticsRepository } from './analytics.repository';
import { AnalyticsService } from './analytics.service';

describe('AnalyticsService', () => {
  let service: AnalyticsService;

  const repo = {
    getAttendanceMetrics: jest.fn(),
    getAttendancePeakHours: jest.fn(),
    getCoachEarningsMetrics: jest.fn(),
    getMemberMetrics: jest.fn(),
    getOverviewMetrics: jest.fn(),
    getRevenueMetrics: jest.fn(),
    getTopInventoryProducts: jest.fn(),
    getTopMembershipPlans: jest.fn(),
  };

  beforeEach(async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-03-28T12:00:00.000Z'));

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AnalyticsService,
        { provide: AnalyticsRepository, useValue: repo },
      ],
    }).compile();

    service = module.get<AnalyticsService>(AnalyticsService);
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('defaults overview queries to the current month window', async () => {
    repo.getOverviewMetrics.mockResolvedValue({
      attendance: { total_check_ins: 12 },
      coaching: {
        coaching_gym_revenue: new Prisma.Decimal('1800.00'),
        completed_coaching_sessions: 4,
      },
      members: { new_members: 3 },
      payments: {
        membership_revenue: new Prisma.Decimal('4999.00'),
        booking_revenue: new Prisma.Decimal('1200.00'),
        product_revenue: new Prisma.Decimal('850.00'),
        coaching_payments_collected: new Prisma.Decimal('3000.00'),
      },
    });

    await service.getOverview({});

    expect(repo.getOverviewMetrics).toHaveBeenCalledWith(
      new Date('2026-03-01T00:00:00.000Z'),
      new Date('2026-03-31T23:59:59.999Z'),
    );
  });

  it('merges payment and coaching revenue into the revenue response', async () => {
    repo.getRevenueMetrics.mockResolvedValue({
      coaching: {
        coaching_gym_revenue: new Prisma.Decimal('1800.00'),
        completed_coaching_sessions: 4,
      },
      coachingSeries: [
        {
          bucket_start: new Date('2025-01-01T00:00:00.000Z'),
          coaching_gym_revenue: new Prisma.Decimal('600.00'),
        },
      ],
      paymentSeries: [
        {
          bucket_start: new Date('2025-01-01T00:00:00.000Z'),
          membership_revenue: new Prisma.Decimal('1000.00'),
          booking_revenue: new Prisma.Decimal('250.00'),
          product_revenue: new Prisma.Decimal('100.00'),
          coaching_payments_collected: new Prisma.Decimal('900.00'),
        },
      ],
      payments: {
        membership_revenue: new Prisma.Decimal('4999.00'),
        booking_revenue: new Prisma.Decimal('1200.00'),
        product_revenue: new Prisma.Decimal('850.00'),
        coaching_payments_collected: new Prisma.Decimal('3000.00'),
      },
    });

    await expect(
      service.getRevenue({
        start_date: '2025-01-01',
        end_date: '2025-01-31',
        period: 'monthly',
      }),
    ).resolves.toEqual({
      start_date: '2025-01-01T00:00:00.000Z',
      end_date: '2025-01-31T23:59:59.999Z',
      period: 'monthly',
      totals: {
        membership_revenue: '4999.00',
        booking_revenue: '1200.00',
        product_revenue: '850.00',
        coaching_payments_collected: '3000.00',
        coaching_gym_revenue: '1800.00',
        total_revenue: '8849.00',
      },
      series: [
        {
          bucket_start: '2025-01-01T00:00:00.000Z',
          membership_revenue: '1000.00',
          booking_revenue: '250.00',
          product_revenue: '100.00',
          coaching_payments_collected: '900.00',
          coaching_gym_revenue: '600.00',
          total_revenue: '1950.00',
        },
      ],
    });
  });

  it('maps attendance trend rows into API-friendly series output', async () => {
    repo.getAttendanceMetrics.mockResolvedValue({
      series: [
        {
          bucket_start: new Date('2025-01-01T00:00:00.000Z'),
          check_ins: 21,
        },
      ],
    });

    await expect(
      service.getAttendance({
        start_date: '2025-01-01',
        end_date: '2025-01-31',
        period: 'weekly',
      }),
    ).resolves.toEqual({
      start_date: '2025-01-01T00:00:00.000Z',
      end_date: '2025-01-31T23:59:59.999Z',
      period: 'weekly',
      series: [
        {
          bucket_start: '2025-01-01T00:00:00.000Z',
          check_ins: 21,
        },
      ],
    });
  });

  it('returns new and active member counts', async () => {
    repo.getMemberMetrics.mockResolvedValue({
      new_members: 18,
      active_members: 124,
    });

    await expect(
      service.getMembers({
        start_date: '2025-01-01',
        end_date: '2025-01-31',
      }),
    ).resolves.toEqual({
      start_date: '2025-01-01T00:00:00.000Z',
      end_date: '2025-01-31T23:59:59.999Z',
      new_members: 18,
      active_members: 124,
    });
  });

  it('returns per-coach billing and payout breakdowns', async () => {
    repo.getCoachEarningsMetrics.mockResolvedValue({
      coaches: [
        {
          coach_id: 'coach-1',
          first_name: 'Maria',
          last_name: 'Santos',
          total_billed: new Prisma.Decimal('5400.00'),
          gym_cut: new Prisma.Decimal('1080.00'),
          coach_payout: new Prisma.Decimal('4320.00'),
          completed_sessions: 6,
        },
      ],
    });

    await expect(
      service.getCoaches({
        start_date: '2025-01-01',
        end_date: '2025-01-31',
      }),
    ).resolves.toEqual({
      start_date: '2025-01-01T00:00:00.000Z',
      end_date: '2025-01-31T23:59:59.999Z',
      coaches: [
        {
          coach_id: 'coach-1',
          first_name: 'Maria',
          last_name: 'Santos',
          total_billed: '5400.00',
          gym_cut: '1080.00',
          coach_payout: '4320.00',
          completed_sessions: 6,
        },
      ],
    });
  });

  it('builds the S17 grounding payload with custom windows and ranked sections', async () => {
    repo.getRevenueMetrics.mockResolvedValue({
      coaching: {
        coaching_gym_revenue: new Prisma.Decimal('1800.00'),
        completed_coaching_sessions: 4,
      },
      coachingSeries: [
        {
          bucket_start: new Date('2025-01-05T00:00:00.000Z'),
          coaching_gym_revenue: new Prisma.Decimal('600.00'),
        },
      ],
      paymentSeries: [
        {
          bucket_start: new Date('2025-01-05T00:00:00.000Z'),
          membership_revenue: new Prisma.Decimal('1000.00'),
          booking_revenue: new Prisma.Decimal('250.00'),
          product_revenue: new Prisma.Decimal('100.00'),
          coaching_payments_collected: new Prisma.Decimal('900.00'),
        },
      ],
      payments: {
        membership_revenue: new Prisma.Decimal('4999.00'),
        booking_revenue: new Prisma.Decimal('1200.00'),
        product_revenue: new Prisma.Decimal('850.00'),
        coaching_payments_collected: new Prisma.Decimal('3000.00'),
      },
    });
    repo.getAttendanceMetrics.mockResolvedValue({
      series: [
        {
          bucket_start: new Date('2025-01-05T00:00:00.000Z'),
          check_ins: 21,
        },
        {
          bucket_start: new Date('2025-01-06T00:00:00.000Z'),
          check_ins: 9,
        },
      ],
    });
    repo.getMemberMetrics.mockResolvedValue({
      new_members: 18,
      active_members: 124,
    });
    repo.getCoachEarningsMetrics.mockResolvedValue({
      coaches: [
        {
          coach_id: 'coach-1',
          first_name: 'Maria',
          last_name: 'Santos',
          total_billed: new Prisma.Decimal('5400.00'),
          gym_cut: new Prisma.Decimal('1080.00'),
          coach_payout: new Prisma.Decimal('4320.00'),
          completed_sessions: 6,
        },
      ],
    });
    repo.getAttendancePeakHours.mockResolvedValue([
      { hour_of_day: 6, check_ins: 14 },
      { hour_of_day: 18, check_ins: 11 },
    ]);
    repo.getTopMembershipPlans.mockResolvedValue([
      {
        name: 'Elite',
        subscriber_count: 3,
        revenue: new Prisma.Decimal('4500.00'),
      },
    ]);
    repo.getTopInventoryProducts.mockResolvedValue([
      {
        name: 'Protein Bar',
        quantity_sold: 12,
        revenue: new Prisma.Decimal('840.00'),
      },
    ]);

    await expect(
      service.buildBusinessInsightGroundingPayload({
        start_date: '2025-01-05',
        end_date: '2025-01-10',
        period: InsightPeriod.custom,
        focus: InsightFocus.overview,
      }),
    ).resolves.toEqual({
      window: {
        start_date: '2025-01-05',
        end_date: '2025-01-10',
        period: InsightPeriod.custom,
        focus: InsightFocus.overview,
      },
      overview: {
        total_revenue: '8849.00',
        total_check_ins: 30,
        new_members: 18,
        completed_coaching_sessions: 4,
      },
      revenue: {
        totals: {
          membership_revenue: '4999.00',
          booking_revenue: '1200.00',
          product_revenue: '850.00',
          coaching_payments_collected: '3000.00',
          coaching_gym_revenue: '1800.00',
          total_revenue: '8849.00',
        },
        series: [
          {
            bucket_start: '2025-01-05T00:00:00.000Z',
            membership_revenue: '1000.00',
            booking_revenue: '250.00',
            product_revenue: '100.00',
            coaching_payments_collected: '900.00',
            coaching_gym_revenue: '600.00',
            total_revenue: '1950.00',
          },
        ],
      },
      attendance: {
        series: [
          {
            bucket_start: '2025-01-05T00:00:00.000Z',
            check_ins: 21,
          },
          {
            bucket_start: '2025-01-06T00:00:00.000Z',
            check_ins: 9,
          },
        ],
        peak_hours: [
          {
            hour_label: '06:00',
            check_ins: 14,
          },
          {
            hour_label: '18:00',
            check_ins: 11,
          },
        ],
      },
      membership: {
        new_members: 18,
        active_members: 124,
        top_plans: [
          {
            name: 'Elite',
            subscriber_count: 3,
            revenue: '4500.00',
          },
        ],
      },
      coaching: {
        coaches: [
          {
            coach_id: 'coach-1',
            first_name: 'Maria',
            last_name: 'Santos',
            total_billed: '5400.00',
            gym_cut: '1080.00',
            coach_payout: '4320.00',
            completed_sessions: 6,
          },
        ],
      },
      inventory: {
        top_products: [
          {
            name: 'Protein Bar',
            quantity_sold: 12,
            revenue: '840.00',
          },
        ],
      },
    });

    expect(repo.getRevenueMetrics).toHaveBeenCalledWith(
      new Date('2025-01-05T00:00:00.000Z'),
      new Date('2025-01-10T23:59:59.999Z'),
      InsightPeriod.custom,
    );
    expect(repo.getAttendanceMetrics).toHaveBeenCalledWith(
      new Date('2025-01-05T00:00:00.000Z'),
      new Date('2025-01-10T23:59:59.999Z'),
      InsightPeriod.custom,
    );
    expect(repo.getTopInventoryProducts).toHaveBeenCalled();
  });

  it('omits inventory grounding when the focus does not need inventory rollups', async () => {
    repo.getRevenueMetrics.mockResolvedValue({
      coaching: {
        coaching_gym_revenue: new Prisma.Decimal('0.00'),
        completed_coaching_sessions: 0,
      },
      coachingSeries: [],
      paymentSeries: [],
      payments: {
        membership_revenue: new Prisma.Decimal('0.00'),
        booking_revenue: new Prisma.Decimal('0.00'),
        product_revenue: new Prisma.Decimal('0.00'),
        coaching_payments_collected: new Prisma.Decimal('0.00'),
      },
    });
    repo.getAttendanceMetrics.mockResolvedValue({ series: [] });
    repo.getMemberMetrics.mockResolvedValue({
      new_members: 0,
      active_members: 0,
    });
    repo.getCoachEarningsMetrics.mockResolvedValue({ coaches: [] });
    repo.getAttendancePeakHours.mockResolvedValue([]);
    repo.getTopMembershipPlans.mockResolvedValue([]);

    const payload = await service.buildBusinessInsightGroundingPayload({
      focus: InsightFocus.membership,
      period: InsightPeriod.monthly,
    });

    expect(payload.inventory).toBeUndefined();
    expect(repo.getTopInventoryProducts).not.toHaveBeenCalled();
  });
});
