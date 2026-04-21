"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import {
  analyticsAttendanceQueryOptions,
  analyticsCoachesQueryOptions,
  analyticsInsightDetailQueryOptions,
  analyticsInsightsQueryOptions,
  analyticsMembersQueryOptions,
  analyticsOverviewQueryOptions,
  analyticsRevenueQueryOptions,
  generateAnalyticsInsightMutationOptions
} from "@fittrack/query";
import { useTimedMessage } from "@fittrack/hooks";

import { webApiClient } from "@/lib/api-client";
import {
  ANALYTICS_DEFAULT_PERIOD,
  buildAnalyticsQuickAnalysisPrompt,
  defaultAnalyticsPaginatedResult,
  formatAnalyticsPeriodLabel,
  toAnalyticsAttendanceSeries,
  toAnalyticsPieData,
  toAnalyticsRevenueSeries,
  toLastSevenDaysWindow,
  toPeriodWindow
} from "@/app/(admin)/analytics/helpers";
import { downloadExcelCompatibleReport } from "@/utils/reporting";

export function useAnalyticsDashboard() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { message, showMessage } = useTimedMessage(2500);
  const [period, setPeriod] = useState(ANALYTICS_DEFAULT_PERIOD);

  const revenueWindow = useMemo(() => toPeriodWindow(period), [period]);
  const attendanceWindow = useMemo(() => toLastSevenDaysWindow(), []);
  const periodLabel = formatAnalyticsPeriodLabel(period);

  const { data: overview, isLoading: overviewLoading } = useQuery({
    ...analyticsOverviewQueryOptions(webApiClient, revenueWindow),
    staleTime: 60_000,
    gcTime: 300_000
  });
  const { data: revenue } = useQuery({
    ...analyticsRevenueQueryOptions(webApiClient, revenueWindow),
    staleTime: 60_000,
    gcTime: 300_000
  });
  const { data: attendance } = useQuery({
    ...analyticsAttendanceQueryOptions(webApiClient, attendanceWindow),
    staleTime: 60_000,
    gcTime: 300_000
  });
  const { data: members } = useQuery({
    ...analyticsMembersQueryOptions(webApiClient, revenueWindow),
    staleTime: 60_000,
    gcTime: 300_000
  });
  const { data: coaches } = useQuery({
    ...analyticsCoachesQueryOptions(webApiClient, revenueWindow),
    staleTime: 60_000,
    gcTime: 300_000
  });
  const { data: insightHistory = defaultAnalyticsPaginatedResult() } = useQuery({
    ...analyticsInsightsQueryOptions(webApiClient, {
      limit: 1,
      page: 1
    }),
    staleTime: 30_000,
    gcTime: 300_000
  });
  const latestInsightId = insightHistory.data[0]?.id;
  const { data: latestInsight } = useQuery({
    ...analyticsInsightDetailQueryOptions(webApiClient, latestInsightId),
    enabled: !!latestInsightId,
    staleTime: 30_000,
    gcTime: 300_000
  });
  const generateInsightMutation = useMutation(
    generateAnalyticsInsightMutationOptions(webApiClient, queryClient)
  );

  const handleGenerateInsight = async () => {
    try {
      const generatedInsight = await generateInsightMutation.mutateAsync({
        input: {
          ...revenueWindow,
          focus: "overview"
        }
      });

      const quickAnalysisPrompt = buildAnalyticsQuickAnalysisPrompt(periodLabel, generatedInsight);

      const searchParams = new URLSearchParams({
        autostart: "1",
        prompt: quickAnalysisPrompt,
        sessionId: "new"
      });

      router.push(`/ai?${searchParams.toString()}`);
    } catch {
      showMessage("Insight generation failed.");
    }
  };

  const handleExportExcel = () => {
    const didDownload = downloadExcelCompatibleReport({
      fileName: `fittrack-analytics-${period}.csv`,
      title: `FitTrack Analytics Report - ${periodLabel}`,
      sections: [
        {
          title: "Overview",
          columns: ["Metric", "Value"],
          rows: [
            ["Period", periodLabel],
            ["Total Revenue", revenue?.totals.totalRevenue ?? 0],
            ["Membership Revenue", revenue?.totals.membershipRevenue ?? 0],
            ["Product Revenue", revenue?.totals.productRevenue ?? 0],
            ["Booking Revenue", revenue?.totals.bookingRevenue ?? 0],
            ["Coaching Revenue", revenue?.totals.coachingPaymentsCollected ?? 0],
            ["New Members", members?.newMembers ?? 0],
            ["Total Check-Ins", overview?.totalCheckIns ?? 0],
            ["Completed Coaching Sessions", overview?.completedCoachingSessions ?? 0]
          ]
        },
        {
          title: "Revenue Series",
          columns: [
            "Bucket Start",
            "Total Revenue",
            "Membership",
            "Bookings",
            "Products",
            "Coaching",
            "Gym Cut"
          ],
          rows: (revenue?.series ?? []).map((point) => [
            point.bucketStart,
            point.totalRevenue,
            point.membershipRevenue,
            point.bookingRevenue,
            point.productRevenue,
            point.coachingPaymentsCollected,
            point.coachingGymRevenue
          ])
        },
        {
          title: "Attendance Series",
          columns: ["Bucket Start", "Check-Ins"],
          rows: (attendance?.series ?? []).map((point) => [point.bucketStart, point.checkIns])
        },
        {
          title: "Coach Performance",
          columns: ["Coach", "Completed Sessions", "Total Billed", "Coach Payout", "Gym Cut"],
          rows: (coaches?.coaches ?? []).map((coach) => [
            `${coach.firstName ?? ""} ${coach.lastName ?? ""}`.trim() || coach.coachId,
            coach.completedSessions,
            coach.totalBilled,
            coach.coachPayout,
            coach.gymCut
          ])
        },
        {
          title: "Latest Insight",
          columns: ["Summary", "Highlights", "Risks", "Recommended Actions"],
          rows: [[
            latestInsight?.summary ?? "No business insight generated yet.",
            latestInsight?.highlights?.join(" | ") ?? "",
            latestInsight?.risks?.join(" | ") ?? "",
            latestInsight?.recommendedActions?.join(" | ") ?? ""
          ]]
        }
      ]
    });
    showMessage(didDownload ? "Analytics spreadsheet downloaded." : "Analytics spreadsheet is unavailable.");
  };

  return {
    attendanceSeries: toAnalyticsAttendanceSeries(attendance),
    coachRows: (coaches?.coaches ?? []).slice(0, 5),
    handleExportExcel,
    handleGenerateInsight,
    isGeneratingInsight: generateInsightMutation.isPending,
    latestInsight,
    members,
    message,
    overview,
    overviewLoading,
    period,
    periodLabel,
    pieData: toAnalyticsPieData(revenue),
    revenue,
    revenueSeries: toAnalyticsRevenueSeries(revenue, period),
    setPeriod
  };
}
