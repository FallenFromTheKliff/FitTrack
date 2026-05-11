"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  adminDeletionRequestsQueryOptions,
  adminMembersQueryOptions,
  analyticsAttendanceQueryOptions,
  analyticsInsightDetailQueryOptions,
  analyticsInsightsQueryOptions,
  analyticsRevenueQueryOptions,
  analyticsSnapshotQueryOptions,
  exportAnalyticsPdfMutationOptions,
  generateAnalyticsInsightMutationOptions,
} from "@fittrack/query";
import type {
  AnalyticsAttendanceRecord,
  AnalyticsPdfSection,
  BusinessInsightRunDetailRecord,
  MemberRecord,
} from "@fittrack/types";
import { useTimedMessage } from "@fittrack/hooks";

import { webApiClient } from "@/lib/api-client";
import type { DeletionRequest } from "@/data/members/members";
import {
  ANALYTICS_DEFAULT_ATTENDANCE_FILTER,
  type AnalyticsRevenueWindowFilter,
  deriveAttendanceDrilldownWindow,
  formatDateTime,
  ANALYTICS_REVENUE_WINDOW_OPTIONS,
  toAttendanceChartSeries,
  toAttendanceWindow,
  toRevenueChartSeries,
  toRevenueWindow,
  type AnalyticsAttendanceFilter,
} from "@/app/(auth)/analytics/helpers";

type AttendanceDrilldownSelection = {
  bucketStart: string;
  label: string;
};

const PDF_EXPORT_SECTION_OPTIONS: Array<{
  label: string;
  value: AnalyticsPdfSection;
}> = [
  { label: "Daily Insights", value: "daily" },
  { label: "Performance KPIs", value: "kpis" },
  { label: "Revenue", value: "revenue" },
  { label: "Inventory", value: "inventory" },
  { label: "Attendance", value: "attendance" },
  { label: "System Alerts", value: "alerts" },
  { label: "Recent Activities", value: "activities" },
  { label: "Recommendations", value: "recommendations" },
];

const DEFAULT_PDF_EXPORT_SECTIONS = PDF_EXPORT_SECTION_OPTIONS.map(
  (option) => option.value,
);

function isFallbackBusinessInsight(
  insight: BusinessInsightRunDetailRecord | null | undefined,
): boolean {
  return Boolean(
    insight &&
      (insight.modelUsed === "grounded-fallback" ||
        insight.summary.startsWith("Fallback insight:")),
  );
}

function getAttendanceDrilldownSubtitle(
  attendanceFilter: AnalyticsAttendanceFilter,
  selectedDrilldown: AttendanceDrilldownSelection | null,
) {
  if (!selectedDrilldown) {
    return "Select a chart point to inspect the detailed attendance breakdown.";
  }

  if (attendanceFilter === "hourly") {
    return `${selectedDrilldown.label} is already the most granular attendance view available for today.`;
  }

  return `Detailed breakdown for ${selectedDrilldown.label}.`;
}

export function useAnalyticsDashboard() {
  const queryClient = useQueryClient();
  const { message, showMessage } = useTimedMessage(3000);
  const [attendanceFilter, setAttendanceFilter] =
    useState<AnalyticsAttendanceFilter>(ANALYTICS_DEFAULT_ATTENDANCE_FILTER);
  const [selectedDrilldown, setSelectedDrilldown] =
    useState<AttendanceDrilldownSelection | null>(null);
  const [revenueWindowFilter, setRevenueWindowFilter] =
    useState<AnalyticsRevenueWindowFilter>("6m");
  const [generatedInsight, setGeneratedInsight] =
    useState<BusinessInsightRunDetailRecord | null>(null);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [selectedPdfSections, setSelectedPdfSections] = useState<
    AnalyticsPdfSection[]
  >(DEFAULT_PDF_EXPORT_SECTIONS);

  const revenueWindow = useMemo(
    () => toRevenueWindow(revenueWindowFilter),
    [revenueWindowFilter],
  );
  const attendanceWindow = useMemo(
    () => toAttendanceWindow(attendanceFilter),
    [attendanceFilter],
  );
  const drilldownWindow = useMemo(
    () =>
      selectedDrilldown
        ? deriveAttendanceDrilldownWindow(
            selectedDrilldown.bucketStart,
            attendanceFilter,
          )
        : null,
    [attendanceFilter, selectedDrilldown],
  );

  const snapshotQuery = useQuery({
    ...analyticsSnapshotQueryOptions(webApiClient),
    refetchOnMount: "always",
    staleTime: 60_000,
    gcTime: 300_000,
  });
  const directoryMembersQuery = useQuery({
    ...adminMembersQueryOptions(webApiClient),
    refetchOnMount: "always",
    staleTime: 60_000,
    gcTime: 300_000,
  });
  const deletionRequestsQuery = useQuery({
    ...adminDeletionRequestsQueryOptions<DeletionRequest>(webApiClient),
    refetchOnMount: "always",
    staleTime: 30_000,
    gcTime: 300_000,
  });
  const revenueQuery = useQuery({
    ...analyticsRevenueQueryOptions(webApiClient, revenueWindow),
    refetchOnMount: "always",
    staleTime: 60_000,
    gcTime: 300_000,
  });
  const attendanceQuery = useQuery({
    ...analyticsAttendanceQueryOptions(webApiClient, attendanceWindow),
    refetchOnMount: "always",
    staleTime: 30_000,
    gcTime: 300_000,
  });
  const drilldownQuery = useQuery({
    ...analyticsAttendanceQueryOptions(
      webApiClient,
      drilldownWindow ?? undefined,
    ),
    enabled: Boolean(drilldownWindow),
    staleTime: 30_000,
    gcTime: 300_000,
  });
  const insightHistoryQuery = useQuery({
    ...analyticsInsightsQueryOptions(webApiClient, {
      limit: 1,
      page: 1,
    }),
    staleTime: 30_000,
    gcTime: 300_000,
  });
  const latestInsightId = insightHistoryQuery.data?.data[0]?.id;
  const latestInsightQuery = useQuery({
    ...analyticsInsightDetailQueryOptions(webApiClient, latestInsightId),
    enabled: Boolean(latestInsightId) && !generatedInsight,
    staleTime: 30_000,
    gcTime: 300_000,
  });
  const generateInsightMutation = useMutation(
    generateAnalyticsInsightMutationOptions(webApiClient, queryClient),
  );
  const exportPdfMutation = useMutation(
    exportAnalyticsPdfMutationOptions(webApiClient),
  );

  const snapshot = snapshotQuery.data;
  const revenue = revenueQuery.data;
  const attendance = attendanceQuery.data;
  const latestInsight = generatedInsight ?? latestInsightQuery.data ?? null;
  const latestInsightIsFallback = isFallbackBusinessInsight(latestInsight);
  const revenueSeries = useMemo(() => toRevenueChartSeries(revenue), [revenue]);
  const attendanceSeries = useMemo(
    () => toAttendanceChartSeries(attendance, attendanceFilter),
    [attendance, attendanceFilter],
  );
  const drilldownSeries = useMemo(
    () =>
      drilldownWindow
        ? toAttendanceChartSeries(
            drilldownQuery.data as AnalyticsAttendanceRecord | undefined,
            drilldownWindow.period as AnalyticsAttendanceFilter,
          )
        : [],
    [drilldownQuery.data, drilldownWindow],
  );
  const visibleActiveMemberCount = useMemo(() => {
    const members = directoryMembersQuery.data ?? [];
    const pendingDeletionUserIds = new Set(
      (deletionRequestsQuery.data ?? [])
        .filter((request) => request.status?.toLowerCase() === "pending")
        .map((request) => request.userId ?? request.user?.id ?? "")
        .filter(Boolean),
    );

    return members.filter((member: MemberRecord) => {
      const isArchived =
        Boolean(member.deletedAt) || pendingDeletionUserIds.has(member.id);
      return (
        !isArchived &&
        member.role?.name === "USER" &&
        member.membershipCard?.status === "active"
      );
    }).length;
  }, [deletionRequestsQuery.data, directoryMembersQuery.data]);

  const handleGenerateInsight = async () => {
    try {
      const result = await generateInsightMutation.mutateAsync({
        input: {
          ...revenueWindow,
          focus: "overview",
          period: revenueWindow.period,
        },
      });
      setGeneratedInsight(result);
      showMessage("Fresh analytics insight is ready.");
    } catch {
      showMessage("Couldn't generate a new analytics insight.");
    }
  };

  const handleExportPdf = async () => {
    if (selectedPdfSections.length === 0) {
      showMessage("Choose at least one analytics section to export.");
      return;
    }

    setIsExportingPdf(true);

    try {
      const result = await exportPdfMutation.mutateAsync({
        attendanceEndDate: attendanceWindow.endDate,
        attendancePeriod: attendanceWindow.period,
        attendanceStartDate: attendanceWindow.startDate,
        revenueEndDate: revenueWindow.endDate,
        revenuePeriod: revenueWindow.period,
        revenueStartDate: revenueWindow.startDate,
        selectedSections: selectedPdfSections,
      });

      const blob = new Blob([result.bytes], {
        type: result.contentType || "application/pdf",
      });
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = result.fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => {
        URL.revokeObjectURL(objectUrl);
      }, 1000);

      showMessage("Analytics PDF download started.");
    } finally {
      setIsExportingPdf(false);
    }
  };

  const handleTogglePdfSection = (section: AnalyticsPdfSection) => {
    setSelectedPdfSections((current) =>
      current.includes(section)
        ? current.filter((item) => item !== section)
        : [...current, section],
    );
  };

  const handleSelectAttendancePoint = (bucketStart: string, label: string) => {
    setSelectedDrilldown({ bucketStart, label });
  };

  const handleCloseDrilldown = () => {
    setSelectedDrilldown(null);
  };

  return {
    attendance,
    attendanceFilter,
    attendanceFilterLabel: attendanceWindow.label,
    attendanceLoading: attendanceQuery.isLoading,
    attendanceSeries,
    attendanceWindow,
    generatedAtLabel: snapshot ? formatDateTime(snapshot.generatedAt) : null,
    drilldownAttendance: drilldownQuery.data,
    drilldownLoading: drilldownQuery.isFetching,
    drilldownSeries,
    drilldownSubtitle: getAttendanceDrilldownSubtitle(
      attendanceFilter,
      selectedDrilldown,
    ),
    drilldownTitle: selectedDrilldown
      ? `Attendance breakdown for ${selectedDrilldown.label}`
      : "Attendance breakdown",
    handleCloseDrilldown,
    handleExportPdf,
    handleGenerateInsight,
    handleSelectAttendancePoint,
    handleTogglePdfSection,
    isExportingPdf: isExportingPdf || exportPdfMutation.isPending,
    isGeneratingInsight: generateInsightMutation.isPending,
    latestInsight,
    latestInsightIsFallback,
    latestInsightLoading:
      insightHistoryQuery.isLoading || latestInsightQuery.isLoading,
    message,
    pdfExportSectionOptions: PDF_EXPORT_SECTION_OPTIONS,
    revenueWindowFilter,
    revenueWindowFilterOptions: ANALYTICS_REVENUE_WINDOW_OPTIONS,
    visibleActiveMemberCount,
    revenue,
    revenueLoading: revenueQuery.isLoading,
    revenueSeries,
    revenueWindow,
    selectedDrilldown,
    selectedPdfSections,
    setAttendanceFilter,
    setRevenueWindowFilter,
    snapshot,
    snapshotLoading: snapshotQuery.isLoading,
  };
}
