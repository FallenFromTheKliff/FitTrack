"use client";

import { useTheme } from "@/contexts/ThemeContext";
import { useFadeIn } from "@/hooks/animations/useFadeIn";
import { useThemeTransition } from "@/hooks/animations/useThemeTransition";
import { dashboardStyles } from "@/styles/pageStyles";
import { ANALYTICS_REPORT_EXPORT_ID } from "@/app/(admin)/analytics/helpers";
import FitSection from "@/components/fit/FitSection";
import { AnalyticsCoachPerformance } from "@/components/analytics/AnalyticsCoachPerformance";
import { AnalyticsChartsGrid } from "@/components/analytics/AnalyticsChartsGrid";
import { AnalyticsHeaderSection } from "@/components/analytics/AnalyticsHeaderSection";
import { useAnalyticsDashboard } from "@/hooks/analytics/useAnalyticsDashboard";

export function AnalyticsDashboard() {
  const { colors } = useTheme();
  const styles = dashboardStyles(colors);
  const fadeIn = useFadeIn();
  const themeTransition = useThemeTransition();
  const analytics = useAnalyticsDashboard();

  return (
    <FitSection as="section" heading="" hideHeading bare noPadding className={themeTransition} style={fadeIn}>
      <div id={ANALYTICS_REPORT_EXPORT_ID}>
        <AnalyticsHeaderSection
          colors={colors}
          isGeneratingInsight={analytics.isGeneratingInsight}
          membersNewCount={analytics.members?.newMembers ?? null}
          message={analytics.message}
          onExportExcel={analytics.handleExportExcel}
          onGenerateInsight={analytics.handleGenerateInsight}
          onPeriodChange={analytics.setPeriod}
          overviewCheckIns={analytics.overview?.totalCheckIns ?? null}
          overviewCoachingSessions={analytics.overview?.completedCoachingSessions ?? null}
          overviewLoading={analytics.overviewLoading}
          period={analytics.period}
          periodLabel={analytics.periodLabel}
          styles={styles}
          totalRevenue={analytics.revenue?.totals.totalRevenue ?? null}
        />
        <AnalyticsChartsGrid
          attendanceSeries={analytics.attendanceSeries}
          colors={colors}
          latestInsight={analytics.latestInsight}
          periodLabel={analytics.periodLabel}
          pieData={analytics.pieData}
          revenueSeries={analytics.revenueSeries}
        />
        <AnalyticsCoachPerformance coachRows={analytics.coachRows} colors={colors} />
      </div>
    </FitSection>
  );
}
