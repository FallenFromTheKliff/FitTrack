import { useMemo } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { ChevronLeft, ChevronRight } from "lucide-react-native";
import { R } from "@fittrack/ui/tokens";

import { useTheme } from "@/contexts/ThemeContext";
import FitButton from "./FitButton";
import { FitText } from "./FitText";

type FitPagerProps = {
  currentPage: number;
  onPageChange: (page: number) => void;
  style?: StyleProp<ViewStyle>;
  totalPages: number;
};

function makeStyles(colors: ReturnType<typeof useTheme>["colors"]) {
  return StyleSheet.create({
    button: {
      borderRadius: R.md,
      height: 38,
      minHeight: 0,
      paddingHorizontal: 0,
      paddingVertical: 0,
      width: 42,
    },
    label: {
      color: colors.textMuted,
      fontSize: 12,
      fontWeight: "800",
      minWidth: 54,
      textAlign: "center",
    },
    root: {
      alignItems: "center",
      flexDirection: "row",
      gap: 12,
      justifyContent: "center",
      marginTop: 14,
    },
  });
}

export default function FitPager({
  currentPage,
  onPageChange,
  style,
  totalPages,
}: FitPagerProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const safeTotalPages = Math.max(1, totalPages);
  const safeCurrentPage = Math.min(Math.max(1, currentPage), safeTotalPages);
  const canGoPrev = safeCurrentPage > 1;
  const canGoNext = safeCurrentPage < safeTotalPages;

  return (
    <View style={[styles.root, style]}>
      <FitButton
        icon={ChevronLeft}
        iconOnly
        iconSize={18}
        onPress={() => onPageChange(Math.max(1, safeCurrentPage - 1))}
        variant={canGoPrev ? "primary" : "ghost"}
        disabled={!canGoPrev}
        style={styles.button}
      />
      <FitText style={styles.label}>
        {safeCurrentPage} / {safeTotalPages}
      </FitText>
      <FitButton
        icon={ChevronRight}
        iconOnly
        iconSize={18}
        onPress={() => onPageChange(Math.min(safeTotalPages, safeCurrentPage + 1))}
        variant={canGoNext ? "primary" : "ghost"}
        disabled={!canGoNext}
        style={styles.button}
      />
    </View>
  );
}
