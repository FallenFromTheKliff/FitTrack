"use client";

import type { ReactNode } from "react";

import { FitSection } from "@/components/fit";
import { useFadeIn } from "@/hooks/animations/useFadeIn";
import { useThemeTransition } from "@/hooks/animations/useThemeTransition";

export default function AccountsPageFrame({ children }: { children: ReactNode }) {
  const fadeIn = useFadeIn();
  const themeTransition = useThemeTransition();

  return (
    <FitSection
      as="section"
      heading=""
      hideHeading
      bare
      noPadding
      className={themeTransition}
      style={{
        ...fadeIn,
        height: "100%",
        marginBottom: 0,
        minHeight: 0,
      }}
    >
      <div
        className="members-shell"
        style={{
          display: "grid",
          gap: 18,
          height: "100%",
          minHeight: 0,
          width: "100%",
        }}
      >
        {children}
      </div>
    </FitSection>
  );
}
