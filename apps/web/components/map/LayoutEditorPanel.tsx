"use client";
import { ArchiveRestore, Lock, LockOpen, RotateCcw, Save } from "lucide-react";
import type { ReactNode } from "react";
import type { ChangeEvent } from "react";

import type { ThemeColors } from "@fittrack/types";
import type { FacilityFloorId } from "@/data/facilities/floorPlans";

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
  activeFloor: FacilityFloorId;
  onToggleEditMode: () => void;
  onLayoutNameChange: (value: string) => void;
  onLayoutTypeChange: (e: ChangeEvent<HTMLSelectElement>) => void;
  onFloorChange: (e: ChangeEvent<HTMLSelectElement>) => void;
  onSave: () => void;
  onClearFloor: () => void;
  onOpenArchive?: () => void;
  quickRegionNode?: ReactNode;
  quickRegionSummaryNode?: ReactNode;
  layoutStatusNode?: ReactNode;
  equipmentPanelNode?: ReactNode;
};

export function LayoutEditorPanel({
  colors,
  isCompact,
  isEditMode,
  hasUnsavedChanges,
  layoutName,
  layoutType,
  activeFloor,
  onToggleEditMode,
  onLayoutNameChange,
  onLayoutTypeChange,
  onFloorChange,
  onSave,
  onClearFloor,
  onOpenArchive,
  quickRegionNode,
  quickRegionSummaryNode,
  layoutStatusNode,
  equipmentPanelNode
}: Props) {
  const hasExtendedSections =
    Boolean(quickRegionNode) ||
    Boolean(quickRegionSummaryNode) ||
    Boolean(layoutStatusNode) ||
    Boolean(equipmentPanelNode);

  return (
    <div
      style={{
        backgroundColor: colors.surface,
        border: `1px solid ${colors.border}`,
        borderRadius: isCompact ? 16 : 12,
        padding: isCompact ? 18 : 16,
        display: "grid",
        gap: isCompact ? 12 : 10,
        minWidth: 0,
        maxHeight: isCompact ? "none" : "calc(100vh - 166px)",
        overflowY: isCompact ? "visible" : "auto",
        paddingRight: isCompact ? 18 : 12,
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
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 10 }}>
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
            style={{ height: 40, fontSize: 14, minWidth: 0 }}
          />
        </div>
        <div>
          <FitText as="label" style={{ fontSize: 13, color: colors.textMuted, marginBottom: 7, display: "block" }}>
            Floor Level
          </FitText>
          <FitSelect
            fullWidth
            compact
            value={activeFloor}
            onChange={(e) => {
              if (!isEditMode) return;
              onFloorChange(e);
            }}
            disabled={!isEditMode}
            options={[
              { label: "Floor 1", value: "floor-1" },
              { label: "Floor 2", value: "floor-2" },
              { label: "Floor 3", value: "floor-3" }
            ]}
            style={{ height: 40, fontSize: 14, minWidth: 0 }}
          />
        </div>
      </div>
      <FitButton
        variant="primary"
        label={hasUnsavedChanges ? "Save Layout" : "Live Sync Enabled"}
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
      {onOpenArchive ? (
        <FitButton
          variant="ghost"
          label="Manage Archive"
          icon={ArchiveRestore}
          onClick={onOpenArchive}
          fullWidth
        />
      ) : null}
      {hasExtendedSections ? (
        <>
          <div style={{ height: 1, backgroundColor: colors.border, margin: "2px 0 4px" }} />
          {quickRegionNode}
          {quickRegionSummaryNode || layoutStatusNode || equipmentPanelNode ? (
            <div style={{ height: 1, backgroundColor: colors.border, margin: "2px 0 4px" }} />
          ) : null}
          {quickRegionSummaryNode}
          {layoutStatusNode}
          {equipmentPanelNode}
        </>
      ) : null}
      <div style={{ height: 1, backgroundColor: colors.border, margin: "2px 0 4px" }} />
      <FitText style={{ fontSize: 12, color: colors.textMuted, lineHeight: 1.5 }}>
        Floor-region authoring is live inside the current three-floor model. True add or delete floor support still needs a shared schema upgrade because the published floor IDs are fixed today.
      </FitText>
      {!isEditMode && (
        <FitText style={{ fontSize: 12, color: colors.textMuted }}>
          Turn on EDIT MODE to unlock layout controls and dragging.
        </FitText>
      )}
      {isEditMode && !hasUnsavedChanges && (
        <FitText style={{ fontSize: 12, color: colors.textMuted }}>
          Live sync is active. Equipment assignments save immediately.
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
