"use client";

import { FitButton } from "@/components/fit";
import { SURFACE_MODE_OPTIONS } from "@/components/exercise-lab/exerciseLabShared";

import { useExerciseLabPage } from "./ExerciseLabPageContext";

export function ExerciseLabModeNavigation() {
  const { handleModeChange, mode } = useExerciseLabPage();

  return (
    <div
      className="exercise-lab-mode-navigation"
      style={{ display: "flex", gap: 6, flexWrap: "wrap" }}
    >
      {SURFACE_MODE_OPTIONS.map((option) => {
        const isActive = mode === option.value;

        return (
          <FitButton
            key={option.value}
            active={isActive}
            label={option.label}
            variant={isActive ? "primary" : "ghost"}
            onClick={() => handleModeChange(option.value)}
            style={{ minWidth: 76, minHeight: 34, borderRadius: 8, paddingInline: 10 }}
            textStyle={{ fontSize: 12, fontWeight: 800, whiteSpace: "nowrap" }}
          />
        );
      })}
    </div>
  );
}
