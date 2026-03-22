"use client";
import type { ThemeColors } from "@fittrack/types";

import { FitText } from "@/components/fit/FitText";

type Props = {
  colors: ThemeColors;
  panelPadding: number;
  placedCount: number;
  gridSize: string;
};

export function LayoutStatusPanel({ colors, panelPadding, placedCount, gridSize }: Props) {
  return (
    <div
      style={{
        backgroundColor: colors.surface,
        border: `1px solid ${colors.border}`,
        borderRadius: 12,
        padding: panelPadding
      }}
    >
      <FitText style={{ fontSize: 13, fontWeight: 700, marginBottom: 12, display: "block" }}>
        Layout Status
      </FitText>
      <div style={{ display: "grid", gap: 8 }}>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <FitText style={{ fontSize: 13, color: colors.textMuted }}>Equipment Placed</FitText>
          <FitText style={{ fontSize: 13, fontWeight: 600 }}>{placedCount}</FitText>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <FitText style={{ fontSize: 13, color: colors.textMuted }}>Grid Size</FitText>
          <FitText style={{ fontSize: 13, fontWeight: 600 }}>{gridSize}px</FitText>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <FitText style={{ fontSize: 13, color: colors.textMuted }}>Status</FitText>
          <FitText style={{ fontSize: 13, fontWeight: 700, color: colors.success }}>Saved</FitText>
        </div>
      </div>
    </div>
  );
}