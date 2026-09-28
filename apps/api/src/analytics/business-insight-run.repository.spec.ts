import {
  InsightFocus,
  InsightPeriod,
  UserRole,
  UserStatus,
} from '@prisma/client';

import { BusinessInsightRunRepository } from './business-insight-run.repository';

describe('BusinessInsightRunRepository', () => {
  const businessInsightRun = {
    create: jest.fn(),
    count: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
  };

  const prisma = {
    businessInsightRun,
  };

  let repo: BusinessInsightRunRepository;

  beforeEach(() => {
    repo = new BusinessInsightRunRepository(prisma as never);
    jest.clearAllMocks();
  });

  it('persists successful insight runs with normalized window metadata', async () => {
    businessInsightRun.create.mockResolvedValue({ id: 'run-1' });

    await repo.createInsightRun({
      requestedBy: 'admin-1',
      requestPayload: {
        grounding: {
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
        },
      },
      insightPayload: {
        summary: 'Attendance softened late in the month.',
        highlights: ['Membership revenue remained stable.'],
        risks: ['Late-month check-ins declined.'],
        opportunities: ['Upsell high-performing plans during peak hours.'],
        anomaly_flags: ['Week four attendance dropped 18%.'],
        recommended_actions: ['Review class scheduling for the final week.'],
        model_used: 'openrouter/model',
        token_count: 144,
      },
      latencyMs: 75,
    });

    expect(businessInsightRun.create).toHaveBeenCalledWith({
      data: {
        requested_by: 'admin-1',
        focus: InsightFocus.overview,
        period: InsightPeriod.monthly,
        start_date: new Date('2026-03-01T00:00:00.000Z'),
        end_date: new Date('2026-03-31T00:00:00.000Z'),
        request_payload: {
          grounding: {
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
          },
        },
        insight_payload: {
          summary: 'Attendance softened late in the month.',
          highlights: ['Membership revenue remained stable.'],
          risks: ['Late-month check-ins declined.'],
          opportunities: ['Upsell high-performing plans during peak hours.'],
          anomaly_flags: ['Week four attendance dropped 18%.'],
          recommended_actions: ['Review class scheduling for the final week.'],
          model_used: 'openrouter/model',
          token_count: 144,
        },
        model_used: 'openrouter/model',
        token_count: 144,
        latency_ms: 75,
      },
      include: {
        requester: {
          select: {
            id: true,
            role: true,
            status: true,
            profile: {
              select: {
                first_name: true,
                last_name: true,
              },
            },
          },
        },
      },
    });
  });

  it('lists history with pagination and enum filters', async () => {
    businessInsightRun.findMany.mockResolvedValue([{ id: 'run-2' }]);
    businessInsightRun.count.mockResolvedValue(1);

    await repo.listInsightRuns({
      focus: InsightFocus.revenue,
      period: InsightPeriod.monthly,
      page: 2,
      limit: 10,
    });

    expect(businessInsightRun.findMany).toHaveBeenCalledWith({
      where: {
        focus: InsightFocus.revenue,
        period: InsightPeriod.monthly,
      },
      include: {
        requester: {
          select: {
            id: true,
            role: true,
            status: true,
            profile: {
              select: {
                first_name: true,
                last_name: true,
              },
            },
          },
        },
      },
      orderBy: [{ created_at: 'desc' }, { id: 'desc' }],
      skip: 10,
      take: 10,
    });
    expect(businessInsightRun.count).toHaveBeenCalledWith({
      where: {
        focus: InsightFocus.revenue,
        period: InsightPeriod.monthly,
      },
    });
  });

  it('loads one run with the safe requester projection', async () => {
    businessInsightRun.findUnique.mockResolvedValue({
      id: 'run-1',
      requester: {
        id: 'admin-1',
        role: UserRole.admin,
        status: UserStatus.active,
        profile: {
          first_name: 'Maria',
          last_name: 'Santos',
        },
      },
    });

    await repo.findInsightRunByIdOrThrow('run-1');

    expect(businessInsightRun.findUnique).toHaveBeenCalledWith({
      where: { id: 'run-1' },
      include: {
        requester: {
          select: {
            id: true,
            role: true,
            status: true,
            profile: {
              select: {
                first_name: true,
                last_name: true,
              },
            },
          },
        },
      },
      select: undefined,
    });
  });

  it('persists null optional metadata when the python response omits it', async () => {
    businessInsightRun.create.mockResolvedValue({ id: 'run-2' });

    await repo.createInsightRun({
      requestedBy: 'admin-1',
      requestPayload: {
        grounding: {
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
        },
      },
      insightPayload: {
        summary: 'Attendance softened late in the month.',
        highlights: ['Membership revenue remained stable.'],
        risks: ['Late-month check-ins declined.'],
        opportunities: ['Upsell high-performing plans during peak hours.'],
        anomaly_flags: ['Week four attendance dropped 18%.'],
        recommended_actions: ['Review class scheduling for the final week.'],
      },
      latencyMs: 75,
    });

    expect(businessInsightRun.create).toHaveBeenCalledWith({
      data: {
        requested_by: 'admin-1',
        focus: InsightFocus.overview,
        period: InsightPeriod.monthly,
        start_date: new Date('2026-03-01T00:00:00.000Z'),
        end_date: new Date('2026-03-31T00:00:00.000Z'),
        request_payload: {
          grounding: {
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
          },
        },
        insight_payload: {
          summary: 'Attendance softened late in the month.',
          highlights: ['Membership revenue remained stable.'],
          risks: ['Late-month check-ins declined.'],
          opportunities: ['Upsell high-performing plans during peak hours.'],
          anomaly_flags: ['Week four attendance dropped 18%.'],
          recommended_actions: ['Review class scheduling for the final week.'],
        },
        model_used: null,
        token_count: null,
        latency_ms: 75,
      },
      include: {
        requester: {
          select: {
            id: true,
            role: true,
            status: true,
            profile: {
              select: {
                first_name: true,
                last_name: true,
              },
            },
          },
        },
      },
    });
  });
});
