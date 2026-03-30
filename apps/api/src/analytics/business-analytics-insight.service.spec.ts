import {
  InsightFocus,
  InsightPeriod,
  UserRole,
  UserStatus,
} from '@prisma/client';

import { BusinessAnalyticsInsightService } from './business-analytics-insight.service';

describe('BusinessAnalyticsInsightService', () => {
  const analyticsService = {
    buildBusinessInsightGroundingPayload: jest.fn(),
  };

  const aiPythonClientService = {
    generateBusinessInsight: jest.fn(),
  };

  const insightRunRepository = {
    createInsightRun: jest.fn(),
    listInsightRuns: jest.fn(),
    findInsightRunByIdOrThrow: jest.fn(),
  };

  let service: BusinessAnalyticsInsightService;

  const groundingPayload = {
    window: {
      start_date: '2026-03-01',
      end_date: '2026-03-31',
      period: InsightPeriod.monthly,
      focus: InsightFocus.overview,
    },
    overview: {
      total_revenue: '8849.00',
      total_check_ins: 342,
      new_members: 18,
      completed_coaching_sessions: 24,
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
      series: [],
    },
    attendance: {
      series: [],
      peak_hours: [],
    },
    membership: {
      new_members: 18,
      active_members: 124,
      top_plans: [],
    },
    coaching: {
      coaches: [],
    },
  };

  const insightPayload = {
    summary: 'Attendance softened late in the month.',
    highlights: ['Membership revenue remained stable.'],
    risks: ['Late-month check-ins declined.'],
    opportunities: ['Upsell high-performing plans during peak hours.'],
    anomaly_flags: ['Week four attendance dropped 18%.'],
    recommended_actions: ['Review class scheduling for the final week.'],
    model_used: 'openrouter/model',
    token_count: 144,
  };

  const storedRecord = {
    id: 'run-1',
    requested_by: 'admin-1',
    requester: {
      id: 'admin-1',
      role: UserRole.admin,
      status: UserStatus.active,
      profile: {
        first_name: 'Maria',
        last_name: 'Santos',
      },
    },
    focus: InsightFocus.overview,
    period: InsightPeriod.monthly,
    start_date: new Date('2026-03-01T00:00:00.000Z'),
    end_date: new Date('2026-03-31T00:00:00.000Z'),
    request_payload: {
      grounding: groundingPayload,
    },
    insight_payload: insightPayload,
    model_used: 'openrouter/model',
    token_count: 144,
    latency_ms: 75,
    created_at: new Date('2026-03-30T04:00:00.000Z'),
    updated_at: new Date('2026-03-30T04:00:00.000Z'),
  };

  const storedRecordWithNullableMetadata = {
    ...storedRecord,
    requested_by: null,
    requester: null,
    model_used: null,
    token_count: null,
    latency_ms: null,
    insight_payload: {
      ...insightPayload,
      model_used: null,
      token_count: null,
    },
  };

  beforeEach(() => {
    service = new BusinessAnalyticsInsightService(
      analyticsService as never,
      aiPythonClientService as never,
      insightRunRepository as never,
    );
    jest.clearAllMocks();
  });

  it('generates and persists an insight using the normalized grounding payload', async () => {
    analyticsService.buildBusinessInsightGroundingPayload.mockResolvedValue(
      groundingPayload,
    );
    aiPythonClientService.generateBusinessInsight.mockResolvedValue(
      insightPayload,
    );
    insightRunRepository.createInsightRun.mockResolvedValue(storedRecord);
    const dateNowSpy = jest
      .spyOn(Date, 'now')
      .mockReturnValueOnce(100)
      .mockReturnValueOnce(175);

    await expect(
      service.generateInsight('admin-1', { focus: InsightFocus.overview }),
    ).resolves.toEqual({
      id: 'run-1',
      requested_by: 'admin-1',
      requester: {
        id: 'admin-1',
        role: UserRole.admin,
        status: UserStatus.active,
        profile: {
          first_name: 'Maria',
          last_name: 'Santos',
        },
      },
      focus: InsightFocus.overview,
      period: InsightPeriod.monthly,
      start_date: '2026-03-01',
      end_date: '2026-03-31',
      summary: 'Attendance softened late in the month.',
      highlights: ['Membership revenue remained stable.'],
      risks: ['Late-month check-ins declined.'],
      opportunities: ['Upsell high-performing plans during peak hours.'],
      anomaly_flags: ['Week four attendance dropped 18%.'],
      recommended_actions: ['Review class scheduling for the final week.'],
      model_used: 'openrouter/model',
      token_count: 144,
      latency_ms: 75,
      created_at: '2026-03-30T04:00:00.000Z',
    });

    expect(
      analyticsService.buildBusinessInsightGroundingPayload,
    ).toHaveBeenCalledWith({
      focus: InsightFocus.overview,
    });
    expect(aiPythonClientService.generateBusinessInsight).toHaveBeenCalledWith({
      grounding: groundingPayload,
    });
    expect(insightRunRepository.createInsightRun).toHaveBeenCalledWith({
      requestedBy: 'admin-1',
      requestPayload: {
        grounding: groundingPayload,
      },
      insightPayload,
      latencyMs: 75,
    });

    dateNowSpy.mockRestore();
  });

  it('maps history reads from stored insight payloads without re-calling python', async () => {
    insightRunRepository.listInsightRuns.mockResolvedValue({
      data: [storedRecord],
      meta: { page: 1, limit: 20, total: 1, total_pages: 1 },
    });

    await expect(
      service.getInsightHistory({ period: InsightPeriod.monthly }),
    ).resolves.toEqual({
      data: [
        {
          id: 'run-1',
          requested_by: 'admin-1',
          requester: {
            id: 'admin-1',
            role: UserRole.admin,
            status: UserStatus.active,
            profile: {
              first_name: 'Maria',
              last_name: 'Santos',
            },
          },
          focus: InsightFocus.overview,
          period: InsightPeriod.monthly,
          start_date: '2026-03-01',
          end_date: '2026-03-31',
          summary: 'Attendance softened late in the month.',
          model_used: 'openrouter/model',
          token_count: 144,
          latency_ms: 75,
          created_at: '2026-03-30T04:00:00.000Z',
        },
      ],
      meta: { page: 1, limit: 20, total: 1, total_pages: 1 },
    });

    expect(
      aiPythonClientService.generateBusinessInsight,
    ).not.toHaveBeenCalled();
  });

  it('loads one stored insight run without recomputing analytics', async () => {
    insightRunRepository.findInsightRunByIdOrThrow.mockResolvedValue(
      storedRecord,
    );

    await expect(service.getInsightById('run-1')).resolves.toMatchObject({
      id: 'run-1',
      summary: 'Attendance softened late in the month.',
      highlights: ['Membership revenue remained stable.'],
      anomaly_flags: ['Week four attendance dropped 18%.'],
    });

    expect(
      analyticsService.buildBusinessInsightGroundingPayload,
    ).not.toHaveBeenCalled();
    expect(
      aiPythonClientService.generateBusinessInsight,
    ).not.toHaveBeenCalled();
  });

  it('maps nullable requester and insight metadata from stored runs safely', async () => {
    insightRunRepository.listInsightRuns.mockResolvedValue({
      data: [storedRecordWithNullableMetadata],
      meta: { page: 1, limit: 20, total: 1, total_pages: 1 },
    });

    await expect(service.getInsightHistory({})).resolves.toEqual({
      data: [
        {
          id: 'run-1',
          requested_by: null,
          requester: null,
          focus: InsightFocus.overview,
          period: InsightPeriod.monthly,
          start_date: '2026-03-01',
          end_date: '2026-03-31',
          summary: 'Attendance softened late in the month.',
          model_used: null,
          token_count: null,
          latency_ms: null,
          created_at: '2026-03-30T04:00:00.000Z',
        },
      ],
      meta: { page: 1, limit: 20, total: 1, total_pages: 1 },
    });
  });
});
