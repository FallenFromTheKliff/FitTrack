import { buildAnalyticsPdfBuffer } from './analytics-pdf.builder';

type BuilderArgs = Parameters<typeof buildAnalyticsPdfBuffer>[0];

const insight = {
  highlights: ['Memberships remain stable.'],
  recommendedActions: ['Increase prompts near peak hours.'],
  source: 'deterministic' as const,
  summary: 'Revenue is holding steady and evening usage remains strongest.',
};

function createArgs(sections: BuilderArgs['sections']): BuilderArgs {
  return {
    attendance: {
      end_date: '2026-04-23T23:59:59.999Z',
      peak_hours: [{ check_ins: 9, hour_label: '18:00' }],
      period: 'daily',
      series: [{ bucket_start: '2026-04-23T00:00:00.000Z', check_ins: 5 }],
      start_date: '2026-04-10T00:00:00.000Z',
      total_check_ins: 42,
    },
    attendanceLabel: '10 Apr 2026 to 23 Apr 2026',
    dailyInsightsTrend: {
      end_date: '2026-04-23T23:59:59.999Z',
      period: 'daily',
      series: [
        {
          active_members: 2,
          bucket_start: '2026-04-23T00:00:00.000Z',
          sessions: 5,
        },
      ],
      start_date: '2026-04-10T00:00:00.000Z',
    },
    exportedBy: {
      name: 'Ava Rivera',
      role: 'Administrator',
    },
    generatedAt: '2026-04-23T12:00:00.000Z',
    insights: {
      attendance: insight,
      dailyInsights: {
        ...insight,
        summary: 'Smart ₱460,059.00 — cafe…',
      },
      inventory: insight,
      performanceKpis: insight,
      recentActivities: insight,
      recommendations: {
        anomalyFlags: ['Demand moved outside the normal operating band.'],
        highlights: [
          'Protect the strongest member cohorts with scheduled retention outreach and measurable follow-up ownership.',
        ],
        opportunities: ['Bundle coaching with the strongest membership lane.'],
        recommendedActions: [
          'Assign one owner to each improvement, publish the target date, and review progress against the selected analytics window.',
          'FINAL RECOMMENDATION',
        ],
        risks: [
          'Capacity may not keep pace with the measured demand increase.',
        ],
        source: 'saved-ai',
        summary:
          'Prioritize the highest-impact actions while keeping operating owners and review dates explicit.',
      },
      revenue: insight,
      systemAlerts: insight,
    },
    inventory: {
      equipment_types: 9,
      equipment_under_maintenance: 2,
      equipment_units_available: 28,
      equipment_units_total: 32,
      low_stock_items: 2,
      out_of_stock_items: 1,
      retail_inventory_value: '460059.00',
      retail_items: 14,
      top_products: [],
    },
    revenue: {
      end_date: '2026-04-30T23:59:59.999Z',
      period: 'monthly',
      series: [
        { bucket_start: '2026-03-01T00:00:00.000Z', total_revenue: '309000' },
        { bucket_start: '2026-04-01T00:00:00.000Z', total_revenue: '1235000' },
      ],
      start_date: '2026-03-01T00:00:00.000Z',
      top_revenue_sources: [
        {
          revenue: '1235000',
          share_percentage: 100,
          source_key: 'membership',
          source_label: 'Memberships',
        },
      ],
      totals: {
        booking_revenue: '0',
        coaching_gym_revenue: '0',
        coaching_payments_collected: '0',
        membership_revenue: '1235000',
        product_revenue: '0',
        total_revenue: '1235000',
      },
    },
    sections,
    snapshot: {
      daily_insights: {
        active_members: 2,
        recent_activities: 8,
        sessions_today: 5,
      },
      generated_at: '2026-04-23T12:00:00.000Z',
      performance_kpis: {
        check_ins: 42,
        coaching_sessions: 7,
        new_members: 3,
        total_coaching_appointments: 6,
        total_revenue: '1235000',
        total_venue_bookings: 9,
      },
      recent_activities: [],
      system_alerts: [],
    },
  };
}

function textPosition(pdf: string, text: string) {
  const escapedText = text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = new RegExp(
    `1 0 0 1 ([\\d.-]+) ([\\d.-]+) Tm \\(${escapedText}\\) Tj`,
  ).exec(pdf);

  expect(match).not.toBeNull();
  return { x: Number(match?.[1]), y: Number(match?.[2]) };
}

describe('buildAnalyticsPdfBuffer layout', () => {
  it('normalizes peso and common typographic input to unambiguous ASCII', () => {
    const pdf = buildAnalyticsPdfBuffer(createArgs(['daily'])).toString(
      'ascii',
    );

    expect(pdf).toContain('(PHP 1,235,000.00) Tj');
    expect(pdf).toContain('(Operations Snapshot) Tj');
    expect(pdf).not.toContain('(?1,235,000.00) Tj');
  });

  it('identifies the exporter without rendering standard section analysis', () => {
    const pdf = buildAnalyticsPdfBuffer(
      createArgs(['daily', 'attendance']),
    ).toString('ascii');

    expect(pdf).toContain('(Exported by Ava Rivera \\(Administrator\\)) Tj');
    expect(pdf).toContain('(Operations Snapshot) Tj');
    expect(pdf).not.toContain('(Daily Insights) Tj');
    expect(pdf).not.toContain('(SECTION ANALYSIS) Tj');
    expect(pdf).not.toContain('(SAVED AI INSIGHT) Tj');
  });

  it('places six metric tiles in a three-column, two-row grid', () => {
    const pdf = buildAnalyticsPdfBuffer(createArgs(['daily'])).toString(
      'ascii',
    );
    const firstTile = textPosition(pdf, 'ACTIVE MEMBERS');
    const fourthTile = textPosition(pdf, 'LIVE ALERTS');

    expect(fourthTile.x).toBeCloseTo(firstTile.x, 1);
    expect(firstTile.y - fourthTile.y).toBeGreaterThan(50);
  });

  it('draws compact revenue-axis labels once per grid tick', () => {
    const pdf = buildAnalyticsPdfBuffer(createArgs(['revenue'])).toString(
      'ascii',
    );

    expect(pdf.match(/\(PHP 1\.24M\) Tj/g)).toHaveLength(1);
    expect(pdf).toContain('(PHP 309k) Tj');
  });

  it('reserves visible bottom padding after the final recommendation bullet', () => {
    const pdf = buildAnalyticsPdfBuffer(
      createArgs(['recommendations']),
    ).toString('ascii');
    const finalLine = textPosition(pdf, 'FINAL RECOMMENDATION');
    const cardRects = Array.from(
      pdf.matchAll(/38\.00 ([\d.]+) 519\.28 ([\d.]+) re B/g),
      (match) => ({
        bottom: Number(match[1]),
        height: Number(match[2]),
      }),
    );
    const containingCard = cardRects.find(
      ({ bottom, height }) =>
        finalLine.y >= bottom && finalLine.y <= bottom + height,
    );

    expect(containingCard).toBeDefined();
    expect(finalLine.y - (containingCard?.bottom ?? 0)).toBeGreaterThanOrEqual(
      14,
    );
  });

  it('preserves explicit recommendations without adding analysis to factual sections', () => {
    const savedInsightPdf = buildAnalyticsPdfBuffer(
      createArgs(['recommendations']),
    ).toString('ascii');
    const deterministicPdf = buildAnalyticsPdfBuffer(
      createArgs(['attendance']),
    ).toString('ascii');

    expect(savedInsightPdf).toContain('(EXECUTIVE SUMMARY) Tj');
    expect(savedInsightPdf).toContain('(TOP HIGHLIGHTS) Tj');
    expect(savedInsightPdf).toContain('(PRIORITY RISKS & ANOMALIES) Tj');
    expect(savedInsightPdf).toContain('(OPPORTUNITIES) Tj');
    expect(savedInsightPdf).toContain('(RECOMMENDED ACTIONS) Tj');
    expect(savedInsightPdf).toContain(
      '(Risk: Capacity may not keep pace with the measured demand increase.) Tj',
    );
    expect(deterministicPdf).not.toContain('(SECTION ANALYSIS) Tj');
    expect(deterministicPdf).not.toContain('(SAVED AI INSIGHT) Tj');
  });

  it('keeps the first complete data row with every table title and header', () => {
    const pdf = buildAnalyticsPdfBuffer(
      createArgs([
        'daily',
        'kpis',
        'revenue',
        'inventory',
        'attendance',
        'alerts',
        'activities',
        'recommendations',
      ]),
    ).toString('ascii');
    const pageStreams = Array.from(
      pdf.matchAll(/stream\n([\s\S]*?)\nendstream/g),
      (match) => match[1],
    );
    const dataSummaryPages = pageStreams.filter((stream) =>
      stream.includes('(Data Summary'),
    );

    expect(dataSummaryPages.length).toBeGreaterThan(0);
    dataSummaryPages.forEach((stream) => {
      const headerEnd = stream.indexOf('(VALUE) Tj');
      expect(headerEnd).toBeGreaterThan(-1);

      const afterHeader = stream.slice(headerEnd + '(VALUE) Tj'.length);
      const firstRowRect = afterHeader.indexOf(' re B');
      const nextTextBlock = afterHeader.indexOf('BT');

      expect(firstRowRect).toBeGreaterThan(-1);
      expect(firstRowRect).toBeLessThan(nextTextBlock);
    });
  });
});
