import type {
  AnalyticsAttendancePeakHourRecord,
  AnalyticsAttendanceRecord,
  AnalyticsCoachesRecord,
  AnalyticsDailyInsightsRecord,
  AnalyticsPdfExportResult,
  AnalyticsMembersRecord,
  AnalyticsOverviewRecord,
  AnalyticsPaginatedResult,
  AnalyticsPerformanceKpisRecord,
  AnalyticsPeriod,
  AnalyticsQueryParams,
  AnalyticsRecentActivityRecord,
  AnalyticsRevenueRecord,
  AnalyticsRevenueTotalsRecord,
  AnalyticsSnapshotRecord,
  AnalyticsSystemAlertRecord,
  AnalyticsTopRevenueSourceRecord,
  BusinessInsightAnalysisDepth,
  BusinessInsightAnalyticsSnapshot,
  BusinessInsightCompatibilityInput,
  BusinessInsightCompatibilityResult,
  BusinessInsightFocus,
  BusinessInsightHistoryParams,
  BusinessInsightPeriod,
  BusinessInsightSectionAnalyses,
  BusinessInsightSectionContexts,
  BusinessInsightRunDetailRecord,
  BusinessInsightRunSummaryRecord,
  ExportAnalyticsPdfInput,
  ExportBusinessInsightPdfInput,
  GenerateBusinessInsightInput,
} from "@fittrack/types";
import {
  BUSINESS_INSIGHT_ANALYSIS_DEPTHS,
  BUSINESS_INSIGHT_FOCUS_ORDER,
} from "@fittrack/types";
import { unwrapPaginatedResponse, unwrapResponse } from "../request";
import type { ApiTransport } from "../transport/createAxiosTransport";
import { toApiClientError } from "../errors/api-client-error";

export type {
  AnalyticsAttendancePeakHourRecord,
  AnalyticsAttendanceRecord,
  AnalyticsCoachesRecord,
  AnalyticsDailyInsightsRecord,
  AnalyticsPdfExportResult,
  AnalyticsMembersRecord,
  AnalyticsOverviewRecord,
  AnalyticsPaginatedResult,
  AnalyticsPerformanceKpisRecord,
  AnalyticsPeriod,
  AnalyticsQueryParams,
  AnalyticsRecentActivityRecord,
  AnalyticsRevenueRecord,
  AnalyticsRevenueTotalsRecord,
  AnalyticsSnapshotRecord,
  AnalyticsSystemAlertRecord,
  AnalyticsTopRevenueSourceRecord,
  BusinessInsightAnalysisDepth,
  BusinessInsightAnalyticsSnapshot,
  BusinessInsightCompatibilityInput,
  BusinessInsightCompatibilityResult,
  BusinessInsightFocus,
  BusinessInsightHistoryParams,
  BusinessInsightPeriod,
  BusinessInsightSectionAnalyses,
  BusinessInsightSectionContexts,
  BusinessInsightRunDetailRecord,
  BusinessInsightRunSummaryRecord,
  ExportAnalyticsPdfInput,
  ExportBusinessInsightPdfInput,
  GenerateBusinessInsightInput,
} from "@fittrack/types";

type AnalyticsRevenueTotalsApiRecord = {
  booking_revenue: string | number;
  cash_membership_revenue?: string | number | null;
  coaching_gym_revenue: string | number;
  coaching_payments_collected: string | number;
  gym_membership_revenue?: string | number | null;
  membership_card_revenue?: string | number | null;
  membership_revenue: string | number;
  paymongo_membership_revenue?: string | number | null;
  product_revenue: string | number;
  total_revenue: string | number;
};

type AnalyticsRevenueSeriesPointApiRecord = AnalyticsRevenueTotalsApiRecord & {
  bucket_start: string;
};

type AnalyticsAttendanceSeriesPointApiRecord = {
  bucket_start: string;
  check_ins: number;
};

type AnalyticsAttendancePeakHourApiRecord = {
  hour_label: string;
  check_ins: number;
};

type AnalyticsTopRevenueSourceApiRecord = {
  revenue: string | number;
  share_percentage: number;
  source_key: string;
  source_label: string;
};

type AnalyticsOverviewApiRecord = {
  completed_coaching_sessions: number;
  end_date: string;
  new_members: number;
  revenue: AnalyticsRevenueTotalsApiRecord;
  start_date: string;
  total_check_ins: number;
};

type AnalyticsRevenueApiRecord = {
  end_date: string;
  period: AnalyticsPeriod;
  series: AnalyticsRevenueSeriesPointApiRecord[];
  start_date: string;
  totals: AnalyticsRevenueTotalsApiRecord;
  top_revenue_sources: AnalyticsTopRevenueSourceApiRecord[];
};

type AnalyticsAttendanceApiRecord = {
  end_date: string;
  peak_hours: AnalyticsAttendancePeakHourApiRecord[];
  period: AnalyticsPeriod;
  series: AnalyticsAttendanceSeriesPointApiRecord[];
  start_date: string;
  total_check_ins: number;
};

type AnalyticsMembersApiRecord = {
  active_members: number;
  end_date: string;
  new_members: number;
  start_date: string;
};

type AnalyticsCoachBreakdownApiRecord = {
  coach_id: string;
  coach_payout: string | number;
  completed_sessions: number;
  first_name: string | null;
  gym_cut: string | number;
  last_name: string | null;
  total_billed: string | number;
};

type AnalyticsCoachesApiRecord = {
  coaches: AnalyticsCoachBreakdownApiRecord[];
  end_date: string;
  start_date: string;
};

type AnalyticsDailyInsightsApiRecord = {
  active_members: number;
  recent_activities: number;
  sessions_today: number;
};

type AnalyticsPerformanceKpisApiRecord = {
  active_members?: number;
  app_feedback_submissions?: number;
  check_ins: number;
  coach_satisfaction_rating?: number;
  coaching_sessions: number;
  new_members: number;
  session_completion_rate?: number;
  total_coaching_appointments: number;
  total_revenue: string | number;
  total_venue_bookings: number;
  venue_feedback_rating?: number;
};

type AnalyticsSystemAlertApiRecord = {
  action_label: string;
  body: string;
  href: string;
  id: string;
  kind: string;
  severity: string;
  title: string;
};

type AnalyticsRecentActivityApiRecord = {
  actor_name: string;
  description: string;
  entity_id: string;
  entity_label: string;
  id: string;
  kind: string;
  occurred_at: string;
  status: string;
  title: string;
};

type AnalyticsSnapshotApiRecord = {
  daily_insights: AnalyticsDailyInsightsApiRecord;
  generated_at: string;
  performance_kpis: AnalyticsPerformanceKpisApiRecord;
  recent_activities: AnalyticsRecentActivityApiRecord[];
  system_alerts: AnalyticsSystemAlertApiRecord[];
};

type BusinessInsightRequesterProfileApiRecord = {
  first_name: string | null;
  last_name: string | null;
};

type BusinessInsightRequesterApiRecord = {
  id: string;
  profile: BusinessInsightRequesterProfileApiRecord | null;
  role: string;
  status: string;
};

type BusinessInsightRunSummaryApiRecord = {
  analysisDepth?: string | null;
  analysis_depth?: string | null;
  created_at: string;
  dataFingerprint?: string | null;
  data_fingerprint?: string | null;
  end_date: string;
  focus: BusinessInsightFocus;
  id: string;
  latency_ms: number | null;
  model_used: string | null;
  period: BusinessInsightPeriod;
  requested_by: string | null;
  requester: BusinessInsightRequesterApiRecord | null;
  selectedSections?: string[] | null;
  selected_sections?: string[] | null;
  start_date: string;
  summary: string;
  token_count: number | null;
};

type BusinessInsightRunDetailApiRecord = BusinessInsightRunSummaryApiRecord & {
  analyticsSnapshot?: Record<string, unknown> | null;
  analytics_snapshot?: Record<string, unknown> | null;
  anomaly_flags?: string[] | null;
  failedSections?: string[] | null;
  failed_sections?: string[] | null;
  highlights?: string[] | null;
  opportunities?: string[] | null;
  recommendedActions?: string[] | null;
  recommended_actions?: string[] | null;
  risks?: string[] | null;
  sectionAnalyses?: Record<string, unknown> | null;
  sectionContexts?: Record<string, unknown> | null;
  section_analyses?: Record<string, unknown> | null;
  section_contexts?: Record<string, unknown> | null;
};

type BusinessInsightCompatibilityApiRecord = {
  compatible: boolean;
  currentFingerprint?: string;
  current_fingerprint?: string;
  insightFingerprint?: string;
  insight_fingerprint?: string;
  reason: string;
};

function toNumber(value: string | number | null | undefined) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function mapRevenueTotals(
  record: AnalyticsRevenueTotalsApiRecord,
): AnalyticsRevenueTotalsRecord {
  return {
    bookingRevenue: toNumber(record.booking_revenue),
    cashMembershipRevenue: toNumber(record.cash_membership_revenue),
    coachingGymRevenue: toNumber(record.coaching_gym_revenue),
    coachingPaymentsCollected: toNumber(record.coaching_payments_collected),
    gymMembershipRevenue: toNumber(record.gym_membership_revenue),
    membershipCardRevenue: toNumber(record.membership_card_revenue),
    membershipRevenue: toNumber(record.membership_revenue),
    paymongoMembershipRevenue: toNumber(record.paymongo_membership_revenue),
    productRevenue: toNumber(record.product_revenue),
    totalRevenue: toNumber(record.total_revenue),
  };
}

function mapAttendancePeakHour(
  record: AnalyticsAttendancePeakHourApiRecord,
): AnalyticsAttendancePeakHourRecord {
  return {
    checkIns: record.check_ins,
    hourLabel: record.hour_label,
  };
}

function mapTopRevenueSource(
  record: AnalyticsTopRevenueSourceApiRecord,
): AnalyticsTopRevenueSourceRecord {
  return {
    revenue: toNumber(record.revenue),
    sharePercentage: record.share_percentage,
    sourceKey: record.source_key,
    sourceLabel: record.source_label,
  };
}

function mapOverview(
  record: AnalyticsOverviewApiRecord,
): AnalyticsOverviewRecord {
  return {
    completedCoachingSessions: record.completed_coaching_sessions,
    endDate: record.end_date,
    newMembers: record.new_members,
    revenue: mapRevenueTotals(record.revenue),
    startDate: record.start_date,
    totalCheckIns: record.total_check_ins,
  };
}

function mapRevenue(record: AnalyticsRevenueApiRecord): AnalyticsRevenueRecord {
  return {
    endDate: record.end_date,
    period: record.period,
    series: record.series.map((point) => ({
      bucketStart: point.bucket_start,
      ...mapRevenueTotals(point),
    })),
    startDate: record.start_date,
    totals: mapRevenueTotals(record.totals),
    topRevenueSources: record.top_revenue_sources.map(mapTopRevenueSource),
  };
}

function mapAttendance(
  record: AnalyticsAttendanceApiRecord,
): AnalyticsAttendanceRecord {
  return {
    endDate: record.end_date,
    peakHours: record.peak_hours.map(mapAttendancePeakHour),
    period: record.period,
    series: record.series.map((point) => ({
      bucketStart: point.bucket_start,
      checkIns: point.check_ins,
    })),
    startDate: record.start_date,
    totalCheckIns: record.total_check_ins,
  };
}

function mapMembers(record: AnalyticsMembersApiRecord): AnalyticsMembersRecord {
  return {
    activeMembers: record.active_members,
    endDate: record.end_date,
    newMembers: record.new_members,
    startDate: record.start_date,
  };
}

function mapCoaches(record: AnalyticsCoachesApiRecord): AnalyticsCoachesRecord {
  return {
    coaches: record.coaches.map((coach) => ({
      coachId: coach.coach_id,
      coachPayout: toNumber(coach.coach_payout),
      completedSessions: coach.completed_sessions,
      firstName: coach.first_name,
      gymCut: toNumber(coach.gym_cut),
      lastName: coach.last_name,
      totalBilled: toNumber(coach.total_billed),
    })),
    endDate: record.end_date,
    startDate: record.start_date,
  };
}

function mapDailyInsights(
  record: AnalyticsDailyInsightsApiRecord,
): AnalyticsDailyInsightsRecord {
  return {
    activeMembers: record.active_members,
    recentActivities: record.recent_activities,
    sessionsToday: record.sessions_today,
  };
}

function mapPerformanceKpis(
  record: AnalyticsPerformanceKpisApiRecord,
): AnalyticsPerformanceKpisRecord {
  return {
    activeMembers: record.active_members ?? 0,
    appFeedbackSubmissions: record.app_feedback_submissions ?? 0,
    checkIns: record.check_ins,
    coachSatisfactionRating: record.coach_satisfaction_rating ?? 0,
    coachingSessions: record.coaching_sessions,
    newMembers: record.new_members,
    sessionCompletionRate: record.session_completion_rate ?? 0,
    totalCoachingAppointments: record.total_coaching_appointments,
    totalRevenue: toNumber(record.total_revenue),
    totalVenueBookings: record.total_venue_bookings,
    venueFeedbackRating: record.venue_feedback_rating ?? 0,
  };
}

function mapSystemAlert(
  record: AnalyticsSystemAlertApiRecord,
): AnalyticsSystemAlertRecord {
  return {
    actionLabel: record.action_label,
    body: record.body,
    href: record.href,
    id: record.id,
    kind: record.kind,
    severity: record.severity,
    title: record.title,
  };
}

function mapRecentActivity(
  record: AnalyticsRecentActivityApiRecord,
): AnalyticsRecentActivityRecord {
  return {
    actorName: record.actor_name,
    description: record.description,
    entityId: record.entity_id,
    entityLabel: record.entity_label,
    id: record.id,
    kind: record.kind,
    occurredAt: record.occurred_at,
    status: record.status,
    title: record.title,
  };
}

function mapSnapshot(
  record: AnalyticsSnapshotApiRecord,
): AnalyticsSnapshotRecord {
  return {
    dailyInsights: mapDailyInsights(record.daily_insights),
    generatedAt: record.generated_at,
    performanceKpis: mapPerformanceKpis(record.performance_kpis),
    recentActivities: record.recent_activities.map(mapRecentActivity),
    systemAlerts: record.system_alerts.map(mapSystemAlert),
  };
}

function mapInsightSummary(
  record: BusinessInsightRunSummaryApiRecord,
): BusinessInsightRunSummaryRecord {
  const selectedSections = toInsightFocusArray(
    record.selected_sections ?? record.selectedSections,
  );
  return {
    analysisDepth: toAnalysisDepth(
      record.analysis_depth ?? record.analysisDepth,
    ),
    createdAt: record.created_at,
    dataFingerprint:
      typeof (record.data_fingerprint ?? record.dataFingerprint) === "string"
        ? (record.data_fingerprint ?? record.dataFingerprint)!
        : "",
    endDate: record.end_date,
    focus: record.focus,
    id: record.id,
    latencyMs: record.latency_ms,
    modelUsed: record.model_used,
    period: record.period,
    requestedBy: record.requested_by,
    requester: record.requester
      ? {
          id: record.requester.id,
          profile: record.requester.profile
            ? {
                firstName: record.requester.profile.first_name,
                lastName: record.requester.profile.last_name,
              }
            : null,
          role: record.requester.role,
          status: record.requester.status,
        }
      : null,
    selectedSections:
      selectedSections.length > 0 ? selectedSections : [record.focus],
    startDate: record.start_date,
    summary: record.summary,
    tokenCount: record.token_count,
  };
}

function mapInsightDetail(
  record: BusinessInsightRunDetailApiRecord,
): BusinessInsightRunDetailRecord {
  return {
    ...mapInsightSummary(record),
    analyticsSnapshot: toSnapshotRecord(
      record.analytics_snapshot ?? record.analyticsSnapshot,
    ),
    anomalyFlags: toStringArray(record.anomaly_flags),
    failedSections: toInsightFocusArray(
      record.failed_sections ?? record.failedSections,
    ),
    highlights: toStringArray(record.highlights),
    opportunities: toStringArray(record.opportunities),
    recommendedActions: toStringArray(
      record.recommended_actions ?? record.recommendedActions,
    ),
    risks: toStringArray(record.risks),
    sectionAnalyses: mapSectionAnalyses(
      record.section_analyses ?? record.sectionAnalyses,
    ),
    sectionContexts: mapSectionContexts(
      record.section_contexts ?? record.sectionContexts,
    ),
  };
}

function toInsightFocusArray(value: unknown): BusinessInsightFocus[] {
  if (!Array.isArray(value)) return [];
  const values = new Set(value.filter((item): item is string => typeof item === "string"));
  return BUSINESS_INSIGHT_FOCUS_ORDER.filter((focus) => values.has(focus));
}

function toAnalysisDepth(value: unknown): BusinessInsightAnalysisDepth {
  return BUSINESS_INSIGHT_ANALYSIS_DEPTHS.includes(
    value as BusinessInsightAnalysisDepth,
  )
    ? (value as BusinessInsightAnalysisDepth)
    : "brief";
}

function toRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function toSnapshotRecord(
  value: unknown,
): BusinessInsightAnalyticsSnapshot | null {
  return toRecord(value);
}

function mapSectionContexts(value: unknown): BusinessInsightSectionContexts {
  const record = toRecord(value);
  if (!record) return {};
  const contexts: BusinessInsightSectionContexts = {};
  for (const focus of BUSINESS_INSIGHT_FOCUS_ORDER) {
    const context = toRecord(record[focus]);
    if (context) contexts[focus] = context;
  }
  return contexts;
}

function mapSectionAnalyses(value: unknown): BusinessInsightSectionAnalyses {
  const record = toRecord(value);
  if (!record) return {};
  const analyses: BusinessInsightSectionAnalyses = {};
  for (const focus of BUSINESS_INSIGHT_FOCUS_ORDER) {
    const analysis = toRecord(record[focus]);
    if (!analysis) continue;
    analyses[focus] = {
      anomalyFlags: toStringArray(
        analysis.anomaly_flags ?? analysis.anomalyFlags,
      ),
      highlights: toStringArray(analysis.highlights),
      modelUsed:
        typeof (analysis.model_used ?? analysis.modelUsed) === "string" ||
        (analysis.model_used ?? analysis.modelUsed) === null
          ? ((analysis.model_used ?? analysis.modelUsed) as string | null | undefined)
          : null,
      opportunities: toStringArray(analysis.opportunities),
      recommendedActions: toStringArray(
        analysis.recommended_actions ?? analysis.recommendedActions,
      ),
      risks: toStringArray(analysis.risks),
      summary:
        typeof analysis.summary === "string" ? analysis.summary : "",
      tokenCount:
        typeof (analysis.token_count ?? analysis.tokenCount) === "number"
          ? ((analysis.token_count ?? analysis.tokenCount) as number)
          : null,
    };
  }
  return analyses;
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is string | number => {
      return typeof item === "string" || typeof item === "number";
    })
    .map((item) => String(item).trim())
    .filter(Boolean);
}

function toAnalyticsQueryParams(params?: AnalyticsQueryParams) {
  return {
    ...(params?.startDate ? { start_date: params.startDate } : {}),
    ...(params?.endDate ? { end_date: params.endDate } : {}),
    ...(params?.period ? { period: params.period } : {}),
  };
}

function toInsightHistoryParams(params?: BusinessInsightHistoryParams) {
  return {
    ...(params?.page !== undefined ? { page: params.page } : {}),
    ...(params?.limit !== undefined ? { limit: params.limit } : {}),
    ...(params?.focus ? { focus: params.focus } : {}),
    ...(params?.period ? { period: params.period } : {}),
  };
}

function toGenerateInsightPayload(input: GenerateBusinessInsightInput) {
  return {
    ...(input.analysisDepth ? { analysis_depth: input.analysisDepth } : {}),
    ...(input.startDate ? { start_date: input.startDate } : {}),
    ...(input.endDate ? { end_date: input.endDate } : {}),
    ...(input.focus ? { focus: input.focus } : {}),
    ...(input.period ? { period: input.period } : {}),
    ...(input.selectedSections?.length
      ? { selected_sections: input.selectedSections }
      : {}),
  };
}

function toInsightCompatibilityPayload(
  input?: BusinessInsightCompatibilityInput,
) {
  return {
    ...(input?.startDate ? { start_date: input.startDate } : {}),
    ...(input?.endDate ? { end_date: input.endDate } : {}),
    ...(input?.period ? { period: input.period } : {}),
  };
}

function mapInsightCompatibility(
  record: BusinessInsightCompatibilityApiRecord,
): BusinessInsightCompatibilityResult {
  return {
    compatible: record.compatible,
    currentFingerprint:
      record.current_fingerprint ?? record.currentFingerprint ?? "",
    insightFingerprint:
      record.insight_fingerprint ?? record.insightFingerprint ?? "",
    reason: record.reason,
  };
}

function toExportPdfPayload(input?: ExportAnalyticsPdfInput) {
  return {
    ...(input?.insightId ? { insight_run_id: input.insightId } : {}),
    ...(input?.revenueStartDate
      ? { revenue_start_date: input.revenueStartDate }
      : {}),
    ...(input?.revenueEndDate
      ? { revenue_end_date: input.revenueEndDate }
      : {}),
    ...(input?.revenuePeriod ? { revenue_period: input.revenuePeriod } : {}),
    ...(input?.attendanceStartDate
      ? { attendance_start_date: input.attendanceStartDate }
      : {}),
    ...(input?.attendanceEndDate
      ? { attendance_end_date: input.attendanceEndDate }
      : {}),
    ...(input?.attendancePeriod
      ? { attendance_period: input.attendancePeriod }
      : {}),
    ...(input?.selectedSections?.length
      ? { selected_sections: input.selectedSections }
      : {}),
  };
}

function toExportBusinessInsightPdfPayload(
  input: ExportBusinessInsightPdfInput,
) {
  return {
    ...(input.comparePrevious !== undefined
      ? { compare_previous: input.comparePrevious }
      : {}),
    ...(input.previousInsightId
      ? { previous_insight_run_id: input.previousInsightId }
      : {}),
  };
}

function extractAttachmentFileName(headerValue: string | undefined) {
  if (!headerValue) return null;
  const match = headerValue.match(/filename=\"?([^\";]+)\"?/i);
  return match?.[1] ?? null;
}

export function createAnalyticsApi(transport: ApiTransport) {
  return {
    async getSnapshot() {
      return mapSnapshot(
        await unwrapResponse<AnalyticsSnapshotApiRecord>(
          transport.get("/analytics/snapshot"),
          "Unable to load the analytics dashboard snapshot.",
        ),
      );
    },
    async getOverview(params?: AnalyticsQueryParams) {
      return mapOverview(
        await unwrapResponse<AnalyticsOverviewApiRecord>(
          transport.get("/analytics/overview", {
            params: toAnalyticsQueryParams(params),
          }),
          "Unable to load analytics overview.",
        ),
      );
    },
    async getRevenue(params?: AnalyticsQueryParams) {
      return mapRevenue(
        await unwrapResponse<AnalyticsRevenueApiRecord>(
          transport.get("/analytics/revenue", {
            params: toAnalyticsQueryParams(params),
          }),
          "Unable to load analytics revenue.",
        ),
      );
    },
    async getAttendance(params?: AnalyticsQueryParams) {
      return mapAttendance(
        await unwrapResponse<AnalyticsAttendanceApiRecord>(
          transport.get("/analytics/attendance", {
            params: toAnalyticsQueryParams(params),
          }),
          "Unable to load analytics attendance.",
        ),
      );
    },
    async getMembers(params?: AnalyticsQueryParams) {
      return mapMembers(
        await unwrapResponse<AnalyticsMembersApiRecord>(
          transport.get("/analytics/members", {
            params: toAnalyticsQueryParams(params),
          }),
          "Unable to load analytics member counts.",
        ),
      );
    },
    async getCoaches(params?: AnalyticsQueryParams) {
      return mapCoaches(
        await unwrapResponse<AnalyticsCoachesApiRecord>(
          transport.get("/analytics/coaches", {
            params: toAnalyticsQueryParams(params),
          }),
          "Unable to load analytics coaches.",
        ),
      );
    },
    async listInsights(
      params?: BusinessInsightHistoryParams,
    ): Promise<AnalyticsPaginatedResult<BusinessInsightRunSummaryRecord>> {
      const result =
        await unwrapPaginatedResponse<BusinessInsightRunSummaryApiRecord>(
          transport.get("/business-analytics/insights", {
            params: toInsightHistoryParams(params),
          }),
          "Unable to load analytics insights.",
        );
      return {
        ...result,
        data: result.data.map(mapInsightSummary),
      };
    },
    async getInsightById(insightId: string) {
      return mapInsightDetail(
        await unwrapResponse<BusinessInsightRunDetailApiRecord>(
          transport.get(`/business-analytics/insights/${insightId}`),
          "Unable to load analytics insight.",
        ),
      );
    },
    async checkInsightCompatibility(
      insightId: string,
      input?: BusinessInsightCompatibilityInput,
    ): Promise<BusinessInsightCompatibilityResult> {
      return mapInsightCompatibility(
        await unwrapResponse<BusinessInsightCompatibilityApiRecord>(
          transport.post(
            `/business-analytics/insights/${insightId}/compatibility`,
            toInsightCompatibilityPayload(input),
          ),
          "Unable to check analytics insight compatibility.",
        ),
      );
    },
    async generateInsight(input: GenerateBusinessInsightInput) {
      return mapInsightDetail(
        await unwrapResponse<BusinessInsightRunDetailApiRecord>(
          transport.post(
            "/business-analytics/insights",
            toGenerateInsightPayload(input),
          ),
          "Unable to generate analytics insight.",
        ),
      );
    },
    async exportPdf(
      input?: ExportAnalyticsPdfInput,
    ): Promise<AnalyticsPdfExportResult> {
      try {
        const response = await transport.post<ArrayBuffer>(
          "/analytics/export/pdf",
          toExportPdfPayload(input),
          {
            responseType: "arraybuffer",
          },
        );
        return {
          bytes: response.data,
          contentType:
            (typeof response.headers["content-type"] === "string"
              ? response.headers["content-type"]
              : "application/pdf") ?? "application/pdf",
          fileName:
            extractAttachmentFileName(
              typeof response.headers["content-disposition"] === "string"
                ? response.headers["content-disposition"]
                : undefined,
            ) ?? "fittrack-analytics-export.pdf",
        };
      } catch (error: unknown) {
        throw toApiClientError(error, "Unable to export the analytics PDF.");
      }
    },
    async exportInsightPdf(
      insightId: string,
      input?: ExportBusinessInsightPdfInput,
    ): Promise<AnalyticsPdfExportResult> {
      try {
        const path = `/business-analytics/insights/${insightId}/export/pdf`;
        const response = input
          ? await transport.post<ArrayBuffer>(
              path,
              toExportBusinessInsightPdfPayload(input),
              { responseType: "arraybuffer" },
            )
          : await transport.get<ArrayBuffer>(path, {
              responseType: "arraybuffer",
            });
        return {
          bytes: response.data,
          contentType:
            typeof response.headers["content-type"] === "string"
              ? response.headers["content-type"]
              : "application/pdf",
          fileName:
            extractAttachmentFileName(
              typeof response.headers["content-disposition"] === "string"
                ? response.headers["content-disposition"]
                : undefined,
            ) ?? "fittrack-business-insight-export.pdf",
        };
      } catch (error: unknown) {
        throw toApiClientError(
          error,
          "Unable to export the saved analytics insight PDF.",
        );
      }
    },
  };
}
