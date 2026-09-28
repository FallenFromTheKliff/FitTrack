"use client";

import { SURFACE_MODE_OPTIONS } from "@/components/exercise-lab/exerciseLabShared";
import { Layers3, Target } from "lucide-react";

import { useExerciseLabPage } from "./ExerciseLabPageContext";

export function ExerciseLabModeNavigation() {
  const { colors, handleModeChange, mode } = useExerciseLabPage();

  return (
    <div
      className="exercise-lab-mode-navigation"
      aria-label="Exercise Lab sections"
      role="tablist"
      style={{
        alignItems: "stretch",
        borderBottom: `1px solid ${colors.border}`,
        display: "flex",
        gap: 2,
        minWidth: 0,
        overflowX: "auto",
        width: "100%",
      }}
    >
      {SURFACE_MODE_OPTIONS.map((option) => {
        const isActive = mode === option.value;
        const Icon = option.value === "library" ? Layers3 : Target;
        return (
          <button
            key={option.value}
            aria-selected={isActive}
            className="exercise-lab-mode-tab"
            role="tab"
            type="button"
            onClick={() => handleModeChange(option.value)}
            style={{
              alignItems: "center",
              appearance: "none",
              backgroundColor: "transparent",
              border: "none",
              borderBottom: `2px solid ${
                isActive ? colors.brand : "transparent"
              }`,
              color: isActive ? colors.textPrimary : colors.textSecondary,
              cursor: "pointer",
              display: "inline-flex",
              fontFamily: "inherit",
              fontSize: 13,
              fontWeight: isActive ? 800 : 650,
              gap: 7,
              justifyContent: "flex-start",
              minHeight: 40,
              minWidth: 132,
              padding: "7px 12px 6px",
              transition:
                "border-color 150ms ease, color 150ms ease",
              whiteSpace: "nowrap",
            }}
          >
            <Icon aria-hidden="true" size={16} strokeWidth={2.25} />
            <span>{option.label}</span>
          </button>
        );
      })}
      <style>{`
        .exercise-lab-mode-tab:focus-visible {
          outline: 2px solid ${colors.brand};
          outline-offset: -2px;
        }

        @media (max-width: 900px) {
          .exercise-lab-mode-tab {
            min-height: 44px !important;
          }
        }
      `}</style>
    </div>
  );
}
