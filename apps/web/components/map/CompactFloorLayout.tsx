"use client";
import type { ReactNode } from "react";
import type { ThemeColors } from "@fittrack/types";

import FitButton from "@/components/fit/FitButton";

type Props = {
  colors: ThemeColors;
  isDrawerOpen: boolean;
  drawerButtonWidth: number;
  onToggleDrawer: () => void;
  floorPlanNode: ReactNode;
  drawerNode: ReactNode;
  editorNode: ReactNode;
};

export function CompactFloorLayout({ colors, isDrawerOpen, drawerButtonWidth, onToggleDrawer, floorPlanNode, drawerNode, editorNode }: Props) {
  return (
    <div style={{ display: "grid", gap: 14 }}>
      <div
        style={{
          backgroundColor: colors.surface,
          border: `1px solid ${colors.border}`,
          borderRadius: 16,
          padding: 12,
          position: "relative"
        }}
      >
        <div style={{ display: "flex", alignItems: "stretch", gap: 10 }}>
          <FitButton
            variant="primary"
            label={isDrawerOpen ? "CLOSE" : "RESOURCES"}
            onClick={onToggleDrawer}
            style={{
              minWidth: drawerButtonWidth,
              padding: 0,
              borderRadius: 14,
              height: "auto",
              writingMode: "vertical-rl",
              transform: "rotate(180deg)",
              letterSpacing: "0.18em",
              fontSize: 11
            }}
          />
          <div style={{ flex: 1, minWidth: 0 }}>{floorPlanNode}</div>
        </div>
        <div
          style={{
            position: "absolute",
            top: 12,
            bottom: 12,
            left: drawerButtonWidth + 22,
            width: "min(260px, calc(100% - 72px))",
            backgroundColor: colors.surface,
            border: `1px solid ${colors.border}`,
            borderRadius: 14,
            padding: 12,
            boxShadow: "0 16px 26px rgba(15,23,42,0.16)",
            display: "flex",
            flexDirection: "column",
            gap: 10,
            transform: isDrawerOpen ? "translateX(0)" : "translateX(-110%)",
            opacity: isDrawerOpen ? 1 : 0,
            pointerEvents: isDrawerOpen ? "auto" : "none",
            transition: "transform 220ms ease, opacity 220ms ease",
            zIndex: 4
          }}
        >
          <div style={{ display: "grid", gap: 10, overflowY: "auto", paddingRight: 4 }}>
            {drawerNode}
          </div>
        </div>
      </div>
      {editorNode}
    </div>
  );
}