"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  adminDeletionRequestsQueryOptions,
  adminMembersQueryOptions,
  analyticsAttendanceQueryOptions,
  analyticsInsightDetailQueryOptions,
  analyticsInsightsQueryOptions,
  analyticsOverviewQueryOptions,
  analyticsRevenueQueryOptions,
  analyticsSnapshotQueryOptions,
  exportAnalyticsPdfMutationOptions,
  generateAnalyticsInsightMutationOptions,
} from "@fittrack/query";
import type {
  AnalyticsAttendanceRecord,
  AnalyticsPdfSection,
  BusinessInsightFocus,
  BusinessInsightRunDetailRecord,
  MemberRecord,
} from "@fittrack/types";
import { useTimedMessage } from "@fittrack/hooks";

import { webApiClient } from "@/lib/api-client";
import type { DeletionRequest } from "@/data/members/members";
import {
  ANALYTICS_AGGREGATION_PERIOD_OPTIONS,
  createAnalyticsDateWindow,
  deriveAttendanceDrilldownWindow,
  formatDateTime,
  getDefaultAnalyticsDateWindow,
  toAttendanceWindow,
  toAttendanceChartSeries,
  toRevenueChartSeries,
  type AnalyticsAggregationPeriod,
  type AnalyticsAttendanceFilter,
} from "@/app/(auth)/analytics/helpers";

type AttendanceDrilldownSelection = {
  bucketStart: string;
  label: string;
};

type AnalyticsPdfExportOptions = {
  includeRecommendations?: boolean;
  insightId?: string;
};

const PDF_EXPORT_SECTION_OPTIONS: Array<{
  label: string;
  value: AnalyticsPdfSection;
}> = [
  { label: "Performance KPIs", value: "kpis" },
  { label: "Daily Insights", value: "daily" },
  { label: "Revenue", value: "revenue" },
  { label: "Attendance", value: "attendance" },
  { label: "Inventory", value: "inventory" },
  { label: "System Alerts", value: "alerts" },
  { label: "Recent Activities", value: "activities" },
  { label: "Recommendations", value: "recommendations" },
];

const DEFAULT_PDF_EXPORT_SECTIONS = PDF_EXPORT_SECTION_OPTIONS.map(
  (option) => option.value,
);
const DEFAULT_ANALYTICS_WINDOW = getDefaultAnalyticsDateWindow();
export const ANALYTICS_INSIGHT_FOCUS_OPTIONS: Array<{
  label: string;
  value: BusinessInsightFocus;
}> = [
  { label: "Overview", value: "overview" },
  { label: "Revenue", value: "revenue" },
  { label: "Attendance", value: "attendance" },
  { label: "Membership", value: "membership" },
  { label: "Coaching", value: "coaching" },
  { label: "Inventory", value: "inventory" },
];

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
  const [analyticsWindow, setAnalyticsWindow] = useState(
    DEFAULT_ANALYTICS_WINDOW,
  );
  const [draftStartDate, setDraftStartDate] = useState(
    DEFAULT_ANALYTICS_WINDOW.startDate,
  );
  const [draftEndDate, setDraftEndDate] = useState(
    DEFAULT_ANALYTICS_WINDOW.endDate,
  );
  const [draftAggregationPeriod, setDraftAggregationPeriod] =
    useState<AnalyticsAggregationPeriod>(
      DEFAULT_ANALYTICS_WINDOW.period as AnalyticsAggregationPeriod,
    );
  const [selectedDrilldown, setSelectedDrilldown] =
    useState<AttendanceDrilldownSelection | null>(null);
  const [generatedInsight, setGeneratedInsight] =
    useState<BusinessInsightRunDetailRecord | null>(null);
  const [selectedInsightFocus, setSelectedInsightFocus] =
    useState<BusinessInsightFocus>("overview");
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [selectedPdfSections, setSelectedPdfSections] = useState<
    AnalyticsPdfSection[]
  >(DEFAULT_PDF_EXPORT_SECTIONS);

  const drilldownWindow = useMemo(
    () =>
      selectedDrilldown
        ? deriveAttendanceDrilldownWindow(
            selectedDrilldown.bucketStart,
            analyticsWindow.period as AnalyticsAttendanceFilter,
          )
        : null,
    [analyticsWindow.period, selectedDrilldown],
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
  const overviewQuery = useQuery({
    ...analyticsOverviewQueryOptions(webApiClient, analyticsWindow),
    refetchOnMount: "always",
    staleTime: 60_000,
    gcTime: 300_000,
  });
  const revenueQuery = useQuery({
    ...analyticsRevenueQueryOptions(webApiClient, analyticsWindow),
    refetchOnMount: "always",
    staleTime: 60_000,
    gcTime: 300_000,
  });
  const attendanceQuery = useQuery({
    ...analyticsAttendanceQueryOptions(webApiClient, analyticsWindow),
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
      focus: selectedInsightFocus,
      limit: 1,
      page: 1,
    }),
    staleTime: 30_000,
    gcTime: 300_000,
  });
  const latestInsightId = insightHistoryQuery.data?.data[0]?.id;
  const latestInsightQuery = useQuery({
    ...analyticsInsightDetailQueryOptions(webApiClient, latestInsightId),
    enabled:
      Boolean(latestInsightId) &&
      generatedInsight?.focus !== selectedInsightFocus,
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
  const overview = overviewQuery.data;
  const revenue = revenueQuery.data;
  const attendance = attendanceQuery.data;
  const storedInsightMatchesWindow =
    latestInsightQuery.data?.startDate.slice(0, 10) ===
      analyticsWindow.startDate &&
    latestInsightQuery.data?.endDate.slice(0, 10) === analyticsWindow.endDate &&
    latestInsightQuery.data?.period === analyticsWindow.period &&
    latestInsightQuery.data?.focus === selectedInsightFocus;
  const latestInsight =
    (generatedInsight?.focus === selectedInsightFocus
      ? generatedInsight
      : null) ??
    (storedInsightMatchesWindow ? latestInsightQuery.data : null) ??
    null;
  const latestInsightIsFallback = isFallbackBusinessInsight(latestInsight);
  const revenueSeries = useMemo(() => toRevenueChartSeries(revenue), [revenue]);
  const attendanceSeries = useMemo(
    () =>
      toAttendanceChartSeries(
        attendance,
        analyticsWindow.period as AnalyticsAttendanceFilter,
      ),
    [analyticsWindow.period, attendance],
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
          ...analyticsWindow,
          focus: selectedInsightFocus,
          period: analyticsWindow.period,
        },
      });
      setGeneratedInsight(result);
      showMessage("Fresh analytics insight is ready.");
      return result;
    } catch {
      showMessage("Couldn't generate a new analytics insight.");
      return null;
    }
  };

  const handleExportPdf = async (
    options: AnalyticsPdfExportOptions = {},
  ): Promise<boolean> => {
    const exportSections =
      options.includeRecommendations === false
        ? selectedPdfSections.filter((section) => section !== "recommendations")
        : selectedPdfSections;

    if (exportSections.length === 0) {
      showMessage("Choose at least one analytics section to export.");
      return false;
    }

    if (exportSections.includes("recommendations") && !options.insightId) {
      showMessage(
        "Generate or select a matching AI insight before exporting recommendations.",
      );
      return false;
    }

    setIsExportingPdf(true);

    try {
      const result = await exportPdfMutation.mutateAsync({
        attendanceEndDate: analyticsWindow.endDate,
        attendancePeriod: analyticsWindow.period,
        attendanceStartDate: analyticsWindow.startDate,
        insightId: options.insightId,
        revenueEndDate: analyticsWindow.endDate,
        revenuePeriod: analyticsWindow.period,
        revenueStartDate: analyticsWindow.startDate,
        selectedSections: exportSections,
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
      return true;
    } catch {
      showMessage("Couldn't export the analytics PDF.");
      return false;
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

  const handleSetInsightFocus = (focus: BusinessInsightFocus) => {
    setSelectedInsightFocus(focus);
  };

  const handleApplyAnalyticsWindow = () => {
    if (!draftStartDate || !draftEndDate) {
      showMessage("Choose both a start and end date.");
      return;
    }

    if (draftStartDate > draftEndDate) {
      showMessage("Start date must be on or before the end date.");
      return;
    }

    const shouldUseYearlyRange =
      draftAggregationPeriod === "yearly" &&
      draftStartDate === DEFAULT_ANALYTICS_WINDOW.startDate &&
      draftEndDate === DEFAULT_ANALYTICS_WINDOW.endDate;
    const nextWindow = shouldUseYearlyRange
      ? toAttendanceWindow("yearly")
      : createAnalyticsDateWindow(
          draftStartDate,
          draftEndDate,
          draftAggregationPeriod,
        );

    if (shouldUseYearlyRange) {
      setDraftStartDate(nextWindow.startDate);
      setDraftEndDate(nextWindow.endDate);
    }

    setAnalyticsWindow(nextWindow);
    setGeneratedInsight(null);
    setSelectedDrilldown(null);
    showMessage("Analytics date range applied.");
  };

  const handleResetAnalyticsWindow = () => {
    setDraftStartDate(DEFAULT_ANALYTICS_WINDOW.startDate);
    setDraftEndDate(DEFAULT_ANALYTICS_WINDOW.endDate);
    setDraftAggregationPeriod(
      DEFAULT_ANALYTICS_WINDOW.period as AnalyticsAggregationPeriod,
    );
    setAnalyticsWindow(DEFAULT_ANALYTICS_WINDOW);
    setGeneratedInsight(null);
    setSelectedDrilldown(null);
    showMessage("Analytics date range reset.");
  };

  return {
    aggregationPeriodOptions: ANALYTICS_AGGREGATION_PERIOD_OPTIONS,
    analyticsWindow,
    analyticsWindowDirty:
      draftStartDate !== analyticsWindow.startDate ||
      draftEndDate !== analyticsWindow.endDate ||
      draftAggregationPeriod !== analyticsWindow.period,
    attendance,
    attendanceFilter: analyticsWindow.period as AnalyticsAttendanceFilter,
    attendanceFilterLabel: analyticsWindow.label,
    attendanceLoading: attendanceQuery.isLoading,
    attendanceSeries,
    attendanceWindow: analyticsWindow,
    draftAggregationPeriod,
    draftEndDate,
    draftStartDate,
    generatedAtLabel: snapshot ? formatDateTime(snapshot.generatedAt) : null,
    drilldownAttendance: drilldownQuery.data,
    drilldownLoading: drilldownQuery.isFetching,
    drilldownSeries,
    drilldownSubtitle: getAttendanceDrilldownSubtitle(
      analyticsWindow.period as AnalyticsAttendanceFilter,
      selectedDrilldown,
    ),
    drilldownTitle: selectedDrilldown
      ? `Attendance breakdown for ${selectedDrilldown.label}`
      : "Attendance breakdown",
    handleApplyAnalyticsWindow,
    handleCloseDrilldown,
    handleExportPdf,
    handleGenerateInsight,
    handleResetAnalyticsWindow,
    handleSelectAttendancePoint,
    handleSetInsightFocus,
    handleTogglePdfSection,
    isExportingPdf: isExportingPdf || exportPdfMutation.isPending,
    isGeneratingInsight: generateInsightMutation.isPending,
    latestInsight,
    latestInsightIsFallback,
    latestInsightLoading:
      insightHistoryQuery.isLoading || latestInsightQuery.isLoading,
    message,
    overview,
    overviewLoading: overviewQuery.isLoading,
    pdfExportSectionOptions: PDF_EXPORT_SECTION_OPTIONS,
    insightFocusOptions: ANALYTICS_INSIGHT_FOCUS_OPTIONS,
    visibleActiveMemberCount,
    revenue,
    revenueLoading: revenueQuery.isLoading,
    revenueSeries,
    revenueWindow: analyticsWindow,
    selectedDrilldown,
    selectedPdfSections,
    selectedInsightFocus,
    setDraftAggregationPeriod,
    setDraftEndDate,
    setDraftStartDate,
    snapshot,
    snapshotLoading: snapshotQuery.isLoading,
  };
}
