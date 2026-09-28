import type {
  BusinessInsightOutcomeEvaluationRequest,
  BusinessInsightOutcomeEvaluationResponse,
} from '../ai/ai-python-client.service';
import { BusinessAnalyticsController } from './business-analytics.controller';
import { BusinessAnalyticsInsightPdfExportService } from './business-analytics-insight-pdf-export.service';

type EvaluateBusinessInsightOutcomeMock = jest.MockedFunction<
  (
    input: BusinessInsightOutcomeEvaluationRequest,
  ) => Promise<BusinessInsightOutcomeEvaluationResponse>
>;

const SAVED_ID = '44444444-4444-4444-8444-444444444444';
const PREVIOUS_ID = '33333333-3333-4333-8333-333333333333';
const SAVED_CREATED_AT = '2026-09-08T04:00:00.000Z';

function storedRequestPayload(
  dataFingerprint = 'saved-fingerprint-444',
) {
  return {
    grounding: {
      window: {
        focus: 'revenue',
        period: 'monthly',
        start_date: '2026-08-01',
        end_date: '2026-09-08',
      },
      overview: {
        new_members: 0,
        total_revenue: '12345.67',
        total_check_ins: 0,
        completed_coaching_sessions: 0,
      },
      revenue: {
        totals: { total_revenue: '12345.67' },
        series: [],
        top_revenue_sources: [],
      },
    },
    analysis: {
      analysis_depth: 'detailed',
      selected_sections: ['revenue'],
      section_contexts: {
        revenue: {
          total_revenue: '12345.67',
          zero_count: 0,
          nested: { retained_value: 0 },
        },
      },
      data_fingerprint: dataFingerprint,
    },
  };
}

function storedRun(overrides: Record<string, unknown> = {}) {
  return {
    id: SAVED_ID,
    created_at: new Date(SAVED_CREATED_AT),
    focus: 'revenue',
    period: 'monthly',
    start_date: new Date('2026-08-01T00:00:00.000Z'),
    end_date: new Date('2026-09-08T00:00:00.000Z'),
    request_payload: storedRequestPayload(),
    insight_payload: {
      summary: 'Saved revenue evidence remains available for this window.',
      highlights: ['Membership revenue is retained.'],
      risks: ['Retail concentration needs an owner.'],
      opportunities: ['Test a bounded coaching bundle.'],
      anomaly_flags: [],
      recommended_actions: [
        'Finance - next 7 days - attribute the period change.',
      ],
      section_analyses: {
        revenue: {
          summary: 'Saved revenue evidence remains available for this window.',
          supporting_detail: { zero_count: 0, explanation: 'Stored value.' },
        },
      },
      failed_sections: [],
    },
    ...overrides,
  };
}

function extractText(buffer: Buffer): string {
  return Array.from(
    buffer.toString('latin1').matchAll(/\(((?:\\.|[^\\)])*)\) Tj/g),
    (match) => (match[1] ?? '').replace(/\\([\\()])/g, '$1'),
  ).join('\n');
}

describe('BusinessAnalyticsInsightPdfExportService', () => {
  const repository = {
    findInsightRunByIdOrThrow: jest.fn(),
    findLatestPreviousInsightRun: jest.fn(),
  };
  const aiPythonClient = {
    evaluateBusinessInsightOutcome:
      jest.fn() as EvaluateBusinessInsightOutcomeMock,
  };
  let service: BusinessAnalyticsInsightPdfExportService;

  beforeEach(() => {
    service = new BusinessAnalyticsInsightPdfExportService(
      repository as never,
      aiPythonClient as never,
    );
    jest.clearAllMocks();
  });

  it('maps one saved snapshot by id into the real PDF builder without live calls', async () => {
    repository.findInsightRunByIdOrThrow.mockResolvedValue(storedRun());

    const result = await service.exportInsightPdf(SAVED_ID);
    const text = extractText(result.buffer);

    expect(repository.findInsightRunByIdOrThrow).toHaveBeenCalledTimes(1);
    expect(repository.findInsightRunByIdOrThrow).toHaveBeenCalledWith(SAVED_ID);
    expect(result.fileName).toBe('fittrack-business-insight-2026-09-08.pdf');
    expect(result.buffer.subarray(0, 8).toString('utf8')).toBe('%PDF-1.4');
    expect(result.buffer.toString('latin1')).toContain('%%EOF');
    expect(text).toContain(
      'Saved revenue evidence remains available for this window.',
    );
    expect(text).toContain('Total Revenue: PHP 12,345.67');
    expect(text).toContain('Zero Count: 0');
    expect(text).toContain('Retained Value: 0');
    expect(text).toContain('Insight ID: ' + SAVED_ID);
    expect(text).not.toContain('"section_contexts"');
    expect(repository.findLatestPreviousInsightRun).not.toHaveBeenCalled();
    expect(
      aiPythonClient.evaluateBusinessInsightOutcome,
    ).not.toHaveBeenCalled();
  });

  it('keeps a legacy payload exportable with the same date-based filename', async () => {
    repository.findInsightRunByIdOrThrow.mockResolvedValue(
      storedRun({
        request_payload: {},
        insight_payload: {
          summary: '',
          highlights: [],
          risks: [],
          opportunities: [],
          anomaly_flags: [],
          recommended_actions: [],
          section_analyses: {},
          failed_sections: ['attendance'],
        },
      }),
    );

    const result = await service.exportPdf(SAVED_ID);
    const text = extractText(result.buffer);

    expect(result.fileName).toBe('fittrack-business-insight-2026-09-08.pdf');
    expect(text).toContain('No insight summary was recorded.');
    expect(text).toContain(
      'No stored section context was available for this legacy insight.',
    );
    expect(text).toContain('Data fingerprint: Not recorded');
  });

  it('automatically compares the latest older run exactly once', async () => {
    const current = storedRun();
    const previous = storedRun({
      id: PREVIOUS_ID,
      created_at: new Date('2026-08-08T04:00:00.000Z'),
      request_payload: storedRequestPayload('saved-fingerprint-333'),
      insight_payload: {
        summary: 'Earlier revenue recommendation.',
        highlights: ['Earlier revenue highlight.'],
        risks: ['Earlier revenue risk.'],
        opportunities: ['Earlier revenue opportunity.'],
        anomaly_flags: [],
        recommended_actions: ['Adjust the revenue mix.'],
        section_analyses: {
          revenue: {
            summary: 'Earlier revenue recommendation.',
            supporting_detail: { explanation: 'Stored earlier value.' },
          },
        },
        failed_sections: [],
      },
    });
    repository.findInsightRunByIdOrThrow.mockResolvedValue(current);
    repository.findLatestPreviousInsightRun.mockResolvedValue(previous);
    aiPythonClient.evaluateBusinessInsightOutcome.mockResolvedValue({
      score: 8,
      verdict: 'effective',
      explanation:
        'The later snapshot is consistent with the earlier recommendation.',
    });

    const result = await service.exportInsightPdf(SAVED_ID, {
      comparePrevious: true,
    });
    const text = extractText(result.buffer);

    expect(repository.findLatestPreviousInsightRun).toHaveBeenCalledWith(
      new Date(SAVED_CREATED_AT),
      SAVED_ID,
    );
    expect(aiPythonClient.evaluateBusinessInsightOutcome).toHaveBeenCalledTimes(
      1,
    );
    const evaluationRequest =
      aiPythonClient.evaluateBusinessInsightOutcome.mock.calls[0]?.[0];
    if (!evaluationRequest) {
      throw new Error('Expected one business insight outcome request.');
    }
    expect(evaluationRequest.previous).toMatchObject({
      summary: 'Earlier revenue recommendation.',
      recommended_actions: ['Adjust the revenue mix.'],
      selected_sections: ['revenue'],
    });
    expect(evaluationRequest.current).toMatchObject({
      selected_sections: ['revenue'],
    });
    expect(evaluationRequest.comparison_context).toEqual({
      previous_created_at: '2026-08-08T04:00:00.000Z',
      current_created_at: SAVED_CREATED_AT,
      elapsed_minutes: 44640,
      analytics_snapshot_changed: true,
    });
    expect(text).toContain(
      'Previous AI recommendation outcome (Aug 08, 2026): 8/10 - Effective.',
    );
    expect(text.indexOf('Previous AI recommendation outcome')).toBeLessThan(
      text.indexOf('Membership revenue is retained.'),
    );
  });

  it('uses the exact manually selected older insight instead of automatic lookup', async () => {
    repository.findInsightRunByIdOrThrow
      .mockResolvedValueOnce(storedRun())
      .mockResolvedValueOnce(
        storedRun({
          id: PREVIOUS_ID,
          created_at: new Date('2026-08-08T04:00:00.000Z'),
          request_payload: storedRequestPayload('saved-fingerprint-333'),
        }),
      );
    aiPythonClient.evaluateBusinessInsightOutcome.mockResolvedValue({
      score: 5,
      verdict: 'partially_effective',
      explanation:
        'The later result is mixed relative to the earlier snapshot.',
    });

    await service.exportInsightPdf(SAVED_ID, {
      comparePrevious: true,
      previousInsightId: PREVIOUS_ID,
    });

    expect(repository.findInsightRunByIdOrThrow).toHaveBeenNthCalledWith(
      2,
      PREVIOUS_ID,
    );
    expect(repository.findLatestPreviousInsightRun).not.toHaveBeenCalled();
    expect(aiPythonClient.evaluateBusinessInsightOutcome).toHaveBeenCalledTimes(
      1,
    );
  });

  it('exports an insufficient-data comparison without calling AI when no older run exists', async () => {
    repository.findInsightRunByIdOrThrow.mockResolvedValue(storedRun());
    repository.findLatestPreviousInsightRun.mockResolvedValue(null);

    const result = await service.exportInsightPdf(SAVED_ID, {
      comparePrevious: true,
    });
    const text = extractText(result.buffer);

    expect(
      aiPythonClient.evaluateBusinessInsightOutcome,
    ).not.toHaveBeenCalled();
    expect(text).toContain(
      'Previous AI recommendation outcome: N/A - Insufficient Data.',
    );
    expect(text).toContain('No earlier comparable AI insight was available.');
  });

  it('calls AI when saved fingerprints are identical and exports its verdict', async () => {
    repository.findInsightRunByIdOrThrow.mockResolvedValue(
      storedRun({
        created_at: new Date('2026-09-08T05:00:00.000Z'),
        request_payload: storedRequestPayload('same-fingerprint'),
      }),
    );
    repository.findLatestPreviousInsightRun.mockResolvedValue(
      storedRun({
        id: PREVIOUS_ID,
        created_at: new Date('2026-09-08T04:00:00.000Z'),
        request_payload: storedRequestPayload('same-fingerprint'),
      }),
    );
    aiPythonClient.evaluateBusinessInsightOutcome.mockResolvedValue({
      score: null,
      verdict: 'insufficient_data',
      explanation:
        'Only 60 minutes elapsed and the saved analytics snapshot remained unchanged, so there is not yet enough evidence to evaluate the recommendation.',
    });

    const result = await service.exportInsightPdf(SAVED_ID, {
      comparePrevious: true,
    });
    const text = extractText(result.buffer).replace(/\s+/g, ' ');

    expect(aiPythonClient.evaluateBusinessInsightOutcome).toHaveBeenCalledTimes(
      1,
    );
    const evaluationRequest =
      aiPythonClient.evaluateBusinessInsightOutcome.mock.calls[0]?.[0];
    if (!evaluationRequest) {
      throw new Error('Expected one business insight outcome request.');
    }
    expect(evaluationRequest.comparison_context).toEqual({
      previous_created_at: '2026-09-08T04:00:00.000Z',
      current_created_at: '2026-09-08T05:00:00.000Z',
      elapsed_minutes: 60,
      analytics_snapshot_changed: false,
    });
    expect(text).toContain(
      'Previous AI recommendation outcome (Sep 08, 2026): N/A - Insufficient Data.',
    );
    expect(text).toContain(
      'Only 60 minutes elapsed and the saved analytics snapshot remained unchanged, so there is not yet enough evidence to evaluate the recommendation.',
    );
    expect(text.indexOf('N/A - Insufficient Data.')).toBeLessThan(
      text.indexOf('Membership revenue is retained.'),
    );
  });

  it('exports an insufficient-data comparison without AI when the previous insight has no recommendation', async () => {
    const previous = storedRun({
      id: PREVIOUS_ID,
      created_at: new Date('2026-08-08T04:00:00.000Z'),
      request_payload: storedRequestPayload('saved-fingerprint-333'),
      insight_payload: {
        summary: 'Earlier revenue insight without a saved recommendation.',
        highlights: ['Earlier revenue highlight.'],
        risks: [],
        opportunities: [],
        anomaly_flags: [],
        recommended_actions: [],
        section_analyses: {},
        failed_sections: [],
      },
    });
    repository.findInsightRunByIdOrThrow.mockResolvedValue(storedRun());
    repository.findLatestPreviousInsightRun.mockResolvedValue(previous);

    const result = await service.exportInsightPdf(SAVED_ID, {
      comparePrevious: true,
    });
    const text = extractText(result.buffer).replace(/\s+/g, ' ');

    expect(
      aiPythonClient.evaluateBusinessInsightOutcome,
    ).not.toHaveBeenCalled();
    expect(text).toContain('N/A - Insufficient Data.');
    expect(text).toContain(
      'The previous AI insight did not contain a recommendation that could be evaluated.',
    );
  });

  it.each([
    ['the current insight', SAVED_ID, SAVED_CREATED_AT],
    ['a newer insight', PREVIOUS_ID, '2026-10-08T04:00:00.000Z'],
  ])('rejects %s as the manual previous run', async (_label, id, createdAt) => {
    repository.findInsightRunByIdOrThrow
      .mockResolvedValueOnce(storedRun())
      .mockResolvedValueOnce(
        storedRun({ id, created_at: new Date(createdAt) }),
      );

    await expect(
      service.exportInsightPdf(SAVED_ID, {
        comparePrevious: true,
        previousInsightId: id,
      }),
    ).rejects.toThrow(
      'The previous insight must have been generated before the current insight.',
    );
    expect(
      aiPythonClient.evaluateBusinessInsightOutcome,
    ).not.toHaveBeenCalled();
  });

  it('surfaces comparison AI failures instead of fabricating a verdict', async () => {
    repository.findInsightRunByIdOrThrow.mockResolvedValue(storedRun());
    repository.findLatestPreviousInsightRun.mockResolvedValue(
      storedRun({
        id: PREVIOUS_ID,
        created_at: new Date('2026-08-08T04:00:00.000Z'),
        request_payload: storedRequestPayload('saved-fingerprint-333'),
      }),
    );
    aiPythonClient.evaluateBusinessInsightOutcome.mockRejectedValue(
      new Error('comparison unavailable'),
    );

    await expect(
      service.exportInsightPdf(SAVED_ID, { comparePrevious: true }),
    ).rejects.toThrow('comparison unavailable');
  });
});

describe('BusinessAnalyticsController PDF export mapping', () => {
  it('requests the exact saved id and writes PDF headers and bytes', async () => {
    const buffer = Buffer.from('%PDF-1.4\nfixture\n%%EOF', 'ascii');
    const pdfService = {
      exportInsightPdf: jest.fn().mockResolvedValue({
        buffer,
        fileName: 'fittrack-business-insight-2026-09-08.pdf',
      }),
    };
    const response = {
      setHeader: jest.fn(),
      send: jest.fn(),
    };
    const controller = new BusinessAnalyticsController(
      {} as never,
      pdfService as never,
    );

    await controller.exportInsightPdf(SAVED_ID, response as never);

    expect(pdfService.exportInsightPdf).toHaveBeenCalledWith(SAVED_ID);
    expect(response.setHeader).toHaveBeenNthCalledWith(
      1,
      'Content-Type',
      'application/pdf',
    );
    expect(response.setHeader).toHaveBeenNthCalledWith(
      2,
      'Content-Disposition',
      'attachment; filename="fittrack-business-insight-2026-09-08.pdf"',
    );
    expect(response.send).toHaveBeenCalledWith(buffer);
  });

  it('maps POST comparison options into the export service', async () => {
    const buffer = Buffer.from('%PDF-1.4\nfixture\n%%EOF', 'ascii');
    const pdfService = {
      exportInsightPdf: jest.fn().mockResolvedValue({
        buffer,
        fileName: 'fittrack-business-insight-2026-09-08.pdf',
      }),
    };
    const response = {
      setHeader: jest.fn(),
      send: jest.fn(),
    };
    const controller = new BusinessAnalyticsController(
      {} as never,
      pdfService as never,
    );

    await controller.exportInsightPdfWithOptions(
      SAVED_ID,
      {
        compare_previous: true,
        previous_insight_run_id: PREVIOUS_ID,
      },
      response as never,
    );

    expect(pdfService.exportInsightPdf).toHaveBeenCalledWith(SAVED_ID, {
      comparePrevious: true,
      previousInsightId: PREVIOUS_ID,
    });
    expect(response.send).toHaveBeenCalledWith(buffer);
  });
});
