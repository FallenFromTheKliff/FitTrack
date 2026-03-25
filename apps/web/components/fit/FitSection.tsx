"use client";
import type { CSSProperties, ReactNode } from "react";

import { useTheme } from "@/contexts/ThemeContext";
import { cn } from "@/utils/cn";
import { makeFitSectionStyles } from "@/styles/fitStyles";

import { FitText } from "./FitText";

type Props = {
  heading: string;
  children: ReactNode;
  bare?: boolean;
  noPadding?: boolean;
  action?: ReactNode;
  className?: string;
  headingStyle?: CSSProperties;
  hideHeading?: boolean;
  as?: "div" | "section";
  style?: CSSProperties;
};

export default function FitSection({ heading, children, bare = false, noPadding = false, action, className, headingStyle, hideHeading = false, as: Tag = "div", style }: Props) {
  const { colors } = useTheme();
  const s = makeFitSectionStyles(colors);

  const body = noPadding
    ? <>{children}</>
    : bare
      ? <div>{children}</div>
      : <div style={s.card}>{children}</div>;

  return (
    <Tag className={cn(className)} style={{ ...s.section, ...style }}>
      {!hideHeading && (
        <div style={s.headingRow}>
          <FitText as="h4" style={{ ...s.heading, ...headingStyle }}>{heading}</FitText>
          {action ?? null}
        </div>
      )}
      {body}
    </Tag>
  );
}
