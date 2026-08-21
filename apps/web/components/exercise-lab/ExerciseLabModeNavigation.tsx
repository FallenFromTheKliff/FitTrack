"use client";

import { SURFACE_MODE_OPTIONS } from "@/components/exercise-lab/exerciseLabShared";

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
        display: "flex",
        gap: 6,
        flexWrap: "wrap",
      }}
    >
      {SURFACE_MODE_OPTIONS.map((option) => {
        const isActive = mode === option.value;
        return (
          <button
            key={option.value}
            aria-selected={isActive}
            role="tab"
            type="button"
            onClick={() => handleModeChange(option.value)}
            style={{
              alignItems: "center",
              appearance: "none",
              backgroundColor: isActive ? colors.brand : colors.surface,
              border: `1px solid ${
                isActive ? colors.brand : colors.border
              }`,
              borderRadius: 6,
              color: isActive ? colors.onBrand : colors.textPrimary,
              cursor: "pointer",
              display: "inline-flex",
              fontFamily: "inherit",
              fontSize: 12,
              fontWeight: 850,
              gap: 8,
              justifyContent: "center",
              minHeight: 36,
              minWidth: 120,
              padding: "7px 14px",
              transition:
                "background-color 150ms ease, border-color 150ms ease, color 150ms ease",
              whiteSpace: "nowrap",
            }}
          >
            <span>{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}
