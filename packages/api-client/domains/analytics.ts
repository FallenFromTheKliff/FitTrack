import type {
  AnalyticsAttendanceRecord,
  AnalyticsCoachesRecord,
  AnalyticsMembersRecord,
  AnalyticsOverviewRecord,
  AnalyticsPaginatedResult,
  AnalyticsPeriod,
  AnalyticsQueryParams,
  AnalyticsRevenueRecord,
  AnalyticsRevenueTotalsRecord,
  BusinessInsightFocus,
  BusinessInsightHistoryParams,
  BusinessInsightPeriod,
  BusinessInsightRunDetailRecord,
  BusinessInsightRunSummaryRecord,
  GenerateBusinessInsightInput
} from "@fittrack/types";
import { unwrapPaginatedResponse, unwrapResponse } from "../request";
import type { ApiTransport } from "../transport/createAxiosTransport";

export type {
  AnalyticsAttendanceRecord,
  AnalyticsCoachesRecord,
  AnalyticsMembersRecord,
  AnalyticsOverviewRecord,
  AnalyticsPaginatedResult,
  AnalyticsPeriod,
  AnalyticsQueryParams,
  AnalyticsRevenueRecord,
  AnalyticsRevenueTotalsRecord,
  BusinessInsightFocus,
  BusinessInsightHistoryParams,
  BusinessInsightPeriod,
  BusinessInsightRunDetailRecord,
  BusinessInsightRunSummaryRecord,
  GenerateBusinessInsightInput
} from "@fittrack/types";

type AnalyticsRevenueTotalsApiRecord = {
  booking_revenue: string | number;
  coaching_gym_revenue: string | number;
  coaching_payments_collected: string | number;
  membership_revenue: string | number;
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
};

type AnalyticsAttendanceApiRecord = {
  end_date: string;
  period: AnalyticsPeriod;
  series: AnalyticsAttendanceSeriesPointApiRecord[];
  start_date: string;
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
  created_at: string;
  end_date: string;
  focus: BusinessInsightFocus;
  id: string;
  latency_ms: number | null;
  model_used: string | null;
  period: BusinessInsightPeriod;
  requested_by: string | null;
  requester: BusinessInsightRequesterApiRecord | null;
  start_date: string;
  summary: string;
  token_count: number | null;
};

type BusinessInsightRunDetailApiRecord = BusinessInsightRunSummaryApiRecord & {
  anomaly_flags: string[];
  highlights: string[];
  opportunities: string[];
  recommended_actions: string[];
  risks: string[];
};

function toNumber(value: string | number | null | undefined) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function mapRevenueTotals(
  record: AnalyticsRevenueTotalsApiRecord
): AnalyticsRevenueTotalsRecord {
  return {
    bookingRevenue: toNumber(record.booking_revenue),
    coachingGymRevenue: toNumber(record.coaching_gym_revenue),
    coachingPaymentsCollected: toNumber(record.coaching_payments_collected),
    membershipRevenue: toNumber(record.membership_revenue),
    productRevenue: toNumber(record.product_revenue),
    totalRevenue: toNumber(record.total_revenue)
  };
}

function mapOverview(record: AnalyticsOverviewApiRecord): AnalyticsOverviewRecord {
  return {
    completedCoachingSessions: record.completed_coaching_sessions,
    endDate: record.end_date,
    newMembers: record.new_members,
    revenue: mapRevenueTotals(record.revenue),
    startDate: record.start_date,
    totalCheckIns: record.total_check_ins
  };
}

function mapRevenue(record: AnalyticsRevenueApiRecord): AnalyticsRevenueRecord {
  return {
    endDate: record.end_date,
    period: record.period,
    series: record.series.map((point) => ({
      bucketStart: point.bucket_start,
      ...mapRevenueTotals(point)
    })),
    startDate: record.start_date,
    totals: mapRevenueTotals(record.totals)
  };
}

function mapAttendance(
  record: AnalyticsAttendanceApiRecord
): AnalyticsAttendanceRecord {
  return {
    endDate: record.end_date,
    period: record.period,
    series: record.series.map((point) => ({
      bucketStart: point.bucket_start,
      checkIns: point.check_ins
    })),
    startDate: record.start_date
  };
}

function mapMembers(record: AnalyticsMembersApiRecord): AnalyticsMembersRecord {
  return {
    activeMembers: record.active_members,
    endDate: record.end_date,
    newMembers: record.new_members,
    startDate: record.start_date
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
      totalBilled: toNumber(coach.total_billed)
    })),
    endDate: record.end_date,
    startDate: record.start_date
  };
}

function mapInsightSummary(
  record: BusinessInsightRunSummaryApiRecord
): BusinessInsightRunSummaryRecord {
  return {
    createdAt: record.created_at,
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
                lastName: record.requester.profile.last_name
              }
            : null,
          role: record.requester.role,
          status: record.requester.status
        }
      : null,
    startDate: record.start_date,
    summary: record.summary,
    tokenCount: record.token_count
  };
}

function mapInsightDetail(
  record: BusinessInsightRunDetailApiRecord
): BusinessInsightRunDetailRecord {
  return {
    ...mapInsightSummary(record),
    anomalyFlags: record.anomaly_flags,
    highlights: record.highlights,
    opportunities: record.opportunities,
    recommendedActions: record.recommended_actions,
    risks: record.risks
  };
}

function toAnalyticsQueryParams(params?: AnalyticsQueryParams) {
  return {
    ...(params?.startDate ? { start_date: params.startDate } : {}),
    ...(params?.endDate ? { end_date: params.endDate } : {}),
    ...(params?.period ? { period: params.period } : {})
  };
}

function toInsightHistoryParams(params?: BusinessInsightHistoryParams) {
  return {
    ...(params?.page !== undefined ? { page: params.page } : {}),
    ...(params?.limit !== undefined ? { limit: params.limit } : {}),
    ...(params?.focus ? { focus: params.focus } : {}),
    ...(params?.period ? { period: params.period } : {})
  };
}

function toGenerateInsightPayload(input: GenerateBusinessInsightInput) {
  return {
    ...(input.startDate ? { start_date: input.startDate } : {}),
    ...(input.endDate ? { end_date: input.endDate } : {}),
    ...(input.focus ? { focus: input.focus } : {}),
    ...(input.period ? { period: input.period } : {})
  };
}

export function createAnalyticsApi(transport: ApiTransport) {
  return {
    async getOverview(params?: AnalyticsQueryParams) {
      return mapOverview(
        await unwrapResponse<AnalyticsOverviewApiRecord>(
          transport.get("/analytics/overview", { params: toAnalyticsQueryParams(params) }),
          "Unable to load analytics overview."
        )
      );
    },
    async getRevenue(params?: AnalyticsQueryParams) {
      return mapRevenue(
        await unwrapResponse<AnalyticsRevenueApiRecord>(
          transport.get("/analytics/revenue", { params: toAnalyticsQueryParams(params) }),
          "Unable to load analytics revenue."
        )
      );
    },
    async getAttendance(params?: AnalyticsQueryParams) {
      return mapAttendance(
        await unwrapResponse<AnalyticsAttendanceApiRecord>(
          transport.get("/analytics/attendance", { params: toAnalyticsQueryParams(params) }),
          "Unable to load analytics attendance."
        )
      );
    },
    async getMembers(params?: AnalyticsQueryParams) {
      return mapMembers(
        await unwrapResponse<AnalyticsMembersApiRecord>(
          transport.get("/analytics/members", { params: toAnalyticsQueryParams(params) }),
          "Unable to load analytics member counts."
        )
      );
    },
    async getCoaches(params?: AnalyticsQueryParams) {
      return mapCoaches(
        await unwrapResponse<AnalyticsCoachesApiRecord>(
          transport.get("/analytics/coaches", { params: toAnalyticsQueryParams(params) }),
          "Unable to load analytics coaches."
        )
      );
    },
    async listInsights(
      params?: BusinessInsightHistoryParams
    ): Promise<AnalyticsPaginatedResult<BusinessInsightRunSummaryRecord>> {
      const result = await unwrapPaginatedResponse<BusinessInsightRunSummaryApiRecord>(
        transport.get("/business-analytics/insights", {
          params: toInsightHistoryParams(params)
        }),
        "Unable to load analytics insights."
      );
      return {
        ...result,
        data: result.data.map(mapInsightSummary)
      };
    },
    async getInsightById(insightId: string) {
      return mapInsightDetail(
        await unwrapResponse<BusinessInsightRunDetailApiRecord>(
          transport.get(`/business-analytics/insights/${insightId}`),
          "Unable to load analytics insight."
        )
      );
    },
    async generateInsight(input: GenerateBusinessInsightInput) {
      return mapInsightDetail(
        await unwrapResponse<BusinessInsightRunDetailApiRecord>(
          transport.post("/business-analytics/insights", toGenerateInsightPayload(input)),
          "Unable to generate analytics insight."
        )
      );
    }
  };
}
