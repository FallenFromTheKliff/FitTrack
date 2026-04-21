import type { PaginationMeta } from "./membership";

export type AnalyticsPeriod = "daily" | "monthly" | "weekly" | "yearly";
export type BusinessInsightFocus =
  | "attendance"
  | "coaching"
  | "inventory"
  | "membership"
  | "overview"
  | "revenue";
export type BusinessInsightPeriod =
  | AnalyticsPeriod
  | "custom";

export type AnalyticsQueryParams = {
  endDate?: string;
  period?: AnalyticsPeriod;
  startDate?: string;
};

export type BusinessInsightHistoryParams = {
  focus?: BusinessInsightFocus;
  limit?: number;
  page?: number;
  period?: BusinessInsightPeriod;
};

export type GenerateBusinessInsightInput = {
  endDate?: string;
  focus?: BusinessInsightFocus;
  period?: BusinessInsightPeriod;
  startDate?: string;
};

export type AnalyticsRevenueTotalsRecord = {
  bookingRevenue: number;
  coachingGymRevenue: number;
  coachingPaymentsCollected: number;
  membershipRevenue: number;
  productRevenue: number;
  totalRevenue: number;
};

export type AnalyticsRevenueSeriesPointRecord =
  AnalyticsRevenueTotalsRecord & {
    bucketStart: string;
  };

export type AnalyticsAttendanceSeriesPointRecord = {
  bucketStart: string;
  checkIns: number;
};

export type AnalyticsOverviewRecord = {
  completedCoachingSessions: number;
  endDate: string;
  newMembers: number;
  revenue: AnalyticsRevenueTotalsRecord;
  startDate: string;
  totalCheckIns: number;
};

export type AnalyticsRevenueRecord = {
  endDate: string;
  period: AnalyticsPeriod;
  series: AnalyticsRevenueSeriesPointRecord[];
  startDate: string;
  totals: AnalyticsRevenueTotalsRecord;
};

export type AnalyticsAttendanceRecord = {
  endDate: string;
  period: AnalyticsPeriod;
  series: AnalyticsAttendanceSeriesPointRecord[];
  startDate: string;
};

export type AnalyticsMembersRecord = {
  activeMembers: number;
  endDate: string;
  newMembers: number;
  startDate: string;
};

export type AnalyticsCoachBreakdownRecord = {
  coachId: string;
  coachPayout: number;
  completedSessions: number;
  firstName: string | null;
  gymCut: number;
  lastName: string | null;
  totalBilled: number;
};

export type AnalyticsCoachesRecord = {
  coaches: AnalyticsCoachBreakdownRecord[];
  endDate: string;
  startDate: string;
};

export type BusinessInsightRequesterProfileRecord = {
  firstName: string | null;
  lastName: string | null;
};

export type BusinessInsightRequesterRecord = {
  id: string;
  profile: BusinessInsightRequesterProfileRecord | null;
  role: string;
  status: string;
};

export type BusinessInsightRunSummaryRecord = {
  createdAt: string;
  endDate: string;
  focus: BusinessInsightFocus;
  id: string;
  latencyMs: number | null;
  modelUsed: string | null;
  period: BusinessInsightPeriod;
  requestedBy: string | null;
  requester: BusinessInsightRequesterRecord | null;
  startDate: string;
  summary: string;
  tokenCount: number | null;
};

export type BusinessInsightRunDetailRecord =
  BusinessInsightRunSummaryRecord & {
    anomalyFlags: string[];
    highlights: string[];
    opportunities: string[];
    recommendedActions: string[];
    risks: string[];
  };

export type AnalyticsPaginatedResult<T> = {
  data: T[];
  meta: PaginationMeta;
};
