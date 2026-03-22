import { useState, useEffect, useMemo } from "react";
import { Pressable, View } from "react-native";
import { AlertTriangle } from "lucide-react-native";
import Animated from "react-native-reanimated";

import { useTheme } from "@/contexts/ThemeContext";
import { useThemeTransition } from "@/hooks/animations/core/useThemeTransition";
import { useLoadingText } from "@fittrack/hooks";
import { makePrefModalStyles } from "@/styles/modals/PrefStyles";
import { THEME_LABELS, FONT_LABELS, THEME_ACCENT_COLOR, FONT_FAMILIES, themes } from "@fittrack/ui";
import type { AnimationLevel, ThemeKey, FontKey } from "@fittrack/types";

import { FitSquareToggle } from "@/components/fit/FitSquareToggle";
import { FitText, AnimatedFitText } from "@/components/fit/FitText";
import FitButton from "@/components/fit/FitButton";

const THEME_KEYS: ThemeKey[] = ["night", "sunlight", "dark", "light", "navy"];
const FONT_KEYS: FontKey[] = ["standard", "retro", "painter"];
const THEME_SWATCH: Record<ThemeKey, { left: string; right: string }> = {
  night: { left: themes.night.base, right: themes.night.brand },
  sunlight: { left: themes.sunlight.base, right: themes.sunlight.brand },
  dark: { left: themes.dark.base, right: themes.dark.brand },
  light: { left: themes.light.base, right: themes.light.brand },
  navy: { left: themes.navy.base, right: themes.navy.brand }
};

function ThemeSwitch({ themeKey }: { themeKey: ThemeKey }) {
  const { left, right } = THEME_SWATCH[themeKey];
  return (
    <View style={{ width: "40%", height: "100%", overflow: "hidden", backgroundColor: right }}>
      <View
        style={{
          position: "absolute",
          top: "-50%",
          bottom: "-50%",
          left: "-10%",
          right: "46%",
          backgroundColor: left,
          transform: [{ skewX: "-15deg" }]
        }}
      />
    </View>
  );
}

export function AppearancePanel({ onClose }: { onClose: () => void }) {
  const {
    colors,
    settings,
    saveAllAppearance,
    previewTheme,
    previewFont
  } = useTheme();
  const { surfaceStyle, textMutedStyle, borderStyle } = useThemeTransition();
  const s = useMemo(() => makePrefModalStyles(colors), [colors]);

  const [draftTheme, setDraftTheme] = useState<ThemeKey>(settings.themeKey);
  const [draftFont, setDraftFont] = useState<FontKey>(settings.fontKey);
  const [draftLevel, setDraftLevel] = useState<AnimationLevel>(settings.animationLevel);
  const [isSaving, setIsSaving] = useState(false);
  const savingText = useLoadingText("Saving", isSaving);
  const animLabel = draftLevel === "full" ? "Animations on" : "Animations off";

  const appearanceDirty =
    draftTheme !== settings.themeKey ||
    draftFont !== settings.fontKey ||
    draftLevel !== settings.animationLevel;

  useEffect(() => {
    setDraftTheme(settings.themeKey);
    setDraftFont(settings.fontKey);
    setDraftLevel(settings.animationLevel);
  }, [settings.themeKey, settings.fontKey, settings.animationLevel]);

  const handleSelectTheme = (key: ThemeKey) => {
    setDraftTheme(key);
    previewTheme(key);
  };

  const handleSelectFont = (key: FontKey) => {
    setDraftFont(key);
    previewFont(key);
  };

  const handleSave = async () => {
    setIsSaving(true);
    await new Promise((resolve) => setTimeout(resolve, 1000));
    await saveAllAppearance(draftTheme, draftFont, draftLevel);
    previewTheme(null);
    previewFont(null);
    setIsSaving(false);
    onClose();
  };

  const handleCancel = () => {
    previewTheme(null);
    previewFont(null);
    onClose();
  };

  return (
    <Animated.View style={[s.body, surfaceStyle]}>
      <View>
        <AnimatedFitText style={[s.sectionLabel, textMutedStyle]}>THEME</AnimatedFitText>
        <View style={s.themeGrid}>
          {THEME_KEYS.map((key) => {
            const accent = THEME_ACCENT_COLOR[key];
            const isActive = draftTheme === key;
            return (
              <Pressable
                key={key}
                style={[s.themeCard, isActive && { borderColor: accent, borderWidth: 2 }]}
                onPress={() => handleSelectTheme(key)}
              >
                <FitText style={[s.themeCardLabel, isActive && { color: accent, fontWeight: "600" }]}>
                  {THEME_LABELS[key]}
                </FitText>
                <ThemeSwitch themeKey={key} />
              </Pressable>
            );
          })}
        </View>
      </View>
      <View>
        <AnimatedFitText style={[s.sectionLabel, textMutedStyle]}>FONT</AnimatedFitText>
        <View style={s.fontRow}>
          {FONT_KEYS.map((key) => {
            const isActive = draftFont === key;
            return (
              <Pressable
                key={key}
                style={[s.fontCard, isActive && s.fontCardActive]}
                onPress={() => handleSelectFont(key)}
              >
                <FitText
                  style={[
                    s.fontCardLabel,
                    isActive && s.fontCardLabelActive,
                    { fontFamily: FONT_FAMILIES[key] }
                  ]}
                >
                  {FONT_LABELS[key]}
                </FitText>
              </Pressable>
            );
          })}
        </View>
      </View>
      <View style={s.toggleRow}>
        <View style={s.toggleInfo}>
          <FitText style={s.toggleLabel}>Animations</FitText>
          <FitText style={s.toggleHint}>{animLabel}</FitText>
        </View>
        <FitSquareToggle
          value={draftLevel === "full"}
          onValueChange={(v) => setDraftLevel(v ? "full" : "none")}
          activeColor={colors.brand}
          inactiveColor={colors.border}
          useAnimations={settings.animationLevel === "full"}
        />
      </View>
      {appearanceDirty && (
        <Animated.View style={[s.dirtyBanner, borderStyle]}>
          <AlertTriangle size={15} color={colors.warning} strokeWidth={2} />
          <FitText style={s.dirtyBannerText}>Unsaved changes - save to apply.</FitText>
        </Animated.View>
      )}
      <View style={s.footer}>
        <FitButton label="Cancel" variant="ghost" onPress={handleCancel} flex={1} />
        <FitButton
          label={isSaving ? savingText : "Save"}
          variant="primary"
          onPress={handleSave}
          disabled={!appearanceDirty || isSaving}
          loading={isSaving}
          flex={1}
        />
      </View>
    </Animated.View>
  );
}

export function NotificationsPanel({ onClose }: { onClose: () => void }) {
  const { colors, settings } = useTheme();
  const { surfaceStyle, textMutedStyle } = useThemeTransition();
  const s = useMemo(() => makePrefModalStyles(colors), [colors]);
  const [pushEnabled, setPushEnabled] = useState(true);
  const [emailEnabled, setEmailEnabled] = useState(true);
  const [remindersEnabled, setRemindersEnabled] = useState(true);

  return (
    <Animated.View style={[s.body, surfaceStyle]}>
      <AnimatedFitText style={[s.sectionLabel, textMutedStyle]}>ALERTS</AnimatedFitText>
      <View style={s.infoCard}>
        <View style={s.toggleRow}>
          <View style={s.toggleInfo}>
            <FitText style={s.toggleLabel}>Push Notifications</FitText>
            <FitText style={s.toggleHint}>Booking confirmations and membership alerts</FitText>
          </View>
          <FitSquareToggle
            value={pushEnabled}
            onValueChange={setPushEnabled}
            activeColor={colors.brand}
            inactiveColor={colors.border}
            useAnimations={settings.animationLevel === "full"}
          />
        </View>
        <View style={s.infoCardDivider} />
        <View style={s.toggleRow}>
          <View style={s.toggleInfo}>
            <FitText style={s.toggleLabel}>Email Alerts</FitText>
            <FitText style={s.toggleHint}>Weekly summaries and promotional offers</FitText>
          </View>
          <FitSquareToggle
            value={emailEnabled}
            onValueChange={setEmailEnabled}
            activeColor={colors.brand}
            inactiveColor={colors.border}
            useAnimations={settings.animationLevel === "full"}
          />
        </View>
        <View style={s.infoCardDivider} />
        <View style={s.toggleRow}>
          <View style={s.toggleInfo}>
            <FitText style={s.toggleLabel}>Class Reminders</FitText>
            <FitText style={s.toggleHint}>30-minute notice before booked classes</FitText>
          </View>
          <FitSquareToggle
            value={remindersEnabled}
            onValueChange={setRemindersEnabled}
            activeColor={colors.brand}
            inactiveColor={colors.border}
            useAnimations={settings.animationLevel === "full"}
          />
        </View>
      </View>
      <View style={s.footer}>
        <FitButton label="Close" variant="ghost" onPress={onClose} flex={1} />
      </View>
    </Animated.View>
  );
}