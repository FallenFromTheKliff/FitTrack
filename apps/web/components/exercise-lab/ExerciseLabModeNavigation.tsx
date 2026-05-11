"use client";

import { FitButton } from "@/components/fit";
import { SURFACE_MODE_OPTIONS } from "@/components/exercise-lab/exerciseLabShared";

import { useExerciseLabPage } from "./ExerciseLabPageContext";

export function ExerciseLabModeNavigation() {
  const { handleModeChange, mode } = useExerciseLabPage();

  return (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
      {SURFACE_MODE_OPTIONS.map((option) => {
        const isActive = mode === option.value;

        return (
          <FitButton
            key={option.value}
            active={isActive}
            label={option.label}
            variant={isActive ? "primary" : "ghost"}
            onClick={() => handleModeChange(option.value)}
            style={{ minWidth: 72, minHeight: 34, borderRadius: 8 }}
          />
        );
      })}
    </div>
  );
}
