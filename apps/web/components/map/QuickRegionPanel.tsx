"use client";

import type { ReactNode } from "react";
import type { ThemeColors, FloorVenueRecord } from "@fittrack/types";
import type { FacilityFloorId } from "@/data/facilities/floorPlans";
type QuickFloorRegionTemplate = Pick<FloorVenueRecord, "name" | "description" | "gridWidth" | "gridHeight"> & { key: string };

import { FitText } from "@/components/fit/FitText";
import FitButton from "@/components/fit/FitButton";

type Props = {
    colors: ThemeColors;
    isCompact: boolean;
    isEditMode: boolean;
    activeFloor: FacilityFloorId;
    authoredRegionCount: number;
    quickRegionTemplates: QuickFloorRegionTemplate[];
    quickPlacementTemplateKey?: string | null;
    selectedRegionName?: string | null;
    showSummaryCard?: boolean;
    onCreateQuickRegion: (template: QuickFloorRegionTemplate) => void;
    onToggleQuickPlacementTemplate: (template: QuickFloorRegionTemplate) => void;
    onOpenVenueManager: () => void;
};

type QuickRegionSummaryProps = {
    colors: ThemeColors;
    authoredRegionCount: number;
    selectedRegionName?: string | null;
    onOpenVenueManager: () => void;
    footerNode?: ReactNode;
};

export function QuickRegionSummaryCard({
    colors,
    authoredRegionCount,
    selectedRegionName,
    onOpenVenueManager,
    footerNode,
}: QuickRegionSummaryProps) {
    return (
        <div
            style={{
                borderRadius: 10,
                border: `1px solid ${colors.border}`,
                backgroundColor: colors.surfaceRaised,
                padding: "10px 12px",
                display: "grid",
                gap: 6,
            }}
        >
            <FitText style={{ fontSize: 12, fontWeight: 700, color: colors.textPrimary }}>
                Authored regions on this floor: {authoredRegionCount}
            </FitText>
            <FitText style={{ fontSize: 12, color: colors.textMuted }}>
                Selected region: {selectedRegionName ?? "None"}
            </FitText>
            <FitText style={{ fontSize: 12, color: colors.textMuted }}>
                Need full venue management (rename, archive, delete)? Open venue management.
            </FitText>
            <FitButton
                variant="ghost"
                label="OPEN VENUE MANAGEMENT"
                onClick={onOpenVenueManager}
                fullWidth
            />
            {footerNode}
        </div>
    );
}

export function QuickRegionPanel({
    colors,
    isCompact,
    isEditMode,
    activeFloor,
    authoredRegionCount,
    quickRegionTemplates,
    quickPlacementTemplateKey,
    selectedRegionName,
    showSummaryCard = true,
    onCreateQuickRegion,
    onToggleQuickPlacementTemplate,
    onOpenVenueManager,
}: Props) {
    return (
        <div
            style={{
                backgroundColor: colors.surface,
                border: `1px solid ${colors.border}`,
                borderRadius: 12,
                padding: 14,
                display: "grid",
                gap: 12,
            }}
        >
            <div style={{ display: "grid", gap: 4 }}>
                <FitText style={{ fontSize: 14, fontWeight: 700, color: colors.textPrimary }}>
                    Quick Floor Regions
                </FitText>
                <FitText style={{ fontSize: 12, color: colors.textMuted }}>
                    Add tile-like support zones to {activeFloor.replace("floor-", "Floor ")}. Click any region on the canvas to open edit controls and reposition mode.
                </FitText>
            </div>

            <div
                style={{
                    display: "grid",
                    gridTemplateColumns: isCompact
                        ? "minmax(0, 1fr)"
                        : "repeat(auto-fit, minmax(260px, 1fr))",
                    gap: 10,
                    alignItems: "stretch",
                    maxHeight: isCompact ? 332 : "none",
                    overflowY: isCompact ? "auto" : "visible",
                    paddingRight: isCompact ? 4 : 0,
                }}
            >
                {quickRegionTemplates.map((template) => (
                    <div
                        key={template.key}
                        style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: 8,
                            borderRadius: 10,
                            border: `1px solid ${colors.border}`,
                            backgroundColor: isEditMode ? colors.surfaceRaised : colors.surface,
                            padding: isCompact ? "9px 10px" : "10px 12px",
                            opacity: isEditMode ? 1 : 0.65,
                            minHeight: isCompact ? "unset" : 192,
                        }}
                    >
                        <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
                            <FitText style={{ fontSize: 13, fontWeight: 700, color: colors.textPrimary }}>
                                {template.name}
                            </FitText>
                            <FitText style={{ fontSize: 11, color: colors.brand }}>
                                {template.gridWidth}x{template.gridHeight}
                            </FitText>
                        </div>
                        <FitText style={{ fontSize: 12, color: colors.textMuted, lineHeight: 1.4, minHeight: isCompact ? "unset" : 50 }}>
                            {template.description}
                        </FitText>
                        <div style={{ display: "grid", gap: 8, marginTop: "auto" }}>
                            <FitButton
                                variant="ghost"
                                label="ADD REGION"
                                onClick={() => onCreateQuickRegion(template)}
                                fullWidth
                                disabled={!isEditMode}
                            />
                            <FitButton
                                variant={quickPlacementTemplateKey === template.key ? "primary" : "ghost"}
                                label={quickPlacementTemplateKey === template.key ? "CANCEL CANVAS PLACE" : "PLACE ON CANVAS"}
                                onClick={() => onToggleQuickPlacementTemplate(template)}
                                fullWidth
                                disabled={!isEditMode}
                            />
                        </div>
                    </div>
                ))}
            </div>

            {showSummaryCard ? (
                <QuickRegionSummaryCard
                    colors={colors}
                    authoredRegionCount={authoredRegionCount}
                    selectedRegionName={selectedRegionName}
                    onOpenVenueManager={onOpenVenueManager}
                />
            ) : null}

            {quickPlacementTemplateKey ? (
                <FitText style={{ fontSize: 12, color: colors.brand }}>
                    Canvas placement is active. Click a floor tile to place the selected template.
                </FitText>
            ) : null}
        </div>
    );
}
