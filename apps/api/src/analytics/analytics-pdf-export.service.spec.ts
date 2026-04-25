import { AnalyticsPdfExportService } from './analytics-pdf-export.service';

describe('AnalyticsPdfExportService', () => {
  const analyticsService = {
    getAttendance: jest.fn(),
    getDailyInsightsTrend: jest.fn(),
    getInventorySummary: jest.fn(),
    getRevenue: jest.fn(),
    getSnapshot: jest.fn(),
  };

  const businessAnalyticsInsightService = {
    generateTransientInsight: jest.fn(),
  };

  let service: AnalyticsPdfExportService;

  beforeEach(() => {
    service = new AnalyticsPdfExportService(
      analyticsService as never,
      businessAnalyticsInsightService as never,
    );
    jest.clearAllMocks();
  });

  it('builds a real PDF buffer using live analytics data and transient insights', async () => {
    analyticsService.getSnapshot.mockResolvedValue({
      generated_at: '2026-04-23T12:00:00.000Z',
      daily_insights: {
        active_members: 2,
        sessions_today: 5,
        recent_activities: 8,
      },
      performance_kpis: {
        total_revenue: '32500.00',
        total_venue_bookings: 9,
        total_coaching_appointments: 6,
        new_members: 3,
        check_ins: 42,
        coaching_sessions: 7,
      },
      system_alerts: [
        {
          id: 'alert-1',
          kind: 'low_stock',
          severity: 'warning',
          title: 'Low Stock Alert',
          body: 'Creatine needs replenishment.',
          action_label: 'OPEN RESTOCK',
          href: '/inventory?modal=restock',
        },
      ],
      recent_activities: [
        {
          id: 'activity-1',
          kind: 'attendance',
          title: 'Checked in',
          description: 'Ava Rivera checked in.',
          occurred_at: '2026-04-23T04:05:00.000Z',
          actor_name: 'Ava Rivera',
          status: 'completed',
          entity_label: 'Attendance',
          entity_id: 'attendance-1',
        },
      ],
    });
    analyticsService.getRevenue.mockResolvedValue({
      start_date: '2025-11-01T00:00:00.000Z',
      end_date: '2026-04-30T23:59:59.999Z',
      period: 'monthly',
      totals: {
        membership_revenue: '12000.00',
        booking_revenue: '7000.00',
        product_revenue: '3500.00',
        coaching_payments_collected: '6200.00',
        coaching_gym_revenue: '10000.00',
        total_revenue: '32500.00',
      },
      top_revenue_sources: [
        {
          source_key: 'membership',
          source_label: 'Memberships',
          revenue: '12000.00',
          share_percentage: 36.9,
        },
      ],
      series: [],
    });
    analyticsService.getAttendance.mockResolvedValue({
      start_date: '2026-04-10T00:00:00.000Z',
      end_date: '2026-04-23T23:59:59.999Z',
      period: 'daily',
      total_check_ins: 42,
      peak_hours: [{ hour_label: '18:00', check_ins: 9 }],
      series: [
        {
          bucket_start: '2026-04-23T00:00:00.000Z',
          check_ins: 5,
        },
      ],
    });
    analyticsService.getDailyInsightsTrend.mockResolvedValue({
      start_date: '2026-04-10T00:00:00.000Z',
      end_date: '2026-04-23T23:59:59.999Z',
      period: 'daily',
      series: [
        {
          bucket_start: '2026-04-23T00:00:00.000Z',
          active_members: 2,
          sessions: 5,
        },
      ],
    });
    analyticsService.getInventorySummary.mockResolvedValue({
      retail_items: 14,
      low_stock_items: 2,
      out_of_stock_items: 1,
      retail_inventory_value: '16450.00',
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
    });
    businessAnalyticsInsightService.generateTransientInsight.mockResolvedValue({
      summary: 'Revenue is holding steady and evening usage remains strongest.',
      highlights: ['Memberships remain stable.'],
      risks: [],
      opportunities: ['Promote coaching bundles.'],
      anomaly_flags: [],
      recommended_actions: ['Increase prompts near peak hours.'],
      model_used: 'openrouter/primary',
      token_count: 111,
    });

    const result = await service.exportPdf({
      attendance_end_date: '2026-04-23',
      attendance_period: 'daily',
      attendance_start_date: '2026-04-10',
      revenue_end_date: '2026-04-30',
      revenue_period: 'monthly',
      revenue_start_date: '2025-11-01',
    });

    expect(result.fileName).toMatch(
      /^fittrack-analytics-\d{4}-\d{2}-\d{2}\.pdf$/,
    );
    expect(result.buffer.subarray(0, 8).toString('utf8')).toContain('%PDF-1.4');
    expect(result.buffer.toString('latin1')).toContain('Analytics Export');
    expect(result.buffer.toString('latin1')).toContain('Daily Insights');
    expect(result.buffer.toString('latin1')).toContain('Inventory Performance');
    expect(result.buffer.toString('latin1')).toContain(
      'Business Improvement Recommendations',
    );
    expect(analyticsService.getRevenue).toHaveBeenCalledWith({
      start_date: '2025-11-01',
      end_date: '2026-04-30',
      period: 'monthly',
    });
    expect(analyticsService.getAttendance).toHaveBeenCalledWith({
      start_date: '2026-04-10',
      end_date: '2026-04-23',
      period: 'daily',
    });
    expect(analyticsService.getDailyInsightsTrend).toHaveBeenCalledWith({
      start_date: '2026-04-10',
      end_date: '2026-04-23',
      period: 'daily',
    });
    expect(analyticsService.getInventorySummary).toHaveBeenCalledWith({
      start_date: '2025-11-01',
      end_date: '2026-04-30',
      period: 'monthly',
    });
    expect(
      businessAnalyticsInsightService.generateTransientInsight,
    ).toHaveBeenCalledTimes(4);
  });
});
