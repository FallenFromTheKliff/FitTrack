import {
  buildBusinessAnalyticsInsightPdf,
  type BusinessAnalyticsInsightPdfInput,
} from './business-analytics-insight-pdf.builder';

const INSIGHT_ID = '33333333-3333-4333-8333-333333333333';

function createInput(
  overrides: Partial<BusinessAnalyticsInsightPdfInput> = {},
): BusinessAnalyticsInsightPdfInput {
  return {
    id: INSIGHT_ID,
    createdAt: '2026-09-10T05:15:41.433Z',
    focus: 'overview',
    period: 'monthly',
    startDate: '2026-04-01T00:00:00.000Z',
    endDate: '2026-09-10T00:00:00.000Z',
    analysisDepth: 'brief',
    dataFingerprint: 'fingerprint-333',
    summary: 'Saved insight summary for the analytics window.',
    highlights: ['A useful saved highlight.'],
    risks: ['A bounded operating risk.'],
    opportunities: ['A measurable opportunity.'],
    anomalyFlags: ['A variance worth checking.'],
    recommendedActions: ['Assign an owner and target date.'],
    selectedSections: ['overview'],
    sectionContexts: {
      overview: {
        total_revenue: '12345.67',
        zero_count: 0,
        enabled: false,
      },
    },
    sectionAnalyses: {
      overview: {
        summary: 'Saved insight summary for the analytics window.',
        highlights: ['A useful saved highlight.'],
      },
    },
    failedSections: [],
    ...overrides,
  };
}

function extractTextLinesFromSource(source: string): string[] {
  return Array.from(source.matchAll(/\(((?:\\.|[^\\)])*)\) Tj/g), (match) =>
    (match[1] ?? '').replace(/\\([\\()])/g, '$1'),
  );
}

function extractTextLines(buffer: Buffer): string[] {
  return extractTextLinesFromSource(buffer.toString('latin1'));
}

function extractPageLines(buffer: Buffer): string[][] {
  return Array.from(
    buffer.toString('latin1').matchAll(/stream\n([\s\S]*?)\nendstream/g),
    (match) => extractTextLinesFromSource(match[1] ?? ''),
  );
}

function pageCount(buffer: Buffer): number {
  return (buffer.toString('latin1').match(/\/Type \/Page \/Parent/g) ?? [])
    .length;
}

describe('buildBusinessAnalyticsInsightPdf', () => {
  it('preserves ordinary peso input, existing PHP labels, dates, and original metric units', () => {
    const pdf = buildBusinessAnalyticsInsightPdf(
      createInput({
        summary: 'Revenue rose by ₱4,250.00 — Café’s trend… remains useful.',
        sectionContexts: {
          overview: {
            total_revenue: '1045981.00',
            total_check_ins: 471,
            total_workouts: 5,
            zero_value: 0,
            target_value: 30,
            generic_rate: 0.8,
            existing_php_label: 'PHP 1,234.00',
            window: {
              start_date: '2026-04-01T00:00:00.000Z',
              end_date: '2026-09-10T00:00:00.000Z',
              previous_start_date: '2025-10-20T00:00:00.000Z',
              previous_end_date: '2026-03-31T00:00:00.000Z',
            },
            comparisons: {
              total_revenue: {
                current: '1045981.00',
                previous: '518924.00',
                absolute_change: '527057.00',
                percentage_change: 101.6,
              },
            },
            derived_signals: {
              revenue_mix_percentages: {
                bookings: 0,
                coaching: 0.6,
                products: 65.8,
                memberships: 33.6,
              },
            },
          },
        },
      }),
    );
    const source = pdf.toString('latin1');
    const text = extractTextLines(pdf).join('\n');

    expect(source.startsWith('%PDF-1.4')).toBe(true);
    expect(source).toContain('%%EOF');
    expect(text).toContain(
      "Revenue rose by PHP 4,250.00 - Café's trend... remains useful.",
    );
    expect(text).toContain('Existing Php Label: PHP 1,234.00');
    expect(text).not.toContain('PHP PHP');
    expect(text).toContain('Total Revenue: PHP 1,045,981.00');
    expect(text).toContain('Total Check Ins: 471');
    expect(text).toContain('Total Workouts: 5');
    expect(text).toContain('Zero Value: 0');
    expect(text).toContain('Target Value: 30');
    expect(text).toContain('Generic Rate: 0.8');
    expect(text).toContain('Current: PHP 1,045,981.00');
    expect(text).toContain('Previous: PHP 518,924.00');
    expect(text).toContain('Absolute Change: PHP 527,057.00');
    expect(text).toContain('Percentage Change: 101.6%');
    expect(text).toContain('Bookings: 0%');
    expect(text).toContain('Coaching: 0.6%');
    expect(text).toContain('Products: 65.8%');
    expect(text).toContain('Memberships: 33.6%');
    expect(text).toContain('Start Date: Apr 01, 2026');
    expect(text).toContain('End Date: Sep 10, 2026');
    expect(text).toContain('Previous Start Date: Oct 20, 2025');
    expect(text).toContain('Previous End Date: Mar 31, 2026');
    expect(text).not.toContain('Start Date: Apr 01, 2026, 12:00 AM');
    expect(text).not.toContain('End Date: Sep 10, 2026, 12:00 AM');
    expect(text).not.toContain('Previous Start Date: Oct 20, 2025, 12:00 AM');
    expect(text).not.toContain('Previous End Date: Mar 31, 2026, 12:00 AM');
    expect(text).toContain('Created: Sep 10, 2026, 01:15 PM');
    expect(text).not.toContain('"window"');
    expect(text).not.toContain('{"');
    expect(text).not.toMatch(/\?/);
  });

  it('wraps ordinary prose at word boundaries, splits only long tokens, and paginates detail', () => {
    const longToken = 'synthetic-token-' + 'x'.repeat(220);
    const pdf = buildBusinessAnalyticsInsightPdf(
      createInput({
        summary:
          'ordinary prose stays intact at word boundaries while the report keeps every finding.',
        highlights: [
          'Synthetic long fixture marker: ' + longToken,
          ...Array.from(
            { length: 18 },
            (_, index) =>
              `Synthetic supporting finding ${index + 1} keeps a complete sentence and a measurable owner.`,
          ),
        ],
        risks: Array.from(
          { length: 10 },
          (_, index) =>
            `Synthetic risk ${index + 1} retains its full wording across the paginated report.`,
        ),
        sectionContexts: {
          overview: {
            observations: Array.from({ length: 48 }, (_, index) => ({
              observation_date: `2026-08-${String((index % 28) + 1).padStart(2, '0')}`,
              amount: index * 125,
              zero_count: 0,
              label: `Synthetic observation ${index + 1}`,
            })),
          },
        },
      }),
    );
    const lines = extractTextLines(pdf);
    const text = lines.join('\n');
    const pages = pageCount(pdf);
    const compactText = lines.join('').replace(/\s+/g, '');

    expect(pages).toBeGreaterThan(1);
    expect(lines.some((line) => line.includes('ordinary prose'))).toBe(true);
    expect(compactText).toContain(longToken);
    expect(text).toContain('Synthetic observation 48');
    expect(text).toContain('Zero Count: 0');
    expect(pdf.toString('latin1').match(/23 Tf/g) ?? []).toHaveLength(1);

    const pageLabels: string[] = text.match(/Page \d+ of \d+/g) ?? [];
    expect(pageLabels).toHaveLength(pages);
    expect(
      new Set(pageLabels.map((label) => label.replace(/^Page \d+ of /, ''))),
    ).toEqual(new Set([String(pages)]));
  });

  it('starts supporting data on a fresh page only when real context exists', () => {
    const pdf = buildBusinessAnalyticsInsightPdf(
      createInput({
        highlights: Array.from(
          { length: 30 },
          (_, index) =>
            `Synthetic lead finding ${index + 1} fills the preceding page while preserving a complete sentence.`,
        ),
        risks: [],
        opportunities: [],
        anomalyFlags: [],
        recommendedActions: [],
        sectionContexts: {
          overview: { total_revenue: '1045981.00' },
        },
        sectionAnalyses: {},
      }),
    );
    const pages = extractPageLines(pdf);
    const supportingPage = pages.findIndex((lines) =>
      lines.includes('Supporting data'),
    );

    expect(supportingPage).toBeGreaterThan(0);
    expect(pages[supportingPage]).toContain('Overview');
    expect(pages[supportingPage]).toContain('Total Revenue: PHP 1,045,981.00');
  });

  it('keeps blank legacy and failed-section snapshots usable and compact', () => {
    const pdf = buildBusinessAnalyticsInsightPdf(
      createInput({
        summary: '',
        highlights: [],
        risks: [],
        opportunities: [],
        anomalyFlags: [],
        recommendedActions: [],
        selectedSections: [],
        sectionContexts: {},
        sectionAnalyses: {},
        dataFingerprint: '',
        failedSections: ['revenue', 'attendance'],
      }),
    );
    const pages = extractPageLines(pdf);
    const text = pages.flat().join('\n');

    expect(pageCount(pdf)).toBe(1);
    expect(pages).toHaveLength(1);
    expect(pages[0]).toContain('Supporting data');
    expect(text).toContain('No insight summary was recorded.');
    expect(text).toContain(
      'Sections with incomplete analysis: Revenue, Attendance.',
    );
    expect(text).toContain(
      'No stored section context was available for this legacy insight.',
    );
    expect(text).toContain('Data fingerprint: Not recorded');
  });

  it('identifies model metadata as belonging to the original saved insight', () => {
    const pdf = buildBusinessAnalyticsInsightPdf(
      createInput({
        sectionAnalyses: {
          overview: {
            model_used: 'deepseek-v4-flash',
            token_count: 321,
          },
        },
      }),
    );
    const text = extractTextLines(pdf).join(' ').replace(/\s+/g, ' ');

    expect(text).toContain('Original insight model: deepseek-v4-flash');
    expect(text).toContain('Original insight token count: 321');
    expect(text).not.toContain('Model used:');
    expect(text).not.toContain('Token count:');
  });

  it('prepends the transient comparison to Top highlights and caps the list', () => {
    const pdf = buildBusinessAnalyticsInsightPdf(
      createInput({
        highlights: [
          'Current highlight one.',
          'Current highlight two.',
          'Current highlight three.',
          'Current highlight four.',
          'Current highlight five should be capped.',
        ],
        previousOutcome: {
          score: 8,
          verdict: 'effective',
          explanation:
            'The later snapshot is consistent with the earlier recommendation.',
          previousInsightId: '22222222-2222-4222-8222-222222222222',
          previousCreatedAt: '2026-08-12T05:00:00.000Z',
        },
      }),
    );
    const text = extractTextLines(pdf).join(' ').replace(/\s+/g, ' ');

    expect(text).toContain(
      'Previous AI recommendation outcome (Aug 12, 2026): 8/10 - Effective.',
    );
    expect(text).toContain(
      'The later snapshot is consistent with the earlier recommendation.',
    );
    expect(text.indexOf('Previous AI recommendation outcome')).toBeLessThan(
      text.indexOf('Current highlight one.'),
    );
    expect(text).toContain('Current highlight four.');
    expect(text).not.toContain('Current highlight five should be capped.');
    expect(text).toContain(
      'Comparison only; this does not verify that the recommendation was implemented.',
    );
  });

  it('renders N/A when comparison was requested without an older insight', () => {
    const pdf = buildBusinessAnalyticsInsightPdf(
      createInput({
        previousOutcome: {
          score: null,
          verdict: 'insufficient_data',
          explanation: 'No earlier comparable AI insight was available.',
          previousInsightId: null,
          previousCreatedAt: null,
        },
      }),
    );
    const text = extractTextLines(pdf).join(' ').replace(/\s+/g, ' ');

    expect(text).toContain(
      'Previous AI recommendation outcome: N/A - Insufficient Data.',
    );
    expect(text).toContain('No earlier comparable AI insight was available.');
    expect(text).toContain(
      'Comparison only; this does not verify that the recommendation was implemented.',
    );
    expect(text).toContain('Priority risks');
    expect(text).toContain('Recommended actions');
    expect(text).toContain('Supporting data');
  });
});
