"use client";

import type { ReactNode } from "react";
import type { ThemeColors } from "@fittrack/types";

import { FitText } from "@/components/fit";

import { bookingAmountCardStyle } from "./GymOperationsOverlayShared";

export type OverlayAmountGridItem = {
  helper?: ReactNode;
  label: string;
  value: ReactNode;
  valueColor?: string;
};

export function OverlayAmountGrid({
  colors,
  columns = "repeat(auto-fit, minmax(130px, 1fr))",
  items,
}: {
  colors: ThemeColors;
  columns?: string;
  items: OverlayAmountGridItem[];
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: columns,
        gap: 12,
      }}
    >
      {items.map((item) => (
        <div key={item.label} style={bookingAmountCardStyle(colors)}>
          <FitText
            excludeGlobalScale
            style={{
              fontSize: 10.5,
              fontWeight: 800,
              letterSpacing: 0.7,
              textTransform: "uppercase",
              color: colors.textMuted,
            }}
          >
            {item.label}
          </FitText>
          <FitText
            excludeGlobalScale
            style={{
              fontSize: item.helper ? 20 : 15,
              fontWeight: 900,
              color: item.valueColor ?? colors.textPrimary,
            }}
          >
            {item.value}
          </FitText>
          {item.helper ? (
            <FitText
              excludeGlobalScale
              style={{ fontSize: 11, color: colors.textMuted }}
            >
              {item.helper}
            </FitText>
          ) : null}
        </div>
      ))}
    </div>
  );
}
