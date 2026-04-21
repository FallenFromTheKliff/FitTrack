"use client";

import { Activity, Bot, Download, DollarSign, TrendingUp, Users } from "lucide-react";

import type { IThemeContext } from "@fittrack/types";
import { ANALYTICS_PERIOD_OPTIONS } from "@/data/charts/analytics";
import { FitText } from "@/components/fit/FitText";
import FitButton from "@/components/fit/FitButton";
import FitSection from "@/components/fit/FitSection";
import { FitSelect } from "@/components/fit/FitCard";
import { dashboardStyles } from "@/styles/pageStyles";
import { formatCompactMoney } from "@/app/(admin)/analytics/helpers";

type AnalyticsHeaderSectionProps = {
  colors: IThemeContext["colors"];
  isGeneratingInsight: boolean;
  membersNewCount: number | null;
  message: string | null;
  onExportExcel: () => void;
  onGenerateInsight: () => void | Promise<void>;
  onPeriodChange: (period: string) => void;
  overviewCheckIns: number | null;
  overviewCoachingSessions: number | null;
  overviewLoading: boolean;
  period: string;
  periodLabel: string;
  styles: ReturnType<typeof dashboardStyles>;
  totalRevenue: number | null;
};

export function AnalyticsHeaderSection({
  colors,
  isGeneratingInsight,
  membersNewCount,
  message,
  onExportExcel,
  onGenerateInsight,
  onPeriodChange,
  overviewCheckIns,
  overviewCoachingSessions,
  overviewLoading,
  period,
  periodLabel,
  styles,
  totalRevenue
}: AnalyticsHeaderSectionProps) {
  const kpis = [
    {
      colorKey: "success" as const,
      delta: periodLabel,
      icon: DollarSign,
      label: "Total Revenue",
      value: totalRevenue !== null ? formatCompactMoney(totalRevenue) : "--"
    },
    {
      colorKey: "brand" as const,
      delta: "Live",
      icon: Users,
      label: "New Members",
      value: membersNewCount !== null ? String(membersNewCount) : "--"
    },
    {
      colorKey: "textSecondary" as const,
      delta: "Live",
      icon: Activity,
      label: "Check-Ins",
      value: overviewCheckIns !== null ? String(overviewCheckIns) : "--"
    },
    {
      colorKey: "success" as const,
      delta: "Live",
      icon: TrendingUp,
      label: "Coaching Sessions",
      value: overviewCoachingSessions !== null ? String(overviewCoachingSessions) : "--"
    }
  ];

  return (
    <>
      {message ? (
        <div style={{ marginBottom: 12, display: "flex", justifyContent: "flex-end" }}>
          <FitText style={{ fontSize: 13, color: colors.success, fontWeight: 500 }}>{message}</FitText>
        </div>
      ) : null}
      <FitSection
        heading="Performance KPIs"
        bare
        action={(
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <FitSelect
              compact
              value={period}
              onChange={(event) => onPeriodChange(event.target.value)}
              options={ANALYTICS_PERIOD_OPTIONS}
            />
            <FitButton
              variant="ghost"
              label="EXPORT EXCEL"
              icon={Download}
              iconSize={14}
              onClick={onExportExcel}
            />
            <FitButton
              variant="ghost"
              label={isGeneratingInsight ? "GENERATING" : "GENERATE INSIGHT"}
              icon={Bot}
              iconSize={14}
              onClick={() => { void onGenerateInsight(); }}
              disabled={isGeneratingInsight}
            />
          </div>
        )}
      >
        <div style={styles.kpiGrid}>
          {kpis.map((item) => (
            <div key={item.label} style={styles.kpiCard}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={styles.kpiIconWrap}><item.icon size={18} color={colors[item.colorKey]} /></div>
                <FitText style={{ fontSize: 12, fontWeight: 600, color: colors.success }}>{item.delta}</FitText>
              </div>
              <FitText as="p" style={{ fontSize: 12, color: colors.textMuted, marginTop: 12 }}>{item.label}</FitText>
              <FitText as="p" style={{ fontSize: 24, fontWeight: 700, marginTop: 2 }}>
                {overviewLoading ? "--" : item.value}
              </FitText>
            </div>
          ))}
        </div>
      </FitSection>
    </>
  );
}
