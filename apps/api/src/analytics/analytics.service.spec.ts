import { Test, TestingModule } from '@nestjs/testing';
import { InsightFocus, InsightPeriod, Prisma } from '@prisma/client';

import { AnalyticsRepository } from './analytics.repository';
import { AnalyticsService } from './analytics.service';

describe('AnalyticsService', () => {
  let service: AnalyticsService;

  const repo = {
    getAttendanceMetrics: jest.fn(),
    getCheckInCount: jest.fn(),
    getCoachEarningsMetrics: jest.fn(),
    getCoachingAppointmentCount: jest.fn(),
    getCurrentActiveMembers: jest.fn(),
    getMemberMetrics: jest.fn(),
    getOverviewMetrics: jest.fn(),
    getRecentActivityCountSince: jest.fn(),
    getRevenueMetrics: jest.fn(),
    getInventorySummary: jest.fn(),
    getVenueBookingCount: jest.fn(),
    listRecentActivities: jest.fn(),
    listSystemAlerts: jest.fn(),
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
      top_revenue_sources: [
        {
          source_key: 'membership',
          source_label: 'Memberships',
          revenue: '4999.00',
          share_percentage: 56.5,
        },
        {
          source_key: 'coaching',
          source_label: 'Coaching gym share',
          revenue: '1800.00',
          share_percentage: 20.3,
        },
        {
          source_key: 'bookings',
          source_label: 'Venue bookings',
          revenue: '1200.00',
          share_percentage: 13.6,
        },
        {
          source_key: 'products',
          source_label: 'Retail products',
          revenue: '850.00',
          share_percentage: 9.6,
        },
      ],
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
      peakHours: [{ hour_of_day: 18, check_ins: 9 }],
      series: [
        {
          bucket_start: new Date('2025-01-01T00:00:00.000Z'),
          check_ins: 21,
        },
      ],
      summary: {
        total_check_ins: 21,
      },
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
      total_check_ins: 21,
      peak_hours: [
        {
          hour_label: '18:00',
          check_ins: 9,
        },
      ],
      series: [
        {
          bucket_start: '2025-01-01T00:00:00.000Z',
          check_ins: 21,
        },
      ],
    });
  });

  it('builds the merged analytics snapshot from live metrics, alerts, and recent activity', async () => {
    repo.getOverviewMetrics.mockResolvedValue({
      attendance: { total_check_ins: 42 },
      coaching: {
        coaching_gym_revenue: new Prisma.Decimal('1560.00'),
        completed_coaching_sessions: 7,
      },
      members: { new_members: 5 },
      payments: {
        membership_revenue: new Prisma.Decimal('5100.00'),
        booking_revenue: new Prisma.Decimal('2400.00'),
        product_revenue: new Prisma.Decimal('980.00'),
        coaching_payments_collected: new Prisma.Decimal('3200.00'),
      },
    });
    repo.getCurrentActiveMembers.mockResolvedValue(18);
    repo.getCheckInCount.mockResolvedValue(11);
    repo.getVenueBookingCount.mockResolvedValue(9);
    repo.getCoachingAppointmentCount.mockResolvedValue(6);
    repo.getRecentActivityCountSince.mockResolvedValue(14);
    repo.listSystemAlerts.mockResolvedValue([
      {
        id: 'product-1',
        kind: 'low_stock',
        severity: 'warning',
        title: 'Low Stock Alert',
        body: 'Creatine is nearly out.',
        action_label: 'OPEN RESTOCK',
        href: '/inventory?tab=retail&modal=restock&productId=product-1',
      },
    ]);
    repo.listRecentActivities.mockResolvedValue([
      {
        id: 'activity-1',
        kind: 'attendance',
        title: 'Attendance check-in',
        description: 'Ava Rivera checked in and started a new training day.',
        occurred_at: new Date('2026-03-28T10:30:00.000Z'),
        actor_name: 'Ava Rivera',
        status: 'completed',
        entity_label: 'Attendance',
        entity_id: 'attendance-1',
      },
    ]);

    await expect(service.getSnapshot()).resolves.toEqual({
      generated_at: '2026-03-28T12:00:00.000Z',
      daily_insights: {
        active_members: 18,
        sessions_today: 11,
        recent_activities: 14,
      },
      performance_kpis: {
        total_revenue: '10040.00',
        total_venue_bookings: 9,
        total_coaching_appointments: 6,
        new_members: 5,
        check_ins: 42,
        coaching_sessions: 7,
      },
      system_alerts: [
        {
          id: 'product-1',
          kind: 'low_stock',
          severity: 'warning',
          title: 'Low Stock Alert',
          body: 'Creatine is nearly out.',
          action_label: 'OPEN RESTOCK',
          href: '/inventory?tab=retail&modal=restock&productId=product-1',
        },
      ],
      recent_activities: [
        {
          id: 'activity-1',
          kind: 'attendance',
          title: 'Attendance check-in',
          description: 'Ava Rivera checked in and started a new training day.',
          occurred_at: '2026-03-28T10:30:00.000Z',
          actor_name: 'Ava Rivera',
          status: 'completed',
          entity_label: 'Attendance',
          entity_id: 'attendance-1',
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
      peakHours: [
        { hour_of_day: 6, check_ins: 14 },
        { hour_of_day: 18, check_ins: 11 },
      ],
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
      summary: {
        total_check_ins: 30,
      },
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
    repo.getTopMembershipPlans.mockResolvedValue([
      {
        name: 'Elite',
        subscriber_count: 3,
        revenue: new Prisma.Decimal('4500.00'),
      },
    ]);
    repo.getInventorySummary.mockResolvedValue({
      retail: {
        retail_items: 14,
        low_stock_items: 2,
        out_of_stock_items: 1,
        retail_inventory_value: new Prisma.Decimal('16450.00'),
      },
      equipment: {
        equipment_types: 9,
        equipment_units_available: 28,
        equipment_units_total: 32,
        equipment_under_maintenance: 2,
      },
      topProducts: [
        {
          name: 'Protein Bar',
          quantity_sold: 12,
          revenue: new Prisma.Decimal('840.00'),
        },
      ],
    });

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
        retail_items: 14,
        low_stock_items: 2,
        out_of_stock_items: 1,
        retail_inventory_value: '16450.00',
        retail_sales_revenue: '850.00',
        equipment_types: 9,
        equipment_units_available: 28,
        equipment_units_total: 32,
        equipment_under_maintenance: 2,
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
    expect(repo.getInventorySummary).toHaveBeenCalled();
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
    repo.getAttendanceMetrics.mockResolvedValue({
      peakHours: [],
      series: [],
      summary: {
        total_check_ins: 0,
      },
    });
    repo.getMemberMetrics.mockResolvedValue({
      new_members: 0,
      active_members: 0,
    });
    repo.getCoachEarningsMetrics.mockResolvedValue({ coaches: [] });
    repo.getTopMembershipPlans.mockResolvedValue([]);
    repo.getInventorySummary.mockResolvedValue({
      retail: {
        retail_items: 0,
        low_stock_items: 0,
        out_of_stock_items: 0,
        retail_inventory_value: new Prisma.Decimal('0.00'),
      },
      equipment: {
        equipment_types: 0,
        equipment_units_available: 0,
        equipment_units_total: 0,
        equipment_under_maintenance: 0,
      },
      topProducts: [],
    });

    const payload = await service.buildBusinessInsightGroundingPayload({
      focus: InsightFocus.membership,
      period: InsightPeriod.monthly,
    });

    expect(payload.inventory).toBeUndefined();
    expect(repo.getInventorySummary).not.toHaveBeenCalled();
  });
});
