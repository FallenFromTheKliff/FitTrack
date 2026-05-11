"use client";

import type { ReactNode } from "react";
import { X } from "lucide-react";

import { FitButton, FitText } from "@/components/fit";
import { FitModal } from "@/components/modals";
import { useTheme } from "@/contexts/ThemeContext";

import { DRAWER_WIDTH } from "./exerciseLabShared";

export function ExerciseLabField({
  children,
  hint,
  label,
}: {
  children: ReactNode;
  hint?: string;
  label: string;
}) {
  const { colors } = useTheme();
  return (
    <label style={{ display: "grid", gap: 8 }}>
      <FitText
        as="span"
        style={{
          fontSize: 10.5,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: colors.textMuted,
        }}
      >
        {label}
      </FitText>
      {children}
      {hint ? (
        <FitText
          as="span"
          style={{ fontSize: 12, color: colors.textSecondary }}
        >
          {hint}
        </FitText>
      ) : null}
    </label>
  );
}

export function ExerciseLabDrawer({
  children,
  isOpen,
  onClose,
  title,
}: {
  children: ReactNode;
  isOpen: boolean;
  onClose: () => void;
  title: string;
}) {
  const { colors } = useTheme();
  return (
    <FitModal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      maxWidth={DRAWER_WIDTH}
      noScroll
      hideHeaderText
      hideCloseButton
      hideHeaderDivider
      headerStyle={{ display: "none" }}
      overlayStyle={{
        alignItems: "stretch",
        justifyContent: "flex-end",
        padding: 0,
        backgroundColor: "rgba(0, 0, 0, 0.45)",
      }}
      containerStyle={{
        width: `min(${DRAWER_WIDTH}px, 92vw)`,
        maxWidth: `min(${DRAWER_WIDTH}px, 92vw)`,
        height: "100vh",
        maxHeight: "100vh",
        borderRadius: 0,
        borderLeft: `1px solid ${colors.border}`,
        backgroundColor: colors.surfaceRaised,
        boxShadow: "-16px 0 40px rgba(0,0,0,0.28)",
      }}
      contentStyle={{
        padding: 0,
        overflow: "hidden",
      }}
    >
      <aside
        style={{
          height: "100%",
          display: "grid",
          gridTemplateRows: "auto 1fr",
          padding: 20,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            paddingBottom: 16,
            borderBottom: `1px solid ${colors.border}`,
          }}
        >
          <FitText style={{ fontSize: 18, fontWeight: 800 }}>{title}</FitText>
          <FitButton
            aria-label="Close drawer"
            icon={X}
            iconOnly
            variant="ghost"
            onClick={onClose}
          />
        </div>
        <div style={{ overflowY: "auto", paddingTop: 16 }}>{children}</div>
      </aside>
    </FitModal>
  );
}
