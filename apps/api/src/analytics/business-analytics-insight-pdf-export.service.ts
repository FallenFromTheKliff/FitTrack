import { BadRequestException, Injectable } from '@nestjs/common';
import { InsightFocus, InsightPeriod } from '@prisma/client';

import { BusinessInsightRunRepository } from './business-insight-run.repository';
import { BusinessInsightSnapshotService } from './business-insight-snapshot.service';
import {
  buildBusinessAnalyticsInsightPdf,
  type BusinessAnalyticsInsightPdfInput,
} from './business-analytics-insight-pdf.builder';

import { AiPythonClientService } from '../ai/ai-python-client.service';

export type BusinessInsightPdfExportOptions = {
  comparePrevious?: boolean;
  previousInsightId?: string;
};
type StoredInsightRun = {
  id: string;
  created_at: Date | string;
  focus: InsightFocus;
  period: InsightPeriod;
  start_date: Date | string;
  end_date: Date | string;
  request_payload: unknown;
  insight_payload: unknown;
};

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];
}

function asUnknownArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asIso(value: unknown): string {
  if (value instanceof Date) {
    return value.toISOString();
  }
  return typeof value === 'string' ? value : '';
}

@Injectable()
export class BusinessAnalyticsInsightPdfExportService {
  constructor(
    private readonly runRepository: BusinessInsightRunRepository,
    private readonly aiPythonClient: AiPythonClientService,
  ) {}

  async exportInsightPdf(
    id: string,
    options: BusinessInsightPdfExportOptions = {},
  ): Promise<{ buffer: Buffer; fileName: string }> {
    const run = await this.runRepository.findInsightRunByIdOrThrow(id);
    const previousOutcome = options.comparePrevious
      ? await this.evaluatePreviousOutcome(run, options.previousInsightId)
      : null;
    const input = this.toPdfInput(run, previousOutcome);
    const createdDate = input.createdAt.slice(0, 10) || 'snapshot';

    return {
      buffer: buildBusinessAnalyticsInsightPdf(input),
      fileName: 'fittrack-business-insight-' + createdDate + '.pdf',
    };
  }

  async exportPdf(
    id: string,
    options: BusinessInsightPdfExportOptions = {},
  ): Promise<{ buffer: Buffer; fileName: string }> {
    return this.exportInsightPdf(id, options);
  }

  private async evaluatePreviousOutcome(
    currentRun: StoredInsightRun,
    previousInsightId?: string,
  ): Promise<NonNullable<BusinessAnalyticsInsightPdfInput['previousOutcome']>> {
    const currentCreatedAt = new Date(currentRun.created_at);
    const previousRun = previousInsightId
      ? await this.runRepository.findInsightRunByIdOrThrow(previousInsightId)
      : await this.runRepository.findLatestPreviousInsightRun(
          currentCreatedAt,
          currentRun.id,
        );

    if (!previousRun) {
      return {
        score: null,
        verdict: 'insufficient_data',
        explanation: 'No earlier comparable AI insight was available.',
        previousInsightId: null,
        previousCreatedAt: null,
      };
    }

    const previousCreatedAt = new Date(previousRun.created_at);
    if (
      previousRun.id === currentRun.id ||
      previousCreatedAt.getTime() >= currentCreatedAt.getTime()
    ) {
      throw new BadRequestException(
        'The previous insight must have been generated before the current insight.',
      );
    }

    const previousSnapshot = this.toComparisonSnapshot(previousRun);
    const currentSnapshot = this.toComparisonSnapshot(currentRun);
    if (!previousSnapshot || !currentSnapshot) {
      return {
        score: null,
        verdict: 'insufficient_data',
        explanation:
          'The saved snapshots do not include enough comparable data to evaluate the previous recommendation.',
        previousInsightId: previousRun.id,
        previousCreatedAt: asIso(previousRun.created_at),
      };
    }

    if (previousSnapshot.recommendedActions.length === 0) {
      return {
        score: null,
        verdict: 'insufficient_data',
        explanation:
          'The previous AI insight did not contain a recommendation that could be evaluated.',
        previousInsightId: previousRun.id,
        previousCreatedAt: asIso(previousRun.created_at),
      };
    }

    const previousFingerprint = previousSnapshot.dataFingerprint;
    const currentFingerprint = currentSnapshot.dataFingerprint;
    const analyticsSnapshotChanged =
      !previousFingerprint ||
      !currentFingerprint ||
      previousFingerprint !== currentFingerprint;
    const elapsedMinutes = Math.max(
      0,
      Math.round(
        (currentCreatedAt.getTime() - previousCreatedAt.getTime()) / 60000,
      ),
    );

    const evaluation = await this.aiPythonClient.evaluateBusinessInsightOutcome(
      {
        previous: {
          summary: previousSnapshot.summary,
          recommended_actions: previousSnapshot.recommendedActions,
          selected_sections: previousSnapshot.selectedSections,
          grounding: previousSnapshot.grounding,
        },
        current: {
          selected_sections: currentSnapshot.selectedSections,
          grounding: currentSnapshot.grounding,
        },
        comparison_context: {
          previous_created_at: asIso(previousRun.created_at),
          current_created_at: asIso(currentRun.created_at),
          elapsed_minutes: elapsedMinutes,
          analytics_snapshot_changed: analyticsSnapshotChanged,
        },
      },
    );

    return {
      ...evaluation,
      previousInsightId: previousRun.id,
      previousCreatedAt: asIso(previousRun.created_at),
    };
  }

  private toComparisonSnapshot(run: StoredInsightRun) {
    const requestPayload = asRecord(run.request_payload);
    const insightPayload = asRecord(run.insight_payload);
    const snapshot = BusinessInsightSnapshotService.fromStoredPayload(
      requestPayload,
      run.focus,
    );
    if (!snapshot) return null;

    const selectedSections = asStringArray(snapshot.analysis.selected_sections);

    return {
      dataFingerprint: asString(snapshot.analysis.data_fingerprint),
      grounding: snapshot.grounding,
      summary:
        asString(insightPayload.summary).trim() ||
        'No saved insight summary was recorded.',
      recommendedActions: asStringArray(insightPayload.recommended_actions),
      selectedSections: selectedSections.length
        ? selectedSections
        : [asString(run.focus, 'overview')],
    };
  }

  private toPdfInput(
    run: StoredInsightRun,
    previousOutcome: BusinessAnalyticsInsightPdfInput['previousOutcome'],
  ): BusinessAnalyticsInsightPdfInput {
    const requestPayload = asRecord(run.request_payload);
    const insightPayload = asRecord(run.insight_payload);
    const snapshot = BusinessInsightSnapshotService.fromStoredPayload(
      requestPayload,
      run.focus,
    );
    const analysis = asRecord(snapshot?.analysis);
    const selectedSections = asStringArray(analysis.selected_sections);
    const sectionContexts = asRecord(analysis.section_contexts);
    const sectionAnalyses = asRecord(insightPayload.section_analyses);

    return {
      id: run.id,
      createdAt: asIso(run.created_at),
      focus: asString(run.focus, 'overview'),
      period: asString(run.period, 'monthly'),
      startDate: asIso(run.start_date),
      endDate: asIso(run.end_date),
      analysisDepth: asString(analysis.analysis_depth, 'brief'),
      dataFingerprint: asString(analysis.data_fingerprint),
      summary: asString(insightPayload.summary),
      highlights: asUnknownArray(insightPayload.highlights),
      risks: asUnknownArray(insightPayload.risks),
      opportunities: asUnknownArray(insightPayload.opportunities),
      anomalyFlags: asUnknownArray(insightPayload.anomaly_flags),
      recommendedActions: asUnknownArray(insightPayload.recommended_actions),
      selectedSections: selectedSections.length
        ? selectedSections
        : [asString(run.focus, 'overview')],
      sectionContexts,
      sectionAnalyses,
      failedSections: asStringArray(insightPayload.failed_sections),
      previousOutcome,
    };
  }
}
