"use client";

import { useEffect, useRef, useState } from "react";
import { Palette } from "lucide-react";
import * as SwitchPrimitive from "@radix-ui/react-switch";
import { themes, THEME_LABELS } from "@fittrack/ui/theme";
import type { FontKey, ThemeKey } from "@fittrack/types";
import { getReadableTextColor } from "@fittrack/utils";

import { useTheme } from "@/contexts/ThemeContext";
import FitButton from "@/components/fit/FitButton";
import FitPill from "@/components/fit/FitPill";
import FitSection from "@/components/fit/FitSection";
import { FitText } from "@/components/fit/FitText";

import {
  FONT_KEYS,
  STATIC_FONT_PREVIEW_FAMILY,
  STATIC_FONT_PREVIEW_TEXT,
  THEME_KEYS
} from "./helpers";

function CurvyToggle({
  checked,
  label,
  onCheckedChange
}: {
  checked: boolean;
  label: string;
  onCheckedChange: (next: boolean) => void;
}) {
  const { colors } = useTheme();

  return (
    <SwitchPrimitive.Root
      checked={checked}
      onCheckedChange={onCheckedChange}
      aria-label={label}
      style={{
        width: 62,
        height: 34,
        borderRadius: 12,
        backgroundColor: checked ? colors.brand : colors.border,
        border: `1px solid ${checked ? colors.brand : colors.borderStrong}`,
        padding: 3,
        position: "relative",
        cursor: "pointer"
      }}
    >
      <SwitchPrimitive.Thumb
        style={{
          display: "block",
          width: 26,
          height: 26,
          borderRadius: 8,
          backgroundColor: checked
            ? getReadableTextColor(colors.brand, colors.surface, themes.sunlight.surface)
            : colors.surface,
          boxShadow: "0 1px 4px rgba(0,0,0,0.2)",
          position: "absolute",
          top: 3,
          left: checked ? 33 : 3,
          transition: "left 0.2s ease"
        }}
      />
    </SwitchPrimitive.Root>
  );
}

export default function AppearanceSettingsSection() {
  const { colors, settings, saveAllAppearance, previewTheme, previewFont } = useTheme();
  const [committedAppearance, setCommittedAppearance] = useState({
    animationLevel: settings.animationLevel,
    fontKey: settings.fontKey,
    themeKey: settings.themeKey,
  });
  const [pendingTheme, setPendingTheme] = useState<ThemeKey>(settings.themeKey);
  const [pendingFont, setPendingFont] = useState<FontKey>(settings.fontKey);
  const [pendingAnimLevel, setPendingAnimLevel] = useState(settings.animationLevel);
  const committedAppearanceRef = useRef(committedAppearance);
  const hasUnsavedPreviewRef = useRef(false);

  useEffect(() => {
    committedAppearanceRef.current = committedAppearance;
  }, [committedAppearance]);

  useEffect(() => {
    if (hasUnsavedPreviewRef.current) return;
    const nextCommitted = {
      animationLevel: settings.animationLevel,
      fontKey: settings.fontKey,
      themeKey: settings.themeKey,
    };
    setCommittedAppearance(nextCommitted);
    setPendingTheme(settings.themeKey);
    setPendingFont(settings.fontKey);
    setPendingAnimLevel(settings.animationLevel);
  }, [settings.animationLevel, settings.fontKey, settings.themeKey]);

  useEffect(
    () => () => {
      if (!hasUnsavedPreviewRef.current) return;
      previewTheme(committedAppearanceRef.current.themeKey);
      previewFont(committedAppearanceRef.current.fontKey);
      hasUnsavedPreviewRef.current = false;
    },
    [previewFont, previewTheme],
  );

  const hasAppearanceChanges =
    pendingTheme !== committedAppearance.themeKey ||
    pendingFont !== committedAppearance.fontKey ||
    pendingAnimLevel !== committedAppearance.animationLevel;

  return (
    <FitSection heading="Appearance" headingStyle={{ fontSize: 13 }} action={<Palette size={13} color={colors.brand} />}>
      <div style={{ padding: 20 }}>
        <FitText style={{ fontSize: 13, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: colors.textMuted, display: "block", marginBottom: 8 }}>
          Theme
        </FitText>
        <div className="settings-theme-grid" style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 8, marginBottom: 16 }}>
          {THEME_KEYS.map((key) => {
            const theme = themes[key];
            const selected = pendingTheme === key;
            const selectedBg = `${colors.brand}12`;
            return (
              <FitButton
                key={key}
                onClick={() => {
                  hasUnsavedPreviewRef.current = true;
                  setPendingTheme(key);
                  previewTheme(key);
                }}
                variant={selected ? "primary" : "ghost"}
                style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 12px", borderRadius: 10, border: `1.5px solid ${selected ? colors.brand : colors.border}`, backgroundColor: selected ? selectedBg : "transparent", width: "100%" }}
              >
                <FitText style={{ fontSize: 15, fontWeight: selected ? 600 : 400, color: selected ? getReadableTextColor(selectedBg, colors.brand, colors.textPrimary) : colors.textPrimary }}>
                  {THEME_LABELS[key]}
                </FitText>
                <div style={{ width: 56, height: 28, borderRadius: 6, overflow: "hidden", border: `1px solid ${colors.border}`, background: `linear-gradient(135deg, ${theme.base} 50%, ${theme.brand} 50%)` }} />
              </FitButton>
            );
          })}
        </div>

        <FitText style={{ fontSize: 13, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: colors.textMuted, display: "block", marginBottom: 8 }}>
          Font
        </FitText>
        <div className="settings-font-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 8, marginBottom: 16 }}>
          {FONT_KEYS.map((key) => {
            const selected = pendingFont === key;
            const selectedBg = `${colors.brand}12`;
            return (
              <FitButton
                key={key}
                onClick={() => {
                  hasUnsavedPreviewRef.current = true;
                  setPendingFont(key);
                  previewFont(key);
                }}
                variant={selected ? "primary" : "ghost"}
                style={{ padding: "12px 0", borderRadius: 8, border: `1.5px solid ${selected ? colors.brand : colors.border}`, backgroundColor: selected ? selectedBg : colors.surfaceRaised }}
              >
                <FitText style={{ color: selected ? getReadableTextColor(selectedBg, colors.brand, colors.textPrimary) : colors.textPrimary, fontSize: 15, fontWeight: selected ? 600 : 400, fontFamily: STATIC_FONT_PREVIEW_FAMILY[key] }}>
                  {STATIC_FONT_PREVIEW_TEXT[key]}
                </FitText>
              </FitButton>
            );
          })}
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <div>
            <FitText style={{ fontSize: 15, fontWeight: 500 }}>Animations</FitText>
            <FitText as="p" style={{ fontSize: 13, color: colors.textMuted, marginTop: 2 }}>
              Transitions and motion effects
            </FitText>
          </div>
          <CurvyToggle
            checked={pendingAnimLevel !== "none"}
            label="Animations"
            onCheckedChange={(next) => setPendingAnimLevel(next ? "full" : "none")}
          />
        </div>

        {hasAppearanceChanges ? (
          <div style={{ marginBottom: 12 }}>
            <FitPill mode="status" label="Unsaved preview active" color={colors.brand} style={{ padding: "4px 10px" }} />
          </div>
        ) : null}

        <div style={{ display: "flex", gap: 10 }}>
          <FitButton
            variant="ghost"
            label="CANCEL"
            onClick={() => {
              hasUnsavedPreviewRef.current = false;
              setPendingTheme(committedAppearance.themeKey);
              setPendingFont(committedAppearance.fontKey);
              setPendingAnimLevel(committedAppearance.animationLevel);
              previewTheme(committedAppearance.themeKey);
              previewFont(committedAppearance.fontKey);
            }}
            disabled={!hasAppearanceChanges}
            style={{ flex: 1, fontSize: 15 }}
          />
          <FitButton
            variant="primary"
            label="SAVE"
            onClick={() => {
              const nextCommitted = {
                animationLevel: pendingAnimLevel,
                fontKey: pendingFont,
                themeKey: pendingTheme,
              };
              hasUnsavedPreviewRef.current = false;
              setCommittedAppearance(nextCommitted);
              saveAllAppearance(pendingTheme, pendingFont, pendingAnimLevel);
            }}
            disabled={!hasAppearanceChanges}
            style={{ flex: 1, fontSize: 15 }}
          />
        </div>
      </div>
    </FitSection>
  );
}
