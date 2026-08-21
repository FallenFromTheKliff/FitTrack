import { useMemo } from "react";
import { StyleSheet, View } from "react-native";
import { Lock, type LucideIcon } from "lucide-react-native";

import { R } from "@fittrack/ui/tokens";
import { useTheme } from "@/contexts/ThemeContext";
import { FitButton } from "@/components/fit";
import { FitText } from "@/components/fit/FitText";

type PremiumFeatureGateProps = {
  actionLabel?: string;
  eyebrow?: string;
  icon?: LucideIcon;
  message: string;
  onActionPress?: () => void;
  statusLabel?: string;
  title: string;
};

export default function PremiumFeatureGate({
  actionLabel,
  eyebrow = "ACTIVE PLAN REQUIRED",
  icon: Icon = Lock,
  message,
  onActionPress,
  statusLabel,
  title
}: PremiumFeatureGateProps) {
  const { colors } = useTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);

  return (
    <View style={s.card}>
      <View style={s.headerRow}>
        <View style={s.iconBadge}>
          <Icon size={18} color={colors.brand} strokeWidth={2} />
        </View>
        <View style={s.headerText}>
          <FitText style={s.eyebrow}>{eyebrow}</FitText>
          <FitText style={s.title}>{title}</FitText>
        </View>
        {statusLabel ? (
          <View style={s.statusPill}>
            <FitText style={s.statusPillText}>{statusLabel}</FitText>
          </View>
        ) : null}
      </View>
      <FitText style={s.message}>{message}</FitText>
      {actionLabel && onActionPress ? (
        <FitButton
          label={actionLabel}
          onPress={onActionPress}
          variant="primary"
          style={s.action}
        />
      ) : null}
    </View>
  );
}

function makeStyles(colors: ReturnType<typeof useTheme>["colors"]) {
  return StyleSheet.create({
    action: {
      marginTop: 6
    },
    card: {
      backgroundColor: colors.surfaceRaised,
      borderRadius: R.xl,
      borderWidth: 1,
      borderColor: colors.border,
      borderStyle: "dashed",
      padding: 16,
      gap: 10
    },
    eyebrow: {
      fontSize: 10,
      fontWeight: "700",
      color: colors.brand,
      letterSpacing: 1
    },
    headerRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12
    },
    headerText: {
      flex: 1,
      gap: 3
    },
    iconBadge: {
      width: 40,
      height: 40,
      borderRadius: R.lg,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.brand + "14",
      borderWidth: 1,
      borderColor: colors.brand + "28"
    },
    message: {
      fontSize: 13,
      lineHeight: 20,
      color: colors.textMuted
    },
    statusPill: {
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: R.md,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface
    },
    statusPillText: {
      fontSize: 11,
      fontWeight: "600",
      color: colors.textSecondary
    },
    title: {
      fontSize: 16,
      fontWeight: "700",
      color: colors.textPrimary
    }
  });
}
