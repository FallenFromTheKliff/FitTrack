"use client";

import type { ReactNode } from "react";

import { FitSection } from "@/components/fit";
import { useFadeIn } from "@/hooks/animations/useFadeIn";
import { useThemeTransition } from "@/hooks/animations/useThemeTransition";

import { useAccountsPage } from "./AccountsPageContext";

export default function AccountsPageFrame({ children }: { children: ReactNode }) {
  const { isCreateMode } = useAccountsPage();
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
      style={fadeIn}
    >
      <div
        className={isCreateMode ? "members-shell members-shell-create" : "members-shell"}
        style={{
          display: "grid",
          gap: isCreateMode ? 0 : 18,
          width: "100%",
        }}
      >
        {children}
      </div>
    </FitSection>
  );
}
