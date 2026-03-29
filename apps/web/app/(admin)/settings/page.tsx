"use client";
import { useEffect, useRef, useState } from "react";
import { Building2, Bell, Pencil, Palette } from "lucide-react";
import * as SwitchPrimitive from "@radix-ui/react-switch";
import { GYM_FIELDS, type GymData } from "@fittrack/app-config";

import { themes, THEME_LABELS } from "@fittrack/ui";
import type { FontKey, ThemeKey } from "@fittrack/types";
import { useTheme } from "@/contexts/ThemeContext";
import { useFadeIn } from "@/hooks/animations/useFadeIn";
import { useThemeTransition } from "@/hooks/animations/useThemeTransition";
import { getReadableTextColor } from "@fittrack/utils";

import { FitText, FitTextInput } from "@/components/fit/FitText";
import FitButton from "@/components/fit/FitButton";
import FitSection from "@/components/fit/FitSection";
import FitPill from "@/components/fit/FitPill";
import {
  FONT_KEYS,
  STATIC_FONT_PREVIEW_FAMILY,
  STATIC_FONT_PREVIEW_TEXT,
  THEME_KEYS
} from "./helpers";

export default function GymSettingsPage() {
    const { colors, settings, saveAllAppearance, previewTheme, previewFont } = useTheme();
    const fadeIn = useFadeIn();
    const appearanceFade = useFadeIn({ fromY: 8, duration: 180 });
    const detailsFade = useFadeIn({ fromY: 12, duration: 220 });
    const notificationsFade = useFadeIn({ fromY: 16, duration: 260 });
    const themeTransition = useThemeTransition();

    const [editing, setEditing] = useState<string | null>(null);
    const [gymData, setGymData] = useState<GymData>(() =>
        Object.fromEntries(GYM_FIELDS.map((f) => [f.key, f.default]))
    );
    const [emailNotifs, setEmailNotifs] = useState(true);
    const [lowStockAlerts, setLowStockAlerts] = useState(true);
    const [expiryAlerts, setExpiryAlerts] = useState(true);

    const [pendingTheme, setPendingTheme] = useState<ThemeKey>(settings.themeKey);
    const [pendingFont, setPendingFont] = useState<FontKey>(settings.fontKey);
    const [pendingAnimLevel, setPendingAnimLevel] = useState(settings.animationLevel);

    const initialThemeRef = useRef(settings.themeKey);
    const initialFontRef = useRef(settings.fontKey);

    useEffect(() => {
        setPendingTheme(settings.themeKey);
        setPendingFont(settings.fontKey);
        setPendingAnimLevel(settings.animationLevel);
        initialThemeRef.current = settings.themeKey;
        initialFontRef.current = settings.fontKey;
    }, [settings.themeKey, settings.fontKey, settings.animationLevel]);

    const handleThemeSelect = (key: ThemeKey) => {
        setPendingTheme(key);
        previewTheme(key);
    };

    const handleFontSelect = (key: FontKey) => {
        setPendingFont(key);
        previewFont(key);
    };

    const handleSaveAppearance = () => {
        saveAllAppearance(pendingTheme, pendingFont, pendingAnimLevel);
        initialThemeRef.current = pendingTheme;
        initialFontRef.current = pendingFont;
    };

    const handleCancelAppearance = () => {
        setPendingTheme(initialThemeRef.current);
        setPendingFont(initialFontRef.current);
        setPendingAnimLevel(settings.animationLevel);
        previewTheme(initialThemeRef.current);
        previewFont(initialFontRef.current);
    };

    const hasAppearanceChanges =
        pendingTheme !== settings.themeKey ||
        pendingFont !== settings.fontKey ||
        pendingAnimLevel !== settings.animationLevel;
    const hasThemeOrFontChanges =
        pendingTheme !== settings.themeKey ||
        pendingFont !== settings.fontKey;

    const getTextOnBackground = (bgColor: string, defaultColor: string) =>
        getReadableTextColor(bgColor, defaultColor, themes.sunlight.surface);

    const renderCurvyToggle = (value: boolean, onChange: (v: boolean) => void, ariaLabel: string) => (
        <SwitchPrimitive.Root
            checked={value}
            onCheckedChange={onChange}
            aria-label={ariaLabel}
            className="transition-colors duration-200 ease-in-out"
            style={{
                width: 62,
                height: 34,
                borderRadius: 12,
                backgroundColor: value ? colors.brand : colors.border,
                border: `1px solid ${value ? colors.brand : colors.borderStrong}`,
                padding: 3,
                position: "relative",
                cursor: "pointer"
            }}
        >
            <SwitchPrimitive.Thumb
                className="transition-all duration-200 ease-in-out"
                style={{
                    display: "block",
                    width: 26,
                    height: 26,
                    borderRadius: 8,
                    backgroundColor: value ? getTextOnBackground(colors.brand, colors.surface) : colors.surface,
                    boxShadow: "0 1px 4px rgba(0,0,0,0.2)",
                    position: "absolute",
                    top: 3,
                    left: value ? 33 : 3
                }}
            />
        </SwitchPrimitive.Root>
    );

    const toggleRow = (label: string, value: boolean, onChange: (v: boolean) => void, last = false) => (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 16px", borderBottom: last ? "none" : `1px solid ${colors.border}` }}>
            <FitText style={{ fontSize: 15, fontWeight: 500 }}>{label}</FitText>
            {renderCurvyToggle(value, onChange, label)}
        </div>
    );

    return (
        <FitSection as="section" heading="" hideHeading bare noPadding className={themeTransition} style={fadeIn}>
            <div style={appearanceFade}>
                <FitSection heading="Appearance" headingStyle={{ fontSize: 13 }} action={<Palette size={13} color={colors.brand} />}>
                    <div style={{ padding: "20px 20px" }}>
                        <FitText style={{ fontSize: 13, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: colors.textMuted, display: "block", marginBottom: 8 }}>
                            Theme
                        </FitText>
                        <div className="settings-theme-grid" style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 8, marginBottom: 16 }}>
                            {THEME_KEYS.map((key) => {
                                const t = themes[key];
                                const isSelected = pendingTheme === key;
                                const selectedBg = `${colors.brand}12`;
                                const rowBg = isSelected ? selectedBg : "transparent";
                                const labelColor = isSelected
                                    ? getTextOnBackground(selectedBg, colors.brand)
                                    : colors.textPrimary;
                                return (
                                    <FitButton
                                        key={key}
                                        onClick={() => handleThemeSelect(key)}
                                        variant={isSelected ? "primary" : "ghost"}
                                        style={{
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "space-between",
                                            padding: "12px 12px",
                                            borderRadius: 10,
                                            border: `1.5px solid ${isSelected ? colors.brand : colors.border}`,
                                            backgroundColor: rowBg,
                                            width: "100%"
                                        }}
                                        textStyle={{ fontSize: 15, fontWeight: isSelected ? 600 : 400, color: labelColor }}
                                    >
                                        <FitText style={{ fontSize: 15, fontWeight: isSelected ? 600 : 400, color: labelColor }}>
                                            {THEME_LABELS[key]}
                                        </FitText>
                                        <div style={{
                                            width: 56,
                                            height: 28,
                                            borderRadius: 6,
                                            overflow: "hidden",
                                            border: `1px solid ${colors.border}`,
                                            background: `linear-gradient(135deg, ${t.base} 50%, ${t.brand} 50%)`
                                        }} />
                                    </FitButton>
                                );
                            })}
                        </div>
                        <FitText style={{ fontSize: 13, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: colors.textMuted, display: "block", marginBottom: 8 }}>
                            Font
                        </FitText>
                        <div className="settings-font-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 8, marginBottom: 16 }}>
                            {FONT_KEYS.map((key) => {
                                const isSelected = pendingFont === key;
                                const selectedBg = `${colors.brand}12`;
                                const fontButtonBg = isSelected ? selectedBg : colors.surfaceRaised;
                                const fontLabelColor = isSelected
                                    ? getTextOnBackground(selectedBg, colors.brand)
                                    : getTextOnBackground(colors.surfaceRaised, colors.textPrimary);
                                return (
                                    <FitButton
                                        key={key}
                                        onClick={() => handleFontSelect(key)}
                                        variant={isSelected ? "primary" : "ghost"}
                                        style={{
                                            flex: 1,
                                            padding: "12px 0",
                                            borderRadius: 8,
                                            border: `1.5px solid ${isSelected ? colors.brand : colors.border}`,
                                            backgroundColor: fontButtonBg,
                                            fontSize: 15,
                                            fontWeight: isSelected ? 600 : 400,
                                            fontFamily: STATIC_FONT_PREVIEW_FAMILY[key]
                                        }}
                                    >
                                        <FitText style={{ color: fontLabelColor, fontSize: 15, fontWeight: isSelected ? 600 : 400, fontFamily: STATIC_FONT_PREVIEW_FAMILY[key] }}>
                                            {STATIC_FONT_PREVIEW_TEXT[key]}
                                        </FitText>
                                    </FitButton>
                                );
                            })}
                        </div>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, paddingTop: 2, paddingBottom: 2 }}>
                            <div>
                                <FitText style={{ fontSize: 15, fontWeight: 500 }}>Animations</FitText>
                                <FitText as="p" style={{ fontSize: 13, color: colors.textMuted, marginTop: 2 }}>Transitions and motion effects</FitText>
                            </div>
                            {renderCurvyToggle(
                                pendingAnimLevel !== "none",
                                (v) => setPendingAnimLevel(v ? "full" : "none"),
                                "Animations"
                            )}
                        </div>
                        {hasAppearanceChanges && (
                            <div style={{ marginBottom: 12 }}>
                                <FitPill mode="status" label="Unsaved preview active" color={colors.brand} style={{ padding: "4px 10px" }} />
                            </div>
                        )}
                        <div style={{ display: "flex", gap: 10 }}>
                            <FitButton
                                variant="ghost"
                                label="CANCEL"
                                onClick={handleCancelAppearance}
                                disabled={!hasAppearanceChanges}
                                style={{ flex: 1, fontSize: 15 }}
                            />
                            <FitButton
                                variant="primary"
                                label="SAVE"
                                onClick={handleSaveAppearance}
                                disabled={!hasThemeOrFontChanges}
                                style={{ flex: 1, fontSize: 15 }}
                            />
                        </div>
                    </div>
                </FitSection>
            </div>
            <div style={detailsFade}>
                <FitSection heading="Gym Details" headingStyle={{ fontSize: 13 }} action={
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <Building2 size={13} color={colors.brand} />
                        <FitText style={{ fontSize: 13, color: colors.brand }}>SertFit Gym</FitText>
                    </div>
                }>
                    <div style={{ padding: 4 }}>
                        {GYM_FIELDS.map((field) => (
                            <div key={field.key} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 16px", borderBottom: `1px solid ${colors.border}` }}>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <FitText style={{ fontSize: 13, color: colors.textMuted, display: "block" }}>{field.label}</FitText>
                                    {editing === field.key ? (
                                        <FitTextInput
                                            autoFocus
                                            value={gymData[field.key]}
                                            onChange={(e) => setGymData((d) => ({ ...d, [field.key]: e.target.value }))}
                                            onBlur={() => setEditing(null)}
                                            onKeyDown={(e) => { if (e.key === "Enter") setEditing(null); }}
                                            style={{ marginTop: 4, padding: "8px 10px", borderRadius: 6, fontSize: 15, backgroundColor: colors.fieldBg, border: `1px solid ${colors.brand}`, width: "90%" }}
                                        />
                                    ) : (
                                        <FitText style={{ fontSize: 15, marginTop: 2, display: "block" }}>{gymData[field.key]}</FitText>
                                    )}
                                </div>
                                <FitButton
                                    variant="link"
                                    icon={Pencil}
                                    iconSize={16}
                                    iconOnly
                                    onClick={() => setEditing(editing === field.key ? null : field.key)}
                                    style={{ padding: 6, textDecoration: "none", color: colors.textMuted }}
                                />
                            </div>
                        ))}
                    </div>
                </FitSection>
            </div>
            <div style={notificationsFade}>
                <FitSection heading="Notification Preferences" headingStyle={{ fontSize: 13 }} action={<Bell size={13} color={colors.brand} />}>
                    <div>
                        {toggleRow("Email Notifications", emailNotifs, setEmailNotifs)}
                        {toggleRow("Low Stock Alerts", lowStockAlerts, setLowStockAlerts)}
                        {toggleRow("Membership Expiry Alerts", expiryAlerts, setExpiryAlerts, true)}
                    </div>
                </FitSection>
            </div>
            <style>{`
              @media (max-width: 900px) {
                .settings-theme-grid { grid-template-columns: 1fr !important; }
                .settings-font-grid { grid-template-columns: 1fr !important; }
              }
            `}</style>
        </FitSection>
    );
}
