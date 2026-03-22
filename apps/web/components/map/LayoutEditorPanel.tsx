"use client";
import { Download, Lock, LockOpen, RotateCcw, Save } from "lucide-react";
import type { ChangeEvent } from "react";

import type { ThemeColors } from "@fittrack/types";

import { FitText, FitTextInput } from "@/components/fit/FitText";
import FitButton from "@/components/fit/FitButton";
import { FitSelect } from "@/components/fit/FitCard";

type Props = {
  colors: ThemeColors;
  isCompact: boolean;
  isEditMode: boolean;
  hasUnsavedChanges: boolean;
  layoutName: string;
  layoutType: string;
  gridSize: string;
  onToggleEditMode: () => void;
  onLayoutNameChange: (value: string) => void;
  onLayoutTypeChange: (e: ChangeEvent<HTMLSelectElement>) => void;
  onGridSizeChange: (e: ChangeEvent<HTMLSelectElement>) => void;
  onSave: () => void;
  onClearFloor: () => void;
  onExport: () => void;
};

export function LayoutEditorPanel({
  colors,
  isCompact,
  isEditMode,
  hasUnsavedChanges,
  layoutName,
  layoutType,
  gridSize,
  onToggleEditMode,
  onLayoutNameChange,
  onLayoutTypeChange,
  onGridSizeChange,
  onSave,
  onClearFloor,
  onExport
}: Props) {
  return (
    <div
      style={{
        backgroundColor: colors.surface,
        border: `1px solid ${colors.border}`,
        borderRadius: isCompact ? 16 : 12,
        padding: isCompact ? 18 : 14,
        display: "grid",
        gap: 10
      }}
    >
      <FitButton
        variant={isEditMode ? "primary" : "ghost"}
        label={isEditMode ? "EDIT MODE: ON" : "EDIT MODE: OFF"}
        icon={isEditMode ? LockOpen : Lock}
        onClick={onToggleEditMode}
        fullWidth
      />
      <div style={{ height: 1, backgroundColor: colors.border, margin: "2px 0 4px" }} />
      <div>
        <FitText as="label" style={{ fontSize: 13, color: colors.textMuted, marginBottom: 7, display: "block" }}>
          Layout Name
          <FitText as="span" style={{ color: colors.danger, marginLeft: 2 }}>*</FitText>
        </FitText>
        <FitTextInput
          value={layoutName}
          onChange={(e) => {
            if (!isEditMode) return;
            onLayoutNameChange(e.target.value);
          }}
          placeholder="e.g., Main Floor Plan"
          disabled={!isEditMode}
          style={{
            width: "100%",
            borderRadius: 8,
            border: `1px solid ${colors.fieldBorder}`,
            backgroundColor: colors.fieldBg,
            color: colors.textPrimary,
            height: 40,
            padding: "0 12px",
            fontSize: 14,
            outline: "none",
            opacity: isEditMode ? 1 : 0.65,
            cursor: isEditMode ? "text" : "not-allowed"
          }}
        />
      </div>
      <div>
        <FitText as="label" style={{ fontSize: 13, color: colors.textMuted, marginBottom: 7, display: "block" }}>
          Layout Type
        </FitText>
        <FitSelect
          fullWidth
          compact
          value={layoutType}
          onChange={(e) => {
            if (!isEditMode) return;
            onLayoutTypeChange(e);
          }}
          disabled={!isEditMode}
          options={[
            { label: "Custom Layout", value: "custom" },
            { label: "Strength Focus", value: "strength" },
            { label: "Cardio Focus", value: "cardio" }
          ]}
          style={{ height: 40, fontSize: 14 }}
        />
      </div>
      <div>
        <FitText as="label" style={{ fontSize: 13, color: colors.textMuted, marginBottom: 7, display: "block" }}>
          Grid Size
        </FitText>
        <FitSelect
          fullWidth
          compact
          value={gridSize}
          onChange={(e) => {
            if (!isEditMode) return;
            onGridSizeChange(e);
          }}
          disabled={!isEditMode}
          options={[
            { label: "Small Grid (30px)", value: "30" },
            { label: "Medium Grid (40px)", value: "40" },
            { label: "Large Grid (50px)", value: "50" }
          ]}
          style={{ height: 40, fontSize: 14 }}
        />
      </div>
      <FitButton
        variant="primary"
        label="Save Layout"
        icon={Save}
        onClick={onSave}
        fullWidth
        disabled={!isEditMode || !hasUnsavedChanges}
      />
      <FitButton
        variant="ghost"
        label="Clear Floor"
        icon={RotateCcw}
        onClick={onClearFloor}
        fullWidth
        disabled={!isEditMode}
      />
      <FitButton
        variant="ghost"
        label="Export"
        icon={Download}
        onClick={onExport}
        fullWidth
        disabled={!isEditMode}
      />
      {!isEditMode && (
        <FitText style={{ fontSize: 12, color: colors.textMuted }}>
          Turn on EDIT MODE to unlock layout controls and dragging.
        </FitText>
      )}
      {isEditMode && hasUnsavedChanges && (
        <FitText style={{ fontSize: 12, color: colors.brand }}>
          You have unsaved layout changes.
        </FitText>
      )}
    </div>
  );
}