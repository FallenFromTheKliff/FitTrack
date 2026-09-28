import { Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { InsightFocus } from '@prisma/client';

import type { BusinessAnalyticsInsightResponse } from '../ai/ai-python-client.service';
import type {
  BusinessAnalyticsGroundingPayload,
  BuildBusinessInsightGroundingInput,
} from './analytics.types';
import { AnalyticsService } from './analytics.service';
import {
  BUSINESS_INSIGHT_ANALYSIS_DEPTHS,
  type BusinessInsightAnalysisDepth,
  type BusinessInsightCompatibilityDTO,
  type GenerateBusinessInsightDTO,
} from './dto/business-analytics-insight.dto';

export type BusinessInsightSnapshotAnalysis = {
  analysis_depth: BusinessInsightAnalysisDepth;
  selected_sections: InsightFocus[];
  section_contexts: Record<string, Record<string, unknown>>;
  data_fingerprint: string;
};

export type BusinessInsightSnapshotPayload = {
  grounding: BusinessAnalyticsGroundingPayload;
  analysis: BusinessInsightSnapshotAnalysis;
};

const BUSINESS_INSIGHT_FOCUS_ORDER: InsightFocus[] = [
  InsightFocus.overview,
  InsightFocus.revenue,
  InsightFocus.attendance,
  InsightFocus.membership,
  InsightFocus.coaching,
  InsightFocus.inventory,
];

@Injectable()
export class BusinessInsightSnapshotService {
  constructor(private readonly analyticsService: AnalyticsService) {}

  async buildSnapshot(
    input: GenerateBusinessInsightDTO,
  ): Promise<BusinessInsightSnapshotPayload> {
    const selectedSections = this.canonicalizeSelectedSections(
      input.selected_sections?.length
        ? input.selected_sections
        : [input.focus ?? InsightFocus.overview],
    );
    return this.buildSnapshotForSelection(
      input,
      selectedSections,
      input.analysis_depth ?? 'brief',
    );
  }

  async buildSnapshotForSelection(
    input: Pick<
      GenerateBusinessInsightDTO | BusinessInsightCompatibilityDTO,
      'start_date' | 'end_date' | 'period'
    >,
    selectedSections: InsightFocus[],
    analysisDepth: BusinessInsightAnalysisDepth,
  ): Promise<BusinessInsightSnapshotPayload> {
    const groundingInput: BuildBusinessInsightGroundingInput = {
      ...(input.start_date ? { start_date: input.start_date } : {}),
      ...(input.end_date ? { end_date: input.end_date } : {}),
      ...(input.period ? { period: input.period } : {}),
      focus: InsightFocus.overview,
    };
    const grounding =
      await this.analyticsService.buildBusinessInsightGroundingPayload(
        groundingInput,
      );
    return this.createSnapshot(grounding, selectedSections, analysisDepth);
  }

  createSnapshot(
    grounding: BusinessAnalyticsGroundingPayload,
    selectedSections: InsightFocus[],
    analysisDepth: BusinessInsightAnalysisDepth,
  ): BusinessInsightSnapshotPayload {
    const sections = this.canonicalizeSelectedSections(selectedSections);
    const persistedFocus =
      sections.length === 1 ? sections[0] : InsightFocus.overview;
    const normalizedGrounding: BusinessAnalyticsGroundingPayload = {
      ...grounding,
      window: {
        ...grounding.window,
        focus: persistedFocus,
      },
    };
    const sectionContexts = BusinessInsightSnapshotService.projectSectionContexts(
      normalizedGrounding,
      sections,
    );
    const dataFingerprint = BusinessInsightSnapshotService.createFingerprint(
      normalizedGrounding.window,
      analysisDepth,
      sections,
      sectionContexts,
    );
    return {
      grounding: normalizedGrounding,
      analysis: {
        analysis_depth: analysisDepth,
        selected_sections: sections,
        section_contexts: sectionContexts,
        data_fingerprint: dataFingerprint,
      },
    };
  }

  static fromStoredPayload(
    value: unknown,
    fallbackFocus: InsightFocus,
  ): BusinessInsightSnapshotPayload | null {
    const payload = this.toRecord(value);
    const grounding = this.toRecord(
      payload.grounding,
    ) as unknown as BusinessAnalyticsGroundingPayload;
    if (!grounding.window || !grounding.overview) {
      return null;
    }
    const storedAnalysis = this.toRecord(payload.analysis);
    const selectedSections = this.canonicalizeSelectedSections(
      Array.isArray(storedAnalysis.selected_sections)
        ? storedAnalysis.selected_sections as InsightFocus[]
        : [fallbackFocus],
    );
    const analysisDepth = this.toAnalysisDepth(storedAnalysis.analysis_depth);
    const normalizedGrounding: BusinessAnalyticsGroundingPayload = {
      ...grounding,
      window: {
        ...grounding.window,
        focus:
          selectedSections.length === 1
            ? selectedSections[0]
            : InsightFocus.overview,
      },
    };
    const storedContexts = this.toRecord(storedAnalysis.section_contexts);
    const sectionContexts =
      Object.keys(storedContexts).length > 0
        ? storedContexts as Record<string, Record<string, unknown>>
        : BusinessInsightSnapshotService.projectSectionContexts(
            normalizedGrounding,
            selectedSections,
          );
    const dataFingerprint =
      typeof storedAnalysis.data_fingerprint === 'string' &&
      storedAnalysis.data_fingerprint.length > 0
        ? storedAnalysis.data_fingerprint
        : this.createFingerprint(
            normalizedGrounding.window,
            analysisDepth,
            selectedSections,
            sectionContexts,
          );
    return {
      grounding: normalizedGrounding,
      analysis: {
        analysis_depth: analysisDepth,
        selected_sections: selectedSections,
        section_contexts: sectionContexts,
        data_fingerprint: dataFingerprint,
      },
    };
  }

  static buildSectionAnalyses(
    response: BusinessAnalyticsInsightResponse,
    selectedSections: InsightFocus[],
  ): Record<string, Record<string, unknown>> {
    const existing = this.toRecord(response.section_analyses);
    if (Object.keys(existing).length > 0) {
      return existing as Record<string, Record<string, unknown>>;
    }
    const base: Record<string, unknown> = {
      summary: response.summary,
      highlights: response.highlights,
      risks: response.risks,
      opportunities: response.opportunities,
      anomaly_flags: response.anomaly_flags,
      recommended_actions: response.recommended_actions,
      model_used: response.model_used ?? null,
      token_count: response.token_count ?? null,
    };
    return this.canonicalizeSelectedSections(selectedSections).reduce<
      Record<string, Record<string, unknown>>
    >((result, section) => {
      result[section] = { ...base };
      return result;
    }, {});
  }

  static createFingerprint(
    window: BusinessAnalyticsGroundingPayload['window'],
    analysisDepth: BusinessInsightAnalysisDepth,
    selectedSections: InsightFocus[],
    sectionContexts: Record<string, Record<string, unknown>>,
  ): string {
    const canonical = {
      window,
      analysis_depth: analysisDepth,
      selected_sections: this.canonicalizeSelectedSections(selectedSections),
      section_contexts: sectionContexts,
    };
    return createHash('sha256')
      .update(this.stableStringify(canonical))
      .digest('hex');
  }

  canonicalizeSelectedSections(selectedSections: InsightFocus[]): InsightFocus[] {
    return BusinessInsightSnapshotService.canonicalizeSelectedSections(
      selectedSections,
    );
  }

  private static canonicalizeSelectedSections(
    selectedSections: InsightFocus[],
  ): InsightFocus[] {
    const selected = new Set(selectedSections);
    return BUSINESS_INSIGHT_FOCUS_ORDER.filter((section) =>
      selected.has(section),
    );
  }

  private static projectSectionContexts(
    grounding: BusinessAnalyticsGroundingPayload,
    selectedSections: InsightFocus[],
  ): Record<string, Record<string, unknown>> {
    const sectionContexts: Record<string, Record<string, unknown>> = {};
    for (const section of this.canonicalizeSelectedSections(selectedSections)) {
      switch (section) {
        case InsightFocus.overview:
          sectionContexts[section] = {
            window: grounding.window,
            overview: grounding.overview,
            comparisons: grounding.comparisons,
            derived_signals: grounding.derived_signals,
          };
          break;
        case InsightFocus.revenue:
          sectionContexts[section] = {
            window: grounding.window,
            revenue: grounding.revenue,
            comparisons: {
              total_revenue: grounding.comparisons.total_revenue,
            },
            derived_signals: {
              revenue_mix_percentages:
                grounding.derived_signals.revenue_mix_percentages,
              top_revenue_source_concentration:
                grounding.derived_signals.top_revenue_source_concentration,
            },
          };
          break;
        case InsightFocus.attendance:
          sectionContexts[section] = {
            window: grounding.window,
            attendance: grounding.attendance,
            comparisons: {
              check_ins: grounding.comparisons.check_ins,
            },
            derived_signals: {
              peak_hour_attendance_concentration:
                grounding.derived_signals.peak_hour_attendance_concentration,
            },
          };
          break;
        case InsightFocus.membership:
          sectionContexts[section] = {
            window: grounding.window,
            membership: grounding.membership,
            comparisons: {
              new_members: grounding.comparisons.new_members,
            },
          };
          break;
        case InsightFocus.coaching:
          sectionContexts[section] = {
            window: grounding.window,
            coaching: grounding.coaching,
            comparisons: {
              completed_coaching_sessions:
                grounding.comparisons.completed_coaching_sessions,
            },
          };
          break;
        case InsightFocus.inventory:
          sectionContexts[section] = {
            window: grounding.window,
            inventory: grounding.inventory ?? null,
            derived_signals: {
              equipment_availability_percentage:
                grounding.derived_signals.equipment_availability_percentage,
              low_stock_exposure_percentage:
                grounding.derived_signals.low_stock_exposure_percentage,
              out_of_stock_exposure_percentage:
                grounding.derived_signals.out_of_stock_exposure_percentage,
            },
          };
          break;
      }
    }
    return sectionContexts;
  }

  private static toAnalysisDepth(value: unknown): BusinessInsightAnalysisDepth {
    return BUSINESS_INSIGHT_ANALYSIS_DEPTHS.includes(
      value as BusinessInsightAnalysisDepth,
    )
      ? value as BusinessInsightAnalysisDepth
      : 'brief';
  }

  private static toRecord(value: unknown): Record<string, unknown> {
    return value !== null && typeof value === 'object' && !Array.isArray(value)
      ? value as Record<string, unknown>
      : {};
  }

  private static stableStringify(value: unknown): string {
    if (Array.isArray(value)) {
      return '[' + value.map((item) => this.stableStringify(item)).join(',') + ']';
    }
    if (value !== null && typeof value === 'object') {
      const record = value as Record<string, unknown>;
      return (
        '{' +
        Object.keys(record)
          .sort()
          .map(
            (key) =>
              JSON.stringify(key) +
              ':' +
              this.stableStringify(record[key]),
          )
          .join(',') +
        '}'
      );
    }
    return JSON.stringify(value) ?? 'null';
  }
}
