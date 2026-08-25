import type { PaginationMeta } from "./membership.js";

export type AnalyticsPeriod =
  | "hourly"
  | "daily"
  | "monthly"
  | "weekly"
  | "yearly";
export type BusinessInsightFocus =
  | "attendance"
  | "coaching"
  | "inventory"
  | "membership"
  | "overview"
  | "revenue";
export type BusinessInsightPeriod = AnalyticsPeriod | "custom";

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

export type AnalyticsPdfSection =
  | "activities"
  | "alerts"
  | "attendance"
  | "daily"
  | "inventory"
  | "kpis"
  | "recommendations"
  | "revenue";

export type ExportAnalyticsPdfInput = {
  attendanceEndDate?: string;
  attendancePeriod?: AnalyticsPeriod;
  attendanceStartDate?: string;
  insightId?: string;
  revenueEndDate?: string;
  revenuePeriod?: AnalyticsPeriod;
  revenueStartDate?: string;
  selectedSections?: AnalyticsPdfSection[];
};

export type AnalyticsPdfExportResult = {
  bytes: ArrayBuffer;
  contentType: string;
  fileName: string;
};

export type AnalyticsRevenueTotalsRecord = {
  bookingRevenue: number;
  coachingGymRevenue: number;
  coachingPaymentsCollected: number;
  membershipRevenue: number;
  productRevenue: number;
  totalRevenue: number;
};

export type AnalyticsRevenueSeriesPointRecord = AnalyticsRevenueTotalsRecord & {
  bucketStart: string;
};

export type AnalyticsAttendanceSeriesPointRecord = {
  bucketStart: string;
  checkIns: number;
};

export type AnalyticsAttendancePeakHourRecord = {
  hourLabel: string;
  checkIns: number;
};

export type AnalyticsTopRevenueSourceRecord = {
  revenue: number;
  sharePercentage: number;
  sourceKey: string;
  sourceLabel: string;
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
  topRevenueSources: AnalyticsTopRevenueSourceRecord[];
};

export type AnalyticsAttendanceRecord = {
  endDate: string;
  period: AnalyticsPeriod;
  peakHours: AnalyticsAttendancePeakHourRecord[];
  series: AnalyticsAttendanceSeriesPointRecord[];
  startDate: string;
  totalCheckIns: number;
};

export type AnalyticsDailyInsightsRecord = {
  activeMembers: number;
  recentActivities: number;
  sessionsToday: number;
};

export type AnalyticsPerformanceKpisRecord = {
  activeMembers: number;
  appFeedbackSubmissions: number;
  checkIns: number;
  coachSatisfactionRating: number;
  coachingSessions: number;
  newMembers: number;
  sessionCompletionRate: number;
  totalCoachingAppointments: number;
  totalRevenue: number;
  totalVenueBookings: number;
  venueFeedbackRating: number;
};

export type AnalyticsSystemAlertRecord = {
  actionLabel: string;
  body: string;
  href: string;
  id: string;
  kind: string;
  severity: string;
  title: string;
};

export type AnalyticsRecentActivityRecord = {
  actorName: string;
  description: string;
  entityId: string;
  entityLabel: string;
  id: string;
  kind: string;
  occurredAt: string;
  status: string;
  title: string;
};

export type AnalyticsSnapshotRecord = {
  dailyInsights: AnalyticsDailyInsightsRecord;
  generatedAt: string;
  performanceKpis: AnalyticsPerformanceKpisRecord;
  recentActivities: AnalyticsRecentActivityRecord[];
  systemAlerts: AnalyticsSystemAlertRecord[];
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

export type BusinessInsightRunDetailRecord = BusinessInsightRunSummaryRecord & {
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
