import { HttpException } from '@nestjs/common';
import {
  InsightFocus,
  InsightPeriod,
  UserRole,
  UserStatus,
} from '@prisma/client';

import { BusinessAnalyticsInsightService } from './business-analytics-insight.service';
import type {
  BusinessAnalyticsInsightRequest,
  BusinessAnalyticsInsightResponse,
} from '../ai/ai-python-client.service';

type GenerateBusinessInsightMock = jest.MockedFunction<
  (
    input: BusinessAnalyticsInsightRequest,
  ) => Promise<BusinessAnalyticsInsightResponse>
>;

type TestLogger = {
  warn: jest.MockedFunction<(message: string) => void>;
};

describe('BusinessAnalyticsInsightService', () => {
  const analyticsService = {
    buildBusinessInsightGroundingPayload: jest.fn(),
  };

  const aiPythonClientService = {
    generateBusinessInsight: jest.fn() as GenerateBusinessInsightMock,
  };

  const insightRunRepository = {
    createInsightRun: jest.fn(),
    listInsightRuns: jest.fn(),
    findInsightRunByIdOrThrow: jest.fn(),
  };
  const createInsightRunMock =
    insightRunRepository.createInsightRun as unknown as jest.MockedFunction<
      (input: Record<string, unknown>) => Promise<unknown>
    >;

  let service: BusinessAnalyticsInsightService;

  const groundingPayload = {
    window: {
      start_date: '2026-03-01',
      end_date: '2026-03-31',
      previous_start_date: '2026-01-29',
      previous_end_date: '2026-02-28',
      period: InsightPeriod.monthly,
      focus: InsightFocus.overview,
    },
    comparisons: {
      total_revenue: {
        current: '8849.00',
        previous: '9500.00',
        absolute_change: '-651.00',
        percentage_change: -6.9,
        direction: 'decrease',
      },
      check_ins: {
        current: 342,
        previous: 300,
        absolute_change: 42,
        percentage_change: 14,
        direction: 'increase',
      },
      new_members: {
        current: 18,
        previous: 0,
        absolute_change: 18,
        percentage_change: null,
        direction: 'new_from_zero',
      },
      completed_coaching_sessions: {
        current: 24,
        previous: 20,
        absolute_change: 4,
        percentage_change: 20,
        direction: 'increase',
      },
    },
    derived_signals: {
      revenue_mix_percentages: {
        memberships: 56.5,
        bookings: 13.6,
        products: 9.6,
        coaching: 20.3,
      },
      top_revenue_source_concentration: {
        source_key: 'memberships',
        source_label: 'Memberships',
        percentage: 56.5,
      },
      peak_hour_attendance_concentration: {
        hour_label: '18:00',
        check_ins: 80,
        percentage: 23.4,
      },
      equipment_availability_percentage: null,
      low_stock_exposure_percentage: null,
      out_of_stock_exposure_percentage: null,
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
    createInsightRunMock.mockResolvedValue(storedRecord);
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

  it('forwards the complete analysis snapshot and preserves provider section outputs', async () => {
    analyticsService.buildBusinessInsightGroundingPayload.mockResolvedValue(
      groundingPayload,
    );
    const providerSectionAnalyses = {
      overview: {
        summary: 'Provider overview output.',
        highlights: ['Provider evidence.'],
      },
      revenue: {
        summary: 'Provider revenue output.',
        highlights: ['Provider revenue evidence.'],
      },
    };
    aiPythonClientService.generateBusinessInsight.mockResolvedValue({
      ...insightPayload,
      analysis_depth: 'deep',
      selected_sections: ['overview', 'revenue'],
      section_analyses: providerSectionAnalyses,
      failed_sections: ['inventory'],
    });
    createInsightRunMock.mockResolvedValue(storedRecord);

    await service.generateInsight('admin-1', {
      analysis_depth: 'deep',
      end_date: '2026-03-31',
      period: InsightPeriod.monthly,
      selected_sections: [InsightFocus.overview, InsightFocus.revenue],
      start_date: '2026-03-01',
    });

    const request =
      aiPythonClientService.generateBusinessInsight.mock.calls[0]?.[0];
    expect(request?.grounding).toEqual(groundingPayload);
    expect(request?.analysis?.analysis_depth).toBe('deep');
    expect(request?.analysis?.selected_sections).toEqual([
      'overview',
      'revenue',
    ]);
    expect(request?.analysis?.section_contexts).toHaveProperty('overview');
    expect(request?.analysis?.section_contexts).toHaveProperty('revenue');
    expect(request?.analysis?.data_fingerprint).toMatch(/^[a-f0-9]{64}$/);

    const createCall = createInsightRunMock.mock.calls[0]?.[0];
    expect(createCall?.insightPayload).toMatchObject({
      section_analyses: providerSectionAnalyses,
      failed_sections: ['inventory'],
    });
  });

  it('logs bounded structured upstream validation detail before using fallback', async () => {
    analyticsService.buildBusinessInsightGroundingPayload.mockResolvedValue(
      groundingPayload,
    );
    const validationDetail =
      'upstream HTTP 422; validation fields: body.revenue.totals.membership_card_revenue [extra_forbidden]; token=secret-value Bearer bearer-secret sk-standalone-secret-key';
    aiPythonClientService.generateBusinessInsight.mockRejectedValue(
      new HttpException(
        {
          type: 'BAD_GATEWAY',
          status: 502,
          detail: validationDetail,
        },
        502,
      ),
    );
    const logger = (service as unknown as { logger: TestLogger }).logger;
    const warnSpy = jest.spyOn(logger, 'warn');

    await expect(
      service.generateTransientInsight({ focus: InsightFocus.overview }),
    ).resolves.toMatchObject({ model_used: 'grounded-fallback' });

    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining(
        'status 502: upstream HTTP 422; validation fields: body.revenue.totals.membership_card_revenue [extra_forbidden]',
      ),
    );
    expect(warnSpy.mock.calls[0]?.[0]).not.toContain('secret-value');
    expect(warnSpy.mock.calls[0]?.[0]).not.toContain('bearer-secret');
    expect(warnSpy.mock.calls[0]?.[0]).not.toContain(
      'sk-standalone-secret-key',
    );
    expect(warnSpy.mock.calls[0]?.[0]).toContain('token=[REDACTED]');
    expect(warnSpy.mock.calls[0]?.[0]).toContain('sk-[REDACTED]');
    expect(warnSpy.mock.calls[0]?.[0].length).toBeLessThanOrEqual(400);
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

  it('normalizes mutated stored insight shapes before returning them to PDF and web consumers', async () => {
    insightRunRepository.findInsightRunByIdOrThrow.mockResolvedValue({
      ...storedRecord,
      insight_payload: {
        executive_summary:
          '  Revenue improved\nagainst the prior window.\u0000  ',
        highlights: 'Single saved highlight',
        risks: [{ description: '  Capacity risk from peak demand.  ' }],
        opportunities: [{ text: 'Use the measured off-peak lane.' }],
        anomalyFlags: [{ content: 'Variance exceeded the threshold.' }],
        recommendedActions: [
          {
            action:
              'Operations · 7 days — align coverage. Success: waits stay below 3 minutes.',
          },
          'Operations · 7 days — align coverage. Success: waits stay below 3 minutes.',
          'Finance · 3 days — attribute the change. Success: 100% is sourced.',
          'Membership · 7 days — close onboarding. Success: 90% completion.',
          'Hidden · later — overflow. Success: hidden.',
        ],
      },
    });

    await expect(service.getInsightById('run-1')).resolves.toMatchObject({
      summary: 'Revenue improved against the prior window.',
      highlights: ['Single saved highlight'],
      risks: ['Capacity risk from peak demand.'],
      opportunities: ['Use the measured off-peak lane.'],
      anomaly_flags: ['Variance exceeded the threshold.'],
      recommended_actions: [
        'Operations · 7 days — align coverage. Success: waits stay below 3 minutes.',
        'Finance · 3 days — attribute the change. Success: 100% is sourced.',
        'Membership · 7 days — close onboarding. Success: 90% completion.',
      ],
    });
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

  it('generates a transient insight without persisting an insight run', async () => {
    analyticsService.buildBusinessInsightGroundingPayload.mockResolvedValue(
      groundingPayload,
    );
    aiPythonClientService.generateBusinessInsight.mockResolvedValue(
      insightPayload,
    );

    await expect(
      service.generateTransientInsight({ focus: InsightFocus.revenue }),
    ).resolves.toEqual(insightPayload);

    expect(
      analyticsService.buildBusinessInsightGroundingPayload,
    ).toHaveBeenCalledWith({ focus: InsightFocus.revenue });
    expect(aiPythonClientService.generateBusinessInsight).toHaveBeenCalledWith({
      grounding: groundingPayload,
    });
    expect(insightRunRepository.createInsightRun).not.toHaveBeenCalled();
  });

  it('returns a decision-oriented grounded fallback with bounded formatted actions', async () => {
    analyticsService.buildBusinessInsightGroundingPayload.mockResolvedValue(
      groundingPayload,
    );
    aiPythonClientService.generateBusinessInsight.mockRejectedValue(
      new Error('provider unavailable'),
    );

    const result = await service.generateTransientInsight({
      focus: InsightFocus.overview,
    });

    expect(result.model_used).toBe('grounded-fallback');
    expect(result.summary).toContain('decreased by');
    expect(result.summary).toContain('It matters because');
    expect(result.summary).toContain('Next,');
    expect(result.summary).not.toContain('revenue is');
    expect(result.highlights.every((item) => item.includes(';'))).toBe(true);
    expect(result.risks.every((item) => item.includes(';'))).toBe(true);
    expect(result.opportunities.every((item) => item.includes(';'))).toBe(true);
    expect(result.recommended_actions).toHaveLength(3);
    expect(
      result.recommended_actions.every(
        (action) =>
          action.includes(' · ') &&
          action.includes(' — ') &&
          action.includes('Success:'),
      ),
    ).toBe(true);
    expect(result.recommended_actions.join(' ').toLowerCase()).not.toMatch(
      /\b(review|observe|monitor)\b/,
    );
  });

  it.each([
    [InsightFocus.overview, 'Cross-domain priority:', 'General manager ·'],
    [InsightFocus.revenue, 'Revenue decreased', 'Finance ·'],
    [InsightFocus.attendance, 'Check-ins increased', 'Operations ·'],
    [InsightFocus.membership, 'New members established', 'Membership lead ·'],
    [
      InsightFocus.coaching,
      'Completed coaching sessions increased',
      'Coaching lead ·',
    ],
    [InsightFocus.inventory, 'Inventory exposure shows', 'Inventory lead ·'],
  ])(
    'keeps the %s fallback summary and first action focus-specific',
    async (focus, summaryEvidence, firstActionOwner) => {
      analyticsService.buildBusinessInsightGroundingPayload.mockResolvedValue({
        ...groundingPayload,
        window: { ...groundingPayload.window, focus },
        derived_signals: {
          ...groundingPayload.derived_signals,
          equipment_availability_percentage: 87.5,
          low_stock_exposure_percentage: 14.3,
          out_of_stock_exposure_percentage: 7.1,
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
          top_products: [],
        },
      });
      aiPythonClientService.generateBusinessInsight.mockRejectedValue(
        new Error('provider unavailable'),
      );

      const result = await service.generateTransientInsight({ focus });

      expect(result.summary).toContain(summaryEvidence);
      expect(result.summary).toContain('It matters because');
      expect(result.summary).toContain('Next,');
      expect(result.recommended_actions[0].startsWith(firstActionOwner)).toBe(
        true,
      );
      expect(result.recommended_actions.length).toBeLessThanOrEqual(3);
      expect(
        result.recommended_actions.every(
          (action) =>
            action.includes(' · ') &&
            action.includes(' — ') &&
            action.includes('Success:'),
        ),
      ).toBe(true);
      expect(result.recommended_actions.join(' ').toLowerCase()).not.toMatch(
        /\b(review|observe|monitor)\b/,
      );
    },
  );

  it('keeps inventory fallback decisions bounded when availability denominators are absent', async () => {
    analyticsService.buildBusinessInsightGroundingPayload.mockResolvedValue({
      ...groundingPayload,
      window: {
        ...groundingPayload.window,
        focus: InsightFocus.inventory,
      },
      derived_signals: {
        ...groundingPayload.derived_signals,
        equipment_availability_percentage: null,
        low_stock_exposure_percentage: null,
        out_of_stock_exposure_percentage: null,
      },
      inventory: undefined,
    });
    aiPythonClientService.generateBusinessInsight.mockRejectedValue(
      new Error('provider unavailable'),
    );

    const result = await service.generateTransientInsight({
      focus: InsightFocus.inventory,
    });

    expect(result.summary).toContain(
      'unavailable because no reliable equipment or retail denominator exists',
    );
    expect(result.recommended_actions[0]).toContain('Inventory lead ·');
    expect(result.recommended_actions[0]).toContain(
      'availability and stock exposure are calculable',
    );
  });
});
