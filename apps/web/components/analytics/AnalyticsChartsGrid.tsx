"use client";

import { Activity, Bot, DollarSign, Users } from "lucide-react";
import { Bar, BarChart, Cell, Pie, PieChart, Tooltip, XAxis, YAxis } from "recharts";

import type {
  BusinessInsightRunDetailRecord,
  IThemeContext
} from "@fittrack/types";
import FitChartContainer from "@/components/fit/FitChartContainer";
import FitSection from "@/components/fit/FitSection";
import { FitText } from "@/components/fit/FitText";
import { formatCompactMoney, getAnalyticsPieColors } from "@/app/(admin)/analytics/helpers";

type AnalyticsPieEntry = {
  name: string;
  value: number;
};

type AnalyticsChartsGridProps = {
  attendanceSeries: Array<{ checkIns: number; day: string }>;
  colors: IThemeContext["colors"];
  latestInsight: BusinessInsightRunDetailRecord | null | undefined;
  periodLabel: string;
  pieData: AnalyticsPieEntry[];
  revenueSeries: Array<{ bucket: string; gymShare: number; totalRevenue: number }>;
};

export function AnalyticsChartsGrid({
  attendanceSeries,
  colors,
  latestInsight,
  periodLabel,
  pieData,
  revenueSeries
}: AnalyticsChartsGridProps) {
  const pieColors = getAnalyticsPieColors(colors);

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginTop: 14 }}>
      <FitChartContainer
        heading="Revenue vs Gym Share"
        subtitle={periodLabel}
        action={<DollarSign size={14} color={colors.brand} />}
        sectionClassName="mb-0"
        chartStyle={{ height: 220 }}
      >
        <BarChart data={revenueSeries}>
          <XAxis dataKey="bucket" stroke={colors.textMuted} tick={{ fontSize: 11 }} />
          <YAxis stroke={colors.textMuted} tick={{ fontSize: 11 }} />
          <Tooltip contentStyle={{ backgroundColor: colors.surface, border: `1px solid ${colors.border}`, borderRadius: 8 }} />
          <Bar dataKey="gymShare" fill={colors.textSecondary} radius={[4, 4, 0, 0]} />
          <Bar dataKey="totalRevenue" fill={colors.brand} radius={[4, 4, 0, 0]} />
        </BarChart>
      </FitChartContainer>

      <FitSection heading="Revenue Distribution" action={<Users size={14} color={colors.brand} />} className="mb-0">
        <div style={{ display: "flex", alignItems: "center", gap: 16, padding: "20px 16px 10px" }}>
          <div style={{ width: "60%", height: 220 }}>
            <FitChartContainer heading="" bare noPadding hideHeading contentPadding="0" chartStyle={{ height: 220 }}>
              <PieChart>
                <Pie data={pieData} dataKey="value" innerRadius={45} outerRadius={80}>
                  {pieData.map((_, index) => <Cell key={index} fill={pieColors[index] ?? colors.brand} />)}
                </Pie>
                <Tooltip contentStyle={{ backgroundColor: colors.surface, border: `1px solid ${colors.border}`, borderRadius: 8 }} />
              </PieChart>
            </FitChartContainer>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {pieData.map((entry, index) => (
              <div key={entry.name} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: pieColors[index] ?? colors.brand }} />
                <FitText style={{ fontSize: 12, color: colors.textMuted }}>{entry.name}</FitText>
                <FitText style={{ fontSize: 12, fontWeight: 600 }}>{formatCompactMoney(entry.value)}</FitText>
              </div>
            ))}
          </div>
        </div>
      </FitSection>

      <FitChartContainer
        heading="Daily Attendance"
        subtitle="Last 7 days"
        action={<Activity size={14} color={colors.brand} />}
        sectionClassName="mb-0"
        chartStyle={{ height: 200 }}
      >
        <BarChart data={attendanceSeries}>
          <XAxis dataKey="day" stroke={colors.textMuted} tick={{ fontSize: 11 }} />
          <YAxis stroke={colors.textMuted} tick={{ fontSize: 11 }} />
          <Tooltip contentStyle={{ backgroundColor: colors.surface, border: `1px solid ${colors.border}`, borderRadius: 8 }} />
          <Bar dataKey="checkIns" fill={colors.brand} radius={[4, 4, 0, 0]} />
        </BarChart>
      </FitChartContainer>

      <FitSection heading="Latest Business Insight" action={<Bot size={14} color={colors.brand} />} className="mb-0">
        <div style={{ padding: "18px 16px 8px", display: "flex", flexDirection: "column", gap: 10 }}>
          <FitText style={{ fontSize: 13, color: colors.textMuted }}>
            {latestInsight
              ? `${latestInsight.focus} - ${latestInsight.period} - ${new Date(latestInsight.createdAt).toLocaleString()}`
              : "No live insight has been generated yet."}
          </FitText>
          <FitText style={{ fontSize: 15, lineHeight: 1.6 }}>
            {latestInsight?.summary ?? "Generate an insight to surface the latest AI-backed business summary."}
          </FitText>
          {latestInsight?.recommendedActions?.length ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {latestInsight.recommendedActions.slice(0, 3).map((action) => (
                <FitText key={action} style={{ fontSize: 13, color: colors.textMuted }}>
                  - {action}
                </FitText>
              ))}
            </div>
          ) : null}
        </div>
      </FitSection>
    </div>
  );
}
