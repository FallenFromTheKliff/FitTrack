"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { useLoadingText } from "@fittrack/hooks";

import { useTheme } from "@/contexts/ThemeContext";
import { FitText } from "@/components/fit/FitText";

type Props = {
  isLoading: boolean;
  pageName: string;
  minDurationMs?: number;
  style?: CSSProperties;
};

export default function PageLoadingState({
  isLoading,
  pageName,
  minDurationMs = 1000,
  style,
}: Props) {
  const { colors } = useTheme();
  const [minimumElapsed, setMinimumElapsed] = useState(!isLoading);
  const loadingStartedAtRef = useRef<number | null>(isLoading ? Date.now() : null);
  const isVisible = isLoading || !minimumElapsed;
  const loadingText = useLoadingText(`Loading ${pageName}`, isVisible);

  useEffect(() => {
    if (isLoading) {
      loadingStartedAtRef.current = Date.now();
      setMinimumElapsed(false);
      const timer = window.setTimeout(() => {
        setMinimumElapsed(true);
      }, minDurationMs);

      return () => window.clearTimeout(timer);
    }

    const elapsed = loadingStartedAtRef.current
      ? Date.now() - loadingStartedAtRef.current
      : minDurationMs;
    const remaining = Math.max(0, minDurationMs - elapsed);
    const timer = window.setTimeout(() => {
      loadingStartedAtRef.current = null;
      setMinimumElapsed(true);
    }, remaining);

    return () => window.clearTimeout(timer);
  }, [isLoading, minDurationMs]);

  if (!isVisible) return null;

  return (
    <div
      aria-live="polite"
      role="status"
      style={{
        alignItems: "center",
        backgroundColor: colors.surface,
        borderRadius: 8,
        display: "flex",
        inset: 0,
        justifyContent: "center",
        minHeight: 180,
        padding: 24,
        pointerEvents: "auto",
        position: "absolute",
        textAlign: "center",
        zIndex: 5,
        ...style,
      }}
    >
      <FitText
        excludeGlobalScale
        style={{
          color: colors.textPrimary,
          fontSize: "clamp(30px, 5vw, 64px)",
          fontWeight: 900,
          letterSpacing: 0,
          lineHeight: 1,
        }}
      >
        {loadingText}
      </FitText>
    </div>
  );
}
