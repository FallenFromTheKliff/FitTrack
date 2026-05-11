"use client";
import { useEffect, useState } from "react";
import { useLoadingText } from "@fittrack/hooks";

import { useTheme } from "@/contexts/ThemeContext";
import { FitText } from "@/components/fit/FitText";

type Props = {
  onCommit: () => Promise<unknown>;
  onDone: (result: unknown) => void;
};

export default function BufferPage({ onCommit, onDone }: Props) {
  const { colors } = useTheme();
  const [opacity, setOpacity] = useState(0);
  const loadingText = useLoadingText("Preparing portal", true);

  useEffect(() => {
    let cancelled = false;
    const fadeIn = requestAnimationFrame(() => setOpacity(1));

    const run = async () => {
      const [commitResult] = await Promise.all([
        onCommit(),
        new Promise((resolve) => setTimeout(resolve, 1000)),
      ]);
      await new Promise((resolve) => requestAnimationFrame(resolve));

      if (!cancelled) {
        onDone(commitResult);
      }
    };

    void run();

    return () => {
      cancelled = true;
      cancelAnimationFrame(fadeIn);
    };
  }, [onCommit, onDone]);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: colors.base,
        color: colors.textPrimary,
        display: "grid",
        placeItems: "center",
        zIndex: 9999,
        opacity,
        transition: "opacity 180ms ease",
      }}
    >
      <FitText
        excludeGlobalScale
        style={{
          color: colors.textPrimary,
          fontSize: "clamp(32px, 6vw, 72px)",
          fontWeight: 900,
          letterSpacing: 0,
          lineHeight: 1,
          textAlign: "center",
        }}
      >
        {loadingText}
      </FitText>
    </div>
  );
}
