"use client";

import type { CSSProperties, ReactNode } from "react";
import { Dumbbell } from "lucide-react";

import { FitText } from "@/components/fit";
import { FitModal } from "@/components/modals";
import { useTheme } from "@/contexts/ThemeContext";

import { DRAWER_WIDTH } from "./exerciseLabShared";

export function ExerciseLabField({
  children,
  error,
  hint,
  label,
  labelStyle,
  required = false,
}: {
  children: ReactNode;
  error?: string | null;
  hint?: string;
  label: string;
  labelStyle?: CSSProperties;
  required?: boolean;
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
          ...labelStyle,
        }}
      >
        {label}
        {required ? (
          <span aria-hidden="true" style={{ color: colors.brand, marginLeft: 4 }}>
            *
          </span>
        ) : null}
      </FitText>
      {children}
      {error ? (
        <FitText
          aria-live="polite"
          as="span"
          style={{ fontSize: 12, color: colors.danger, fontWeight: 700 }}
        >
          {error}
        </FitText>
      ) : null}
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
      icon={Dumbbell}
      maxWidth={DRAWER_WIDTH}
      noScroll
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
        padding: 20,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          height: "100%",
          overflowY: "auto",
        }}
      >
        {children}
      </div>
    </FitModal>
  );
}
