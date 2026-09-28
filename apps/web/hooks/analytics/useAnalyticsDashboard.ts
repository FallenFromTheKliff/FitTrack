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
  exportAnalyticsInsightPdfMutationOptions,
  generateAnalyticsInsightMutationOptions,
} from "@fittrack/query";
import {
  BUSINESS_INSIGHT_ANALYSIS_DEPTHS,
  BUSINESS_INSIGHT_FOCUS_ORDER,
} from "@fittrack/types";
import type {
  AnalyticsAttendanceRecord,
  AnalyticsPdfSection,
  BusinessInsightAnalysisDepth,
  BusinessInsightFocus,
  BusinessInsightRunDetailRecord,
  ExportBusinessInsightPdfInput,
  MemberRecord,
} from "@fittrack/types";
import { useTimedMessage } from "@fittrack/hooks";

import { webApiClient } from "@/lib/api-client";
import type { DeletionRequest } from "@/data/members/members";
import {
  ANALYTICS_TIME_MODE_OPTIONS,
  deriveAttendanceDrilldownWindow,
  formatDateTime,
  getDefaultAnalyticsDateWindow,
  getAnalyticsWeekOptions,
  resolveAnalyticsTimeframe,
  toAttendanceChartSeries,
  toRevenueChartSeries,
  type AnalyticsAttendanceFilter,
  type AnalyticsTimeMode,
  type AnalyticsTimeframeDraft,
} from "@/app/(auth)/analytics/helpers";

type AttendanceDrilldownSelection = {
  bucketStart: string;
  label: string;
};


const PDF_EXPORT_SECTION_OPTIONS: Array<{
  label: string;
  value: AnalyticsPdfSection;
}> = [
  { label: "Performance KPIs", value: "kpis" },
  { label: "Operations Snapshot", value: "daily" },
  { label: "Revenue", value: "revenue" },
  { label: "Attendance", value: "attendance" },
  { label: "Inventory", value: "inventory" },
  { label: "System Alerts", value: "alerts" },
  { label: "Recent Activities", value: "activities" },
];

const DEFAULT_PDF_EXPORT_SECTIONS = PDF_EXPORT_SECTION_OPTIONS.map(
  (option) => option.value,
);
const DEFAULT_ANALYTICS_WINDOW = getDefaultAnalyticsDateWindow();
const DEFAULT_ANALYTICS_TIME_MODE: AnalyticsTimeMode = "custom";

function getAnalyticsDateParts(value: string) {
  return {
    month: Number(value.slice(5, 7)),
    year: Number(value.slice(0, 4)),
  };
}

function getSafeAnalyticsDate(value?: string) {
  if (value && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const date = new Date(`${value}T00:00:00.000Z`);
    if (
      Number.isFinite(date.getTime()) &&
      date.toISOString().slice(0, 10) === value
    ) {
      return value;
    }
  }

  return new Date().toISOString().slice(0, 10);
}

function parseAnalyticsMonthValue(value: number | string) {
  if (typeof value === "string") {
    const monthValue = /^(\d{4})-(\d{2})$/.exec(value);
    if (monthValue) {
      const year = Number(monthValue[1]);
      const month = Number(monthValue[2]);
      if (
        Number.isInteger(year) &&
        year >= 1 &&
        year <= 9999 &&
        month >= 1 &&
        month <= 12
      ) {
        return { month, year };
      }
    }
  }

  const month = Number(value);
  return Number.isInteger(month) && month >= 1 && month <= 12
    ? { month }
    : null;
}

function parseAnalyticsYearValue(value: number | string) {
  const year = Number(value);
  return Number.isInteger(year) && year >= 1 && year <= 9999 ? year : null;
}

export const ANALYTICS_INSIGHT_SECTION_OPTIONS: Array<{
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

export const ANALYTICS_INSIGHT_DEPTH_OPTIONS: Array<{
  description: string;
  label: string;
  value: BusinessInsightAnalysisDepth;
}> = [
  {
    description: "A fast signal check with the most important takeaways.",
    label: "Brief",
    value: "brief",
  },
  {
    description: "More context, evidence, and practical next steps.",
    label: "Detailed",
    value: "detailed",
  },
  {
    description: "A deeper cross-section readout for planning decisions.",
    label: "Deep",
    value: "deep",
  },
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
  const [analyticsTimeMode, setAnalyticsTimeMode] = useState<AnalyticsTimeMode>(
    DEFAULT_ANALYTICS_TIME_MODE,
  );
  const [draftTimeMode, setDraftTimeModeState] =
    useState<AnalyticsTimeMode>(DEFAULT_ANALYTICS_TIME_MODE);
  const [draftStartDate, setDraftStartDateState] = useState(
    DEFAULT_ANALYTICS_WINDOW.startDate,
  );
  const [draftEndDate, setDraftEndDateState] = useState(
    DEFAULT_ANALYTICS_WINDOW.endDate,
  );
  const defaultDateParts = getAnalyticsDateParts(DEFAULT_ANALYTICS_WINDOW.endDate);
  const [draftAnchorDate, setDraftAnchorDateState] = useState(
    DEFAULT_ANALYTICS_WINDOW.endDate,
  );
  const [draftMonth, setDraftMonthState] = useState(defaultDateParts.month);
  const [draftYear, setDraftYearState] = useState(defaultDateParts.year);
  const [selectedDrilldown, setSelectedDrilldown] =
    useState<AttendanceDrilldownSelection | null>(null);
  const [generatedInsight, setGeneratedInsight] =
    useState<BusinessInsightRunDetailRecord | null>(null);
  const [selectedInsightSections, setSelectedInsightSections] = useState<
    BusinessInsightFocus[]
  >(["overview"]);
  const [selectedInsightDepth, setSelectedInsightDepth] =
    useState<BusinessInsightAnalysisDepth>("brief");
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [selectedPdfSections, setSelectedPdfSections] = useState<
    AnalyticsPdfSection[]
  >(DEFAULT_PDF_EXPORT_SECTIONS);
  const draftTimeframeDraft: AnalyticsTimeframeDraft = {
    anchorDate: draftAnchorDate,
    endDate: draftEndDate,
    month: draftMonth,
    startDate: draftStartDate,
    year: draftYear,
  };
  const draftTimeframe = resolveAnalyticsTimeframe(
    draftTimeMode,
    draftTimeframeDraft,
  );
  const draftWeekOptions = getAnalyticsWeekOptions(draftYear);

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
      limit: 100,
      page: 1,
    }),
    staleTime: 30_000,
    gcTime: 300_000,
  });
  const latestInsightId = insightHistoryQuery.data?.data[0]?.id;
  const latestInsightQuery = useQuery({
    ...analyticsInsightDetailQueryOptions(webApiClient, latestInsightId),
    enabled: Boolean(latestInsightId),
    staleTime: 30_000,
    gcTime: 300_000,
  });
  const generateInsightMutation = useMutation(
    generateAnalyticsInsightMutationOptions(webApiClient, queryClient),
  );
  const exportPdfMutation = useMutation(
    exportAnalyticsPdfMutationOptions(webApiClient),
  );
  const exportInsightPdfMutation = useMutation(
    exportAnalyticsInsightPdfMutationOptions(webApiClient),
  );

  const snapshot = snapshotQuery.data;
  const overview = overviewQuery.data;
  const revenue = revenueQuery.data;
  const attendance = attendanceQuery.data;
  const latestInsight = generatedInsight ?? latestInsightQuery.data ?? null;
  const latestInsightMatchesWindow = Boolean(
    latestInsight &&
      latestInsight.startDate.slice(0, 10) === analyticsWindow.startDate &&
      latestInsight.endDate.slice(0, 10) === analyticsWindow.endDate &&
      latestInsight.period === analyticsWindow.period,
  );
  const latestInsightIsStale = Boolean(
    latestInsight && !latestInsightMatchesWindow,
  );
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
    if (selectedInsightSections.length === 0) {
      showMessage("Choose at least one insight section.");
      return null;
    }

    try {
      const result = await generateInsightMutation.mutateAsync({
        input: {
          analysisDepth: selectedInsightDepth,
          endDate: analyticsWindow.endDate,
          period: analyticsWindow.period,
          selectedSections: [...selectedInsightSections],
          startDate: analyticsWindow.startDate,
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

  const handleExportPdf = async (): Promise<boolean> => {
    const exportSections = selectedPdfSections;

    if (exportSections.length === 0) {
      showMessage("Choose at least one analytics section to export.");
      return false;
    }


    setIsExportingPdf(true);

    try {
      const result = await exportPdfMutation.mutateAsync({
        attendanceEndDate: analyticsWindow.endDate,
        attendancePeriod: analyticsWindow.period,
        attendanceStartDate: analyticsWindow.startDate,
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

  const handleExportInsightPdf = async (
    insightId: string,
    input?: ExportBusinessInsightPdfInput,
  ): Promise<boolean> => {
    if (!insightId) return false;

    try {
      const result = await exportInsightPdfMutation.mutateAsync({
        insightId,
        input,
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

      showMessage("Saved insight PDF download started.");
      return true;
    } catch {
      showMessage("Couldn't export the saved insight PDF.");
      return false;
    }
  };

  const handleTogglePdfSection = (section: AnalyticsPdfSection) => {
    setSelectedPdfSections((current) =>
      current.includes(section)
        ? current.filter((item) => item !== section)
        : [...current, section],
    );
  };

  const handleToggleInsightSection = (section: BusinessInsightFocus) => {
    setSelectedInsightSections((current) => {
      const next = current.includes(section)
        ? current.filter((item) => item !== section)
        : [...current, section];

      return BUSINESS_INSIGHT_FOCUS_ORDER.filter((item) => next.includes(item));
    });
  };

  const handleSetInsightDepth = (depth: BusinessInsightAnalysisDepth) => {
    if (!BUSINESS_INSIGHT_ANALYSIS_DEPTHS.includes(depth)) return;
    setSelectedInsightDepth(depth);
  };

  const handleSelectAttendancePoint = (bucketStart: string, label: string) => {
    setSelectedDrilldown({ bucketStart, label });
  };

  const handleCloseDrilldown = () => {
    setSelectedDrilldown(null);
  };

  const handleSetDraftTimeMode = (mode: AnalyticsTimeMode) => {
    const anchorDate = getSafeAnalyticsDate(draftEndDate || draftAnchorDate);
    setDraftTimeModeState(mode);

    if (mode === "custom") {
      setDraftAnchorDateState(anchorDate);
      return;
    }

    const nextWindow = resolveAnalyticsTimeframe(mode, { anchorDate });
    if (!nextWindow) return;

    setDraftStartDateState(nextWindow.startDate);
    setDraftEndDateState(nextWindow.endDate);
    setDraftAnchorDateState(nextWindow.startDate);
    const dateParts = getAnalyticsDateParts(nextWindow.startDate);
    setDraftMonthState(dateParts.month);
    setDraftYearState(dateParts.year);
  };

  const handleSetDraftAnchorDate = (date: string) => {
    const anchorDate = getSafeAnalyticsDate(date);
    setDraftAnchorDateState(anchorDate);

    if (draftTimeMode === "custom") return;

    const nextWindow = resolveAnalyticsTimeframe(draftTimeMode, {
      anchorDate,
    });
    if (!nextWindow) return;

    setDraftAnchorDateState(nextWindow.startDate);
    setDraftStartDateState(nextWindow.startDate);
    setDraftEndDateState(nextWindow.endDate);
    const dateParts = getAnalyticsDateParts(nextWindow.startDate);
    setDraftMonthState(dateParts.month);
    setDraftYearState(dateParts.year);
  };

  const handleSetDraftBoundary = (
    boundary: "start" | "end",
    date: string,
  ) => {
    const selectedDate = getSafeAnalyticsDate(date);

    if (draftTimeMode === "custom" || draftTimeMode === "day") {
      if (boundary === "start") {
        setDraftStartDateState(selectedDate);
      } else {
        setDraftEndDateState(selectedDate);
      }
      setDraftAnchorDateState(selectedDate);
      return;
    }

    const nextWindow = resolveAnalyticsTimeframe(draftTimeMode, {
      anchorDate: selectedDate,
    });
    if (!nextWindow) return;

    if (boundary === "start") {
      setDraftStartDateState(nextWindow.startDate);
    } else {
      setDraftEndDateState(nextWindow.endDate);
    }
    setDraftAnchorDateState(nextWindow.startDate);
    const dateParts = getAnalyticsDateParts(nextWindow.startDate);
    setDraftMonthState(dateParts.month);
    setDraftYearState(dateParts.year);
  };

  const handleSetDraftMonth = (value: number | string) => {
    const parsed = parseAnalyticsMonthValue(value);
    if (!parsed) return;

    const year = parsed.year ?? draftYear;
    setDraftMonthState(parsed.month);
    if (parsed.year !== undefined) setDraftYearState(parsed.year);

    if (draftTimeMode !== "month") return;

    const nextWindow = resolveAnalyticsTimeframe("month", {
      anchorDate: `${year}-${String(parsed.month).padStart(2, "0")}-01`,
      month: parsed.month,
      year,
    });
    if (!nextWindow) return;

    setDraftAnchorDateState(nextWindow.startDate);
    setDraftStartDateState(nextWindow.startDate);
    setDraftEndDateState(nextWindow.endDate);
  };

  const handleSetDraftMonthValue = (value: string) => {
    handleSetDraftMonth(value);
  };

  const handleSetDraftYear = (value: number | string) => {
    const year = parseAnalyticsYearValue(value);
    if (year === null) return;

    setDraftYearState(year);
    if (draftTimeMode !== "year" && draftTimeMode !== "month") return;

    const anchorDate =
      draftTimeMode === "year"
        ? `${year}-01-01`
        : `${year}-${String(draftMonth).padStart(2, "0")}-01`;
    const nextWindow = resolveAnalyticsTimeframe(draftTimeMode, {
      anchorDate,
      month: draftMonth,
      year,
    });
    if (!nextWindow) return;

    setDraftAnchorDateState(nextWindow.startDate);
    setDraftStartDateState(nextWindow.startDate);
    setDraftEndDateState(nextWindow.endDate);
  };

  const handleSetDraftWeek = (value: string) => {
    const nextWindow = resolveAnalyticsTimeframe("week", {
      anchorDate: value,
    });
    if (!nextWindow) return;

    setDraftAnchorDateState(nextWindow.startDate);
    setDraftStartDateState(nextWindow.startDate);
    setDraftEndDateState(nextWindow.endDate);
  };

  const handleSetDraftStartDate = (date: string) => {
    handleSetDraftBoundary("start", date);
  };

  const handleSetDraftEndDate = (date: string) => {
    handleSetDraftBoundary("end", date);
  };

  const handleApplyAnalyticsWindow = () => {
    if (!draftStartDate || !draftEndDate) {
      showMessage("Choose both a start and end date.");
      return;
    }

    const nextWindow = resolveAnalyticsTimeframe(
      draftTimeMode,
      draftTimeframeDraft,
    );
    if (!nextWindow) {
      showMessage("Choose a valid analytics timeframe.");
      return;
    }

    setAnalyticsTimeMode(draftTimeMode);
    setAnalyticsWindow(nextWindow);
    setDraftStartDateState(nextWindow.startDate);
    setDraftEndDateState(nextWindow.endDate);
    setDraftAnchorDateState(nextWindow.startDate);
    setGeneratedInsight(null);
    setSelectedDrilldown(null);
    showMessage("Analytics date range applied.");
  };

  const handleResetAnalyticsWindow = () => {
    const dateParts = getAnalyticsDateParts(DEFAULT_ANALYTICS_WINDOW.endDate);
    setAnalyticsTimeMode(DEFAULT_ANALYTICS_TIME_MODE);
    setDraftTimeModeState(DEFAULT_ANALYTICS_TIME_MODE);
    setDraftStartDateState(DEFAULT_ANALYTICS_WINDOW.startDate);
    setDraftEndDateState(DEFAULT_ANALYTICS_WINDOW.endDate);
    setDraftAnchorDateState(DEFAULT_ANALYTICS_WINDOW.endDate);
    setDraftMonthState(dateParts.month);
    setDraftYearState(dateParts.year);
    setAnalyticsWindow(DEFAULT_ANALYTICS_WINDOW);
    setGeneratedInsight(null);
    setSelectedDrilldown(null);
    showMessage("Analytics date range reset.");
  };

  return {
    analyticsWindow,
    analyticsWindowDirty:
      draftTimeMode !== analyticsTimeMode ||
      draftStartDate !== analyticsWindow.startDate ||
      draftEndDate !== analyticsWindow.endDate,
    analyticsTimeMode,
    attendance,
    attendanceFilter: analyticsWindow.period as AnalyticsAttendanceFilter,
    attendanceFilterLabel: analyticsWindow.label,
    attendanceLoading: attendanceQuery.isLoading,
    attendanceSeries,
    attendanceWindow: analyticsWindow,
    draftAnchorDate,
    draftEndDate,
    draftMonth,
    draftMonthValue: `${draftYear}-${String(draftMonth).padStart(2, "0")}`,
    draftStartDate,
    draftTimeMode,
    draftTimeframe: draftTimeframe,
    draftWeek: draftAnchorDate,
    draftWeekOptions,
    draftWeekYear: draftYear,
    draftYear,
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
    handleExportInsightPdf,
    handleGenerateInsight,
    handleResetAnalyticsWindow,
    handleSelectAttendancePoint,
    handleSetInsightDepth,
    handleToggleInsightSection,
    handleTogglePdfSection,
    isExportingPdf: isExportingPdf || exportPdfMutation.isPending,
    isExportingInsightPdf: exportInsightPdfMutation.isPending,
    isGeneratingInsight: generateInsightMutation.isPending,
    insightHistory: insightHistoryQuery.data?.data ?? [],
    insightHistoryLoading: insightHistoryQuery.isLoading,
    latestInsight,
    latestInsightIsFallback,
    latestInsightIsStale,
    latestInsightLoading:
      insightHistoryQuery.isLoading || latestInsightQuery.isLoading,
    message,
    overview,
    overviewLoading: overviewQuery.isLoading,
    pdfExportSectionOptions: PDF_EXPORT_SECTION_OPTIONS,
    analysisDepthOptions: ANALYTICS_INSIGHT_DEPTH_OPTIONS,
    insightSectionOptions: ANALYTICS_INSIGHT_SECTION_OPTIONS,
    visibleActiveMemberCount,
    revenue,
    revenueLoading: revenueQuery.isLoading,
    revenueSeries,
    revenueWindow: analyticsWindow,
    selectedDrilldown,
    selectedPdfSections,
    selectedInsightDepth,
    selectedInsightSections,
    setDraftAnchorDate: handleSetDraftAnchorDate,
    setDraftEndDate: handleSetDraftEndDate,
    setDraftMonth: handleSetDraftMonth,
    setDraftMonthValue: handleSetDraftMonthValue,
    setDraftStartDate: handleSetDraftStartDate,
    setDraftTimeMode: handleSetDraftTimeMode,
    setDraftWeek: handleSetDraftWeek,
    setDraftYear: handleSetDraftYear,
    snapshot,
    snapshotLoading: snapshotQuery.isLoading,
    timeModeOptions: ANALYTICS_TIME_MODE_OPTIONS,
  };
}
