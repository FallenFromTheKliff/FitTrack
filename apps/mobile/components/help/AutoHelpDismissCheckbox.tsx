import { useMemo } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Check } from "lucide-react-native";
import type { ThemeColors } from "@fittrack/types";
import { R } from "@fittrack/ui/tokens";

import { useTheme } from "@/contexts/ThemeContext";
import { FitText } from "@/components/fit/FitText";

type Props = {
  checked: boolean;
  onToggle: () => void;
};

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    box: {
      alignItems: "center",
      backgroundColor: colors.surfaceRaised,
      borderColor: colors.border,
      borderRadius: R.md,
      borderWidth: 1,
      flexDirection: "row",
      gap: 10,
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    checkbox: {
      alignItems: "center",
      borderColor: colors.border,
      borderRadius: 6,
      borderWidth: 1,
      height: 22,
      justifyContent: "center",
      width: 22,
    },
    checkboxActive: {
      backgroundColor: colors.brand,
      borderColor: colors.brand,
    },
    copy: {
      color: colors.textSecondary,
      flex: 1,
      fontSize: 13,
      fontWeight: "700",
      lineHeight: 18,
    },
  });
}

export default function AutoHelpDismissCheckbox({ checked, onToggle }: Props) {
  const { colors } = useTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);

  return (
    <Pressable
      accessibilityLabel="Never show this help automatically again"
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      onPress={onToggle}
      style={s.box}
    >
      <View style={[s.checkbox, checked ? s.checkboxActive : null]}>
        {checked ? (
          <Check size={15} color={colors.onBrand ?? "#FFFFFF"} strokeWidth={3} />
        ) : null}
      </View>
      <FitText style={s.copy}>Yes, never show this automatically again</FitText>
    </Pressable>
  );
}
