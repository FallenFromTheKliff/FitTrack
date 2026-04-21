"use client";

import type { AnalyticsCoachBreakdownRecord, IThemeContext } from "@fittrack/types";

import { FitText } from "@/components/fit/FitText";
import FitSection from "@/components/fit/FitSection";
import { formatCompactMoney } from "@/app/(admin)/analytics/helpers";

type AnalyticsCoachPerformanceProps = {
  coachRows: AnalyticsCoachBreakdownRecord[];
  colors: IThemeContext["colors"];
};

export function AnalyticsCoachPerformance({
  coachRows,
  colors
}: AnalyticsCoachPerformanceProps) {
  return (
    <FitSection heading="Coach Performance" className="mb-0" style={{ marginTop: 14 }}>
      <div style={{ display: "grid", gap: 10 }}>
        {coachRows.length === 0 ? (
          <FitText style={{ fontSize: 14, color: colors.textMuted }}>
            No completed coach revenue was returned for the selected period yet.
          </FitText>
        ) : coachRows.map((coach) => (
          <div
            key={coach.coachId}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              border: `1px solid ${colors.border}`,
              borderRadius: 14,
              padding: "12px 14px"
            }}
          >
            <div>
              <FitText style={{ fontSize: 14, fontWeight: 600 }}>
                {[coach.firstName, coach.lastName].filter(Boolean).join(" ") || "Coach"}
              </FitText>
              <FitText style={{ fontSize: 12, color: colors.textMuted }}>
                {coach.completedSessions} completed session{coach.completedSessions === 1 ? "" : "s"}
              </FitText>
            </div>
            <div style={{ textAlign: "right" }}>
              <FitText style={{ fontSize: 13, fontWeight: 600 }}>{formatCompactMoney(coach.totalBilled)}</FitText>
              <FitText style={{ fontSize: 12, color: colors.textMuted }}>
                Gym cut {formatCompactMoney(coach.gymCut)}
              </FitText>
            </div>
          </div>
        ))}
      </div>
    </FitSection>
  );
}
