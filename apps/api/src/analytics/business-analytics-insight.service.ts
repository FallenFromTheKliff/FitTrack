import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';

import {
  AiPythonClientService,
  type BusinessAnalyticsInsightResponse,
} from '../ai/ai-python-client.service';
import type { PaginatedResult } from '../common/base-repository/base-repository';
import { AnalyticsService } from './analytics.service';
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
    const insightPayload =
      await this.aiPythonClientService.generateBusinessInsight(requestPayload);
    const latencyMs = Date.now() - startedAt;
    const record = await this.insightRunRepository.createInsightRun({
      requestedBy: actorId,
      requestPayload,
      insightPayload,
      latencyMs,
    });

    return this.toDetailResponse(record);
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

  private toDateOnlyString(value: Date): string {
    return value.toISOString().slice(0, 10);
  }
}
