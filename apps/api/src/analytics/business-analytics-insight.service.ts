import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';

import {
  AiPythonClientService,
  type BusinessAnalyticsInsightResponse,
} from '../ai/ai-python-client.service';
import type { PaginatedResult } from '../common/base-repository/base-repository';
import { AnalyticsService } from './analytics.service';
import type { BusinessAnalyticsGroundingPayload } from './analytics.types';
import {
  BusinessInsightRunRepository,
  type BusinessInsightRunRecord,
  type BusinessInsightRunRequester,
} from './business-insight-run.repository';
import {
  BusinessInsightFilterDTO,
  BusinessInsightRequesterResponseDTO,
  BusinessInsightRunDetailResponseDTO,
  BusinessInsightRunSummaryResponseDTO,
  GenerateBusinessInsightDTO,
} from './dto/business-analytics-insight.dto';

@Injectable()
export class BusinessAnalyticsInsightService {
  constructor(
    private readonly analyticsService: AnalyticsService,
    private readonly aiPythonClientService: AiPythonClientService,
    private readonly insightRunRepository: BusinessInsightRunRepository,
  ) {}

  async generateInsight(
    actorId: string,
    dto: GenerateBusinessInsightDTO,
  ): Promise<BusinessInsightRunDetailResponseDTO> {
    const grounding =
      await this.analyticsService.buildBusinessInsightGroundingPayload(dto);
    const requestPayload = {
      grounding,
    };
    const startedAt = Date.now();
    const insightPayload = await this.generateInsightPayload(requestPayload);
    const latencyMs = Date.now() - startedAt;
    const record = await this.insightRunRepository.createInsightRun({
      requestedBy: actorId,
      requestPayload,
      insightPayload,
      latencyMs,
    });

    return this.toDetailResponse(record);
  }

  async generateTransientInsight(
    dto: GenerateBusinessInsightDTO,
  ): Promise<BusinessAnalyticsInsightResponse> {
    const grounding =
      await this.analyticsService.buildBusinessInsightGroundingPayload(dto);

    return this.generateInsightPayload({
      grounding,
    });
  }

  async getInsightHistory(
    dto: BusinessInsightFilterDTO,
  ): Promise<PaginatedResult<BusinessInsightRunSummaryResponseDTO>> {
    const result = await this.insightRunRepository.listInsightRuns(dto);

    return {
      data: result.data.map((record) => this.toSummaryResponse(record)),
      meta: result.meta,
    };
  }

  async getInsightById(
    id: string,
  ): Promise<BusinessInsightRunDetailResponseDTO> {
    const record =
      await this.insightRunRepository.findInsightRunByIdOrThrow(id);

    return this.toDetailResponse(record);
  }

  private toSummaryResponse(
    record: BusinessInsightRunRecord,
  ): BusinessInsightRunSummaryResponseDTO {
    const insightPayload = this.toInsightPayload(record.insight_payload);

    return {
      id: record.id,
      requested_by: record.requested_by,
      requester: record.requester
        ? this.toRequesterResponse(record.requester)
        : null,
      focus: record.focus,
      period: record.period,
      start_date: this.toDateOnlyString(record.start_date),
      end_date: this.toDateOnlyString(record.end_date),
      summary: insightPayload.summary,
      model_used: record.model_used,
      token_count: record.token_count,
      latency_ms: record.latency_ms,
      created_at: record.created_at.toISOString(),
    };
  }

  private toDetailResponse(
    record: BusinessInsightRunRecord,
  ): BusinessInsightRunDetailResponseDTO {
    const insightPayload = this.toInsightPayload(record.insight_payload);

    return {
      ...this.toSummaryResponse(record),
      highlights: insightPayload.highlights,
      risks: insightPayload.risks,
      opportunities: insightPayload.opportunities,
      anomaly_flags: insightPayload.anomaly_flags,
      recommended_actions: insightPayload.recommended_actions,
    };
  }

  private toRequesterResponse(
    requester: BusinessInsightRunRequester,
  ): BusinessInsightRequesterResponseDTO {
    return {
      id: requester.id,
      role: requester.role,
      status: requester.status,
      profile: requester.profile
        ? {
            first_name: requester.profile.first_name,
            last_name: requester.profile.last_name,
          }
        : null,
    };
  }

  private toInsightPayload(
    value: Prisma.JsonValue,
  ): BusinessAnalyticsInsightResponse {
    return value as BusinessAnalyticsInsightResponse;
  }

  private async generateInsightPayload(input: {
    grounding: BusinessAnalyticsGroundingPayload;
  }): Promise<BusinessAnalyticsInsightResponse> {
    try {
      return await this.aiPythonClientService.generateBusinessInsight(input);
    } catch {
      return this.buildGroundedFallbackInsight(input.grounding);
    }
  }

  private buildGroundedFallbackInsight(
    grounding: BusinessAnalyticsGroundingPayload,
  ): BusinessAnalyticsInsightResponse {
    const totalRevenue = this.toMoneyNumber(grounding.overview.total_revenue);
    const anomalyFlags = this.detectGroundingAnomalies(grounding);
    const topPlan = grounding.membership.top_plans[0] ?? null;
    const topCoach = grounding.coaching.coaches[0] ?? null;
    const topProduct = grounding.inventory?.top_products[0] ?? null;
    const peakHour = grounding.attendance.peak_hours[0] ?? null;

    const highlights = [
      `Fallback insight: ${grounding.window.period} revenue reached ${grounding.overview.total_revenue}.`,
      `Attendance recorded ${grounding.overview.total_check_ins} check-ins across ${grounding.membership.active_members} active members.`,
      ...(topPlan
        ? [
            `Top membership plan is ${topPlan.name} with ${topPlan.subscriber_count} subscribers.`,
          ]
        : []),
    ];

    const risks = anomalyFlags.length
      ? [...anomalyFlags]
      : [
          'External AI insight generation is degraded, so this summary is rule-based.',
        ];

    if (peakHour && peakHour.check_ins > 0) {
      risks.push(
        `Traffic concentrates around ${peakHour.hour_label}, which can pressure staffing and equipment.`,
      );
    }

    const opportunities = [
      ...(topCoach
        ? [
            `Replicate ${this.toCoachName(topCoach)}'s session pattern across the coaching roster.`,
          ]
        : []),
      ...(topProduct
        ? [
            `Promote ${topProduct.name} during peak hours to lift secondary spend.`,
          ]
        : []),
      ...(topPlan
        ? [
            `Use ${topPlan.name} as the lead offer in upgrade and retention campaigns.`,
          ]
        : []),
    ];

    const recommendedActions = [
      ...(totalRevenue <= 0
        ? [
            'Audit payment capture before trusting revenue conclusions for this window.',
          ]
        : []),
      ...(grounding.overview.total_check_ins <= 0
        ? [
            'Inspect access-control and check-in capture because attendance is currently zero.',
          ]
        : []),
      ...(peakHour && peakHour.check_ins > 0
        ? [
            `Align staffing and retail prompts around the ${peakHour.hour_label} peak.`,
          ]
        : []),
      ...(topProduct
        ? [`Bundle ${topProduct.name} with memberships or coaching packages.`]
        : []),
    ];

    return {
      summary:
        `Fallback insight: revenue is ${grounding.overview.total_revenue}, ` +
        `attendance is ${grounding.overview.total_check_ins} check-ins, and ` +
        `active membership is ${grounding.membership.active_members} for the selected window.`,
      highlights: this.toUniqueStrings(highlights),
      risks: this.toUniqueStrings(risks),
      opportunities: this.toUniqueStrings(
        opportunities.length > 0
          ? opportunities
          : [
              'Review the live trends and regenerate once the AI provider stabilizes.',
            ],
      ),
      anomaly_flags: anomalyFlags,
      recommended_actions: this.toUniqueStrings(
        recommendedActions.length > 0
          ? recommendedActions
          : [
              'Review this grounded fallback insight and retry generation later.',
            ],
      ),
      model_used: 'grounded-fallback',
      token_count: null,
    };
  }

  private detectGroundingAnomalies(
    grounding: BusinessAnalyticsGroundingPayload,
  ): string[] {
    const anomalies: string[] = [];

    if (grounding.overview.total_check_ins === 0) {
      anomalies.push('No attendance was recorded for the selected window.');
    }

    if (
      this.toMoneyNumber(grounding.overview.total_revenue) === 0 &&
      grounding.membership.active_members > 0
    ) {
      anomalies.push(
        'Revenue is zero even though active members exist in the selected window.',
      );
    }

    if (
      grounding.attendance.peak_hours[0] &&
      grounding.attendance.peak_hours[0].check_ins === 0
    ) {
      anomalies.push(
        'Peak attendance hours were computed without recorded check-ins.',
      );
    }

    if (
      grounding.inventory?.top_products[0] &&
      grounding.inventory.top_products[0].quantity_sold === 0
    ) {
      anomalies.push(
        'Inventory sales data is present, but the top product has zero quantity sold.',
      );
    }

    return anomalies;
  }

  private toCoachName(
    coach: BusinessAnalyticsGroundingPayload['coaching']['coaches'][number],
  ): string {
    return (
      [coach.first_name, coach.last_name].filter(Boolean).join(' ') ||
      'the leading coach'
    );
  }

  private toUniqueStrings(values: string[]): string[] {
    return values.filter(
      (value, index) => value && values.indexOf(value) === index,
    );
  }

  private toMoneyNumber(value: string): number {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  private toDateOnlyString(value: Date): string {
    return value.toISOString().slice(0, 10);
  }
}
