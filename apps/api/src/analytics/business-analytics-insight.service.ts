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
    const payload = this.toJsonObject(value);

    return {
      summary: this.toStringValue(
        payload.summary,
        'No insight summary recorded.',
      ),
      highlights: this.toStringArray(payload.highlights),
      risks: this.toStringArray(payload.risks),
      opportunities: this.toStringArray(payload.opportunities),
      anomaly_flags: this.toStringArray(payload.anomaly_flags),
      recommended_actions: this.toStringArray(
        payload.recommended_actions ?? payload.recommendedActions,
      ),
      model_used: this.toNullableString(payload.model_used),
      token_count: this.toNullableNumber(payload.token_count),
    };
  }

  private toJsonObject(value: Prisma.JsonValue): Record<string, unknown> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return {};
    }

    return value as Record<string, unknown>;
  }

  private toStringArray(value: unknown): string[] {
    if (!Array.isArray(value)) {
      return [];
    }

    return value
      .filter((item): item is string | number => {
        return typeof item === 'string' || typeof item === 'number';
      })
      .map((item) => String(item).trim())
      .filter(Boolean);
  }

  private toStringValue(value: unknown, fallback: string): string {
    return typeof value === 'string' && value.trim().length > 0
      ? value
      : fallback;
  }

  private toNullableString(value: unknown): string | null {
    return typeof value === 'string' && value.trim().length > 0 ? value : null;
  }

  private toNullableNumber(value: unknown): number | null {
    return typeof value === 'number' && Number.isFinite(value) ? value : null;
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
    const totalRevenueLabel = this.formatMoney(
      grounding.overview.total_revenue,
    );
    const anomalyFlags = this.detectGroundingAnomalies(grounding);
    const topPlan = grounding.membership.top_plans[0] ?? null;
    const topCoach = grounding.coaching.coaches[0] ?? null;
    const topProduct = grounding.inventory?.top_products[0] ?? null;
    const inventory = grounding.inventory ?? null;
    const peakHour = grounding.attendance.peak_hours[0] ?? null;

    const highlights = [
      `Fallback insight: ${grounding.window.period} revenue reached ${totalRevenueLabel}.`,
      `Attendance recorded ${grounding.overview.total_check_ins} check-ins across ${grounding.membership.active_members} active members.`,
      ...(topPlan
        ? [
            `Top membership plan is ${topPlan.name} with ${topPlan.subscriber_count} subscribers.`,
          ]
        : []),
      ...(inventory
        ? [
            `${inventory.low_stock_items} low-stock retail items are live, with ${inventory.equipment_under_maintenance} equipment type(s) under maintenance.`,
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
      ...(inventory && inventory.low_stock_items > 0
        ? [
            `Use the live inventory lane to restock ${inventory.low_stock_items} retail item(s) before they suppress on-site sales.`,
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
      ...(inventory && inventory.equipment_under_maintenance > 0
        ? [
            `Resolve ${inventory.equipment_under_maintenance} maintenance queue item(s) before equipment downtime affects attendance.`,
          ]
        : []),
    ];

    return {
      summary:
        `Fallback insight: revenue is ${totalRevenueLabel}, ` +
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

    if (
      grounding.inventory &&
      grounding.inventory.retail_items > 0 &&
      this.toMoneyNumber(grounding.inventory.retail_inventory_value) === 0
    ) {
      anomalies.push(
        'Inventory items exist, but the recorded retail inventory value is zero.',
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

  private formatMoney(value: string): string {
    return `₱${this.toMoneyNumber(value).toLocaleString('en-PH', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }

  private toDateOnlyString(value: Date): string {
    return value.toISOString().slice(0, 10);
  }
}
