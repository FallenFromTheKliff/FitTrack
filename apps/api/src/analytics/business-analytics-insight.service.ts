import { Injectable, Logger } from '@nestjs/common';
import type { Prisma } from '@prisma/client';

import {
  AiPythonClientService,
  type BusinessAnalyticsInsightResponse,
} from '../ai/ai-python-client.service';
import type { PaginatedResult } from '../common/base-repository/base-repository';
import { AnalyticsService } from './analytics.service';
import type {
  BusinessAnalyticsGroundingPayload,
  BusinessInsightComparison,
} from './analytics.types';
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
  private readonly logger = new Logger(BusinessAnalyticsInsightService.name);

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
        payload.summary ?? payload.executive_summary,
        'No insight summary recorded.',
        1200,
      ),
      highlights: this.toStringArray(payload.highlights, 5, 600),
      risks: this.toStringArray(payload.risks, 5, 600),
      opportunities: this.toStringArray(payload.opportunities, 5, 600),
      anomaly_flags: this.toStringArray(
        payload.anomaly_flags ?? payload.anomalyFlags,
        8,
        400,
      ),
      recommended_actions: this.toStringArray(
        payload.recommended_actions ??
          payload.recommendedActions ??
          payload.actions,
        3,
        400,
      ),
      model_used: this.toNullableString(payload.model_used),
      token_count: this.toNullableNumber(payload.token_count),
    };
  }

  private toJsonObject(value: unknown): Record<string, unknown> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return {};
    }

    return value as Record<string, unknown>;
  }

  private toStringArray(
    value: unknown,
    maxItems: number,
    maxLength: number,
  ): string[] {
    const values = Array.isArray(value) ? value : [value];
    const normalized = values
      .map((item) => {
        if (typeof item === 'string' || typeof item === 'number') {
          return this.normalizeInsightText(String(item), maxLength);
        }
        const record = this.toJsonObject(item);
        const text =
          record.text ?? record.content ?? record.description ?? record.action;
        return typeof text === 'string'
          ? this.normalizeInsightText(text, maxLength)
          : '';
      })
      .filter(Boolean);

    return [...new Set(normalized)].slice(0, maxItems);
  }

  private toStringValue(
    value: unknown,
    fallback: string,
    maxLength: number,
  ): string {
    const normalized =
      typeof value === 'string'
        ? this.normalizeInsightText(value, maxLength)
        : '';
    return normalized || fallback;
  }

  private normalizeInsightText(value: string, maxLength: number) {
    return value
      .replace(/[\u0000-\u001f\u007f]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, maxLength);
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
    } catch (error) {
      this.logger.warn(
        `AI business insight generation failed; using grounded fallback. ${this.formatError(error)}`,
      );
      return this.buildGroundedFallbackInsight(input.grounding);
    }
  }

  private formatError(error: unknown): string {
    if (error instanceof Error && error.message.trim()) {
      return error.message;
    }

    return String(error);
  }

  private buildGroundedFallbackInsight(
    grounding: BusinessAnalyticsGroundingPayload,
  ): BusinessAnalyticsInsightResponse {
    const anomalyFlags = this.detectGroundingAnomalies(grounding);
    const inventory = grounding.inventory ?? null;
    const { comparisons, derived_signals: signals } = grounding;
    const concentration = signals.top_revenue_source_concentration;
    const peak = signals.peak_hour_attendance_concentration;
    const revenueChange = this.formatComparison(
      'Revenue',
      comparisons.total_revenue,
      true,
    );
    const attendanceChange = this.formatComparison(
      'Check-ins',
      comparisons.check_ins,
    );
    const membershipChange = this.formatComparison(
      'New members',
      comparisons.new_members,
    );
    const coachingChange = this.formatComparison(
      'Completed coaching sessions',
      comparisons.completed_coaching_sessions,
    );
    const revenueImplication = concentration
      ? `${concentration.source_label} supplies ${concentration.percentage.toFixed(1)}% of revenue, so execution in that lane has an outsized effect`
      : 'no revenue source concentration is established, so the next move should restore completed revenue without assuming a leading lane';
    const attendanceImplication = peak
      ? `${peak.percentage.toFixed(1)}% of check-ins land at ${peak.hour_label}, so coverage should match that demand concentration`
      : 'no reliable peak-hour concentration exists, so staffing changes should remain bounded until demand timing is established';
    const inventoryEvidenceParts = [
      signals.equipment_availability_percentage === null
        ? null
        : `equipment availability is ${signals.equipment_availability_percentage.toFixed(1)}%`,
      signals.low_stock_exposure_percentage === null
        ? null
        : `low-stock exposure is ${signals.low_stock_exposure_percentage.toFixed(1)}%`,
      signals.out_of_stock_exposure_percentage === null
        ? null
        : `out-of-stock exposure is ${signals.out_of_stock_exposure_percentage.toFixed(1)}%`,
    ].filter((value): value is string => Boolean(value));
    const inventoryEvidence = inventoryEvidenceParts.length
      ? `Inventory exposure shows ${inventoryEvidenceParts.join(', ')}`
      : 'Inventory availability and stock exposure are unavailable because no reliable equipment or retail denominator exists';
    const inventoryImplication = inventoryEvidenceParts.length
      ? 'service continuity and retail conversion depend on resolving the measured availability gaps'
      : 'the next inventory decision must restore trustworthy denominators before allocation targets are set';

    const financeAction =
      comparisons.total_revenue.direction === 'decrease'
        ? 'Finance · next 3 business days — reconcile the declining revenue lanes and correct confirmed capture gaps. Success: 100% of the absolute revenue change is attributed to a source.'
        : 'Revenue lead · next 7 days — execute one source-specific conversion offer while protecting revenue mix. Success: total revenue improves in the next same-length window.';
    const attendanceAction = peak
      ? `Operations · next 7 days — align front-desk and floor coverage to the ${peak.hour_label} demand peak. Success: peak-hour member wait time stays under 3 minutes.`
      : 'Operations · next 7 days — assign coverage across operating hours and restore valid check-in capture. Success: every operating hour has assigned coverage and recorded demand.';
    const membershipAction =
      'Membership lead · next 7 days — complete a structured onboarding touchpoint for every new member in this window. Success: 100% of the cohort receives the touchpoint.';
    const coachingAction =
      'Coaching lead · next 7 days — match coach capacity and follow-on offers to completed-session demand. Success: every completed session receives a documented next-step offer.';
    const inventoryAction =
      inventory && inventory.out_of_stock_items > 0
        ? `Inventory lead · next 48 hours — replenish or substitute the ${inventory.out_of_stock_items} out-of-stock items. Success: out-of-stock exposure reaches 0%.`
        : signals.equipment_availability_percentage !== null &&
            signals.equipment_availability_percentage < 100
          ? 'Facilities lead · next 7 days — return serviceable equipment to the available pool. Success: equipment availability reaches 100%.'
          : inventoryEvidenceParts.length
            ? 'Inventory lead · next 7 days — protect current equipment and retail availability through scheduled replenishment. Success: out-of-stock exposure remains at 0%.'
            : 'Inventory lead · next 3 business days — restore equipment-unit and retail-item denominator capture. Success: availability and stock exposure are calculable.';
    const overviewAction =
      'General manager · next 7 days — sequence the revenue, attendance, membership, and coaching owners around the largest measured change. Success: one accountable owner and target are recorded for each declining lane.';

    let primaryEvidence: string;
    let implication: string;
    let primaryAction: string;
    let highlights: string[];
    let risks: string[];
    let opportunities: string[];
    let secondaryActions: string[];

    switch (grounding.window.focus) {
      case 'revenue':
        primaryEvidence = revenueChange;
        implication = revenueImplication;
        primaryAction = financeAction;
        highlights = [
          `${revenueChange}; ${revenueImplication}.`,
          concentration
            ? `${concentration.source_label} contributes ${concentration.percentage.toFixed(1)}% of revenue; source-level execution will materially affect the total.`
            : `${revenueChange}; a missing source concentration means recovery should avoid assuming which lane will lead.`,
        ];
        risks = [
          concentration && concentration.percentage >= 60
            ? `${concentration.source_label} represents ${concentration.percentage.toFixed(1)}% of revenue; the mix is exposed to disruption in one income stream.`
            : `${revenueChange}; failure to act on the measured movement would leave operating headroom exposed.`,
        ];
        opportunities = [
          `${revenueChange}; a source-specific conversion action can test whether the measured movement is reversible.`,
        ];
        secondaryActions = [];
        break;
      case 'attendance':
        primaryEvidence = attendanceChange;
        implication = attendanceImplication;
        primaryAction = attendanceAction;
        highlights = [
          `${attendanceChange}; ${attendanceImplication}.`,
          peak
            ? `${peak.check_ins} check-ins occurred at ${peak.hour_label}, or ${peak.percentage.toFixed(1)}% of the total; concentrating coverage there targets proven demand.`
            : `${attendanceChange}; absent peak evidence limits staffing changes to coverage and capture reliability.`,
        ];
        risks = [
          `${attendanceChange}; a mismatch between demand and floor coverage can weaken service quality.`,
        ];
        opportunities = [
          peak
            ? `${peak.percentage.toFixed(1)}% of attendance lands at ${peak.hour_label}; aligning service and offers there concentrates effort where demand is proven.`
            : `${attendanceChange}; restoring demand timing can unlock a defensible staffing allocation.`,
        ];
        secondaryActions = [];
        break;
      case 'membership':
        primaryEvidence = membershipChange;
        implication =
          'the measured cohort changes the immediate onboarding and early-retention workload';
        primaryAction = membershipAction;
        highlights = [
          `${membershipChange}; the cohort size determines how much onboarding capacity is needed now.`,
        ];
        risks = [
          `${membershipChange}; unowned onboarding would put the value of this measured cohort at risk.`,
        ];
        opportunities = [
          `${membershipChange}; a complete first-week touchpoint can convert the measured acquisition into early engagement.`,
        ];
        secondaryActions = [];
        break;
      case 'coaching':
        primaryEvidence = coachingChange;
        implication =
          'the session movement changes coach-capacity needs and the available follow-on pipeline';
        primaryAction = coachingAction;
        highlights = [
          `${coachingChange}; capacity and next-step offers should follow completed-session demand.`,
        ];
        risks = [
          `${coachingChange}; an unmatched coach roster can create either service pressure or idle capacity.`,
        ];
        opportunities = [
          `${coachingChange}; documented follow-on offers can turn completed sessions into a measurable continuation pipeline.`,
        ];
        secondaryActions = [];
        break;
      case 'inventory':
        primaryEvidence = inventoryEvidence;
        implication = inventoryImplication;
        primaryAction = inventoryAction;
        highlights = [`${inventoryEvidence}; ${inventoryImplication}.`];
        risks = [
          `${inventoryEvidence}; unresolved availability or denominator gaps can hide service and retail exposure.`,
        ];
        opportunities = [
          `${inventoryEvidence}; targeted replenishment or data repair can make the next allocation decision measurable.`,
        ];
        secondaryActions = [];
        break;
      default:
        primaryEvidence = `Cross-domain priority: ${revenueChange}, while ${attendanceChange.toLowerCase()}`;
        implication =
          'the operating response must balance financial movement with service demand and cohort workload';
        primaryAction = overviewAction;
        highlights = [
          `${primaryEvidence}; ${implication}.`,
          `${membershipChange}; onboarding ownership must scale with the measured cohort.`,
          `${coachingChange}; coach capacity and follow-on work should match completed demand.`,
        ];
        risks = [
          comparisons.total_revenue.direction === 'decrease'
            ? `${revenueChange}; continued contraction would reduce operating headroom.`
            : `${attendanceChange}; service capacity must remain aligned with measured demand.`,
        ];
        opportunities = [
          `${membershipChange}; focused onboarding can improve the value captured from the measured cohort.`,
        ];
        secondaryActions = [
          ...(comparisons.total_revenue.direction === 'decrease'
            ? [financeAction]
            : []),
          ...(peak ? [attendanceAction] : []),
        ];
        break;
    }

    const recommendedActions = this.toUniqueStrings([
      primaryAction,
      ...secondaryActions,
    ]).slice(0, 3);
    const nextAction = recommendedActions[0].split(' — ')[1];

    return {
      summary: `${primaryEvidence}. It matters because ${implication}. Next, ${nextAction}`,
      highlights: this.toUniqueStrings(highlights).slice(0, 5),
      risks: this.toUniqueStrings(risks),
      opportunities: this.toUniqueStrings(opportunities),
      anomaly_flags: anomalyFlags,
      recommended_actions: this.toUniqueStrings(recommendedActions).slice(0, 3),
      model_used: 'grounded-fallback',
      token_count: null,
    };
  }

  private formatComparison(
    label: string,
    comparison: BusinessInsightComparison<number | string>,
    money = false,
  ): string {
    const current = Number(comparison.current);
    const previous = Number(comparison.previous);
    const absolute = Number(comparison.absolute_change);
    const format = (value: number) =>
      money
        ? this.formatMoney(value.toFixed(2))
        : Math.round(value).toLocaleString('en-PH');
    if (comparison.direction === 'new_from_zero') {
      return `${label} established a new baseline at ${format(current)} after a zero prior period`;
    }
    if (comparison.direction === 'flat') {
      return `${label} held at ${format(current)} versus ${format(previous)} in the prior period`;
    }
    const verb =
      comparison.direction === 'increase' ? 'increased' : 'decreased';
    const percentage =
      comparison.percentage_change === null
        ? ''
        : ` (${Math.abs(comparison.percentage_change).toFixed(1)}%)`;
    return `${label} ${verb} by ${format(Math.abs(absolute))}${percentage}, from ${format(previous)} to ${format(current)}`;
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
