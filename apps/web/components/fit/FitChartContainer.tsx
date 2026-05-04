"use client";
import type { CSSProperties, ReactNode } from "react";
import { ResponsiveContainer } from "recharts";

import { useTheme } from "@/contexts/ThemeContext";
import FitSection from "./FitSection";
import { FitText } from "./FitText";

type Props = {
  heading?: string;
  subtitle?: ReactNode;
  children: ReactNode;
  height?: number | string;
  width?: number | string;
  minWidth?: number;
  minHeight?: number;
  aspect?: number;
  initialDimension?: {
    width: number;
    height: number;
  };
  sectionClassName?: string;
  chartStyle?: CSSProperties;
  contentPadding?: string;
  action?: ReactNode;
  bare?: boolean;
  hideHeading?: boolean;
  noPadding?: boolean;
};

export default function FitChartContainer({
  heading = "Chart",
  subtitle,
  children,
  height = 220,
  width = "100%",
  minWidth,
  minHeight,
  aspect,
  initialDimension,
  sectionClassName,
  chartStyle,
  contentPadding = "20px 16px 10px",
  action,
  bare = false,
  hideHeading = false,
  noPadding = false
}: Props) {
  const { colors } = useTheme();

  return (
    <FitSection heading={heading} className={sectionClassName} bare={bare} action={action} hideHeading={hideHeading} noPadding={noPadding}>
      <div style={{ padding: contentPadding }}>
        {subtitle ? (
          <div style={{ marginBottom: 10 }}>
            {typeof subtitle === "string" ? <FitText style={{ fontSize: 11, color: colors.textMuted }}>{subtitle}</FitText> : subtitle}
          </div>
        ) : null}
        <div style={{ width: typeof width === "number" ? `${width}px` : width, height, ...chartStyle }}>
          <ResponsiveContainer width="100%" height="100%" minWidth={minWidth} minHeight={minHeight} aspect={aspect} initialDimension={initialDimension}>
            {children}
          </ResponsiveContainer>
        </div>
      </div>
    </FitSection>
  );
}
