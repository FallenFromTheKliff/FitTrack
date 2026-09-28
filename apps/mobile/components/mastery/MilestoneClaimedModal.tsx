import { useEffect, useMemo, useRef } from "react";
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from "react-native";
import { Trophy } from "lucide-react-native";
import { R } from "@fittrack/ui/tokens";

import { FitText } from "@/components/fit";
import { useTheme } from "@/contexts/ThemeContext";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type FocusableElement = {
  focus?: () => void;
};

type ClaimedMilestone = {
  id: string;
  title: string;
};

type MilestoneClaimedModalProps = {
  milestone: ClaimedMilestone | null;
  onClose: () => void;
};

export default function MilestoneClaimedModal({
  milestone,
  onClose,
}: MilestoneClaimedModalProps) {
  const { colors } = useTheme();
  const { height, width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const availableHeight = Math.max(
    1,
    height - insets.top - insets.bottom - 24,
  );
  const cardWidth = Math.min(560, Math.max(1, width - 24));
  const cardHeight = Math.min(620, availableHeight);
  const closeControlRef = useRef<FocusableElement | null>(null);

  useEffect(() => {
    if (!milestone || Platform.OS !== "web" || typeof window === "undefined" || typeof document === "undefined") return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      onClose();
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown, true);
    };
  }, [milestone, onClose]);

  if (!milestone) return null;

  return (
    <Modal
      animationType="none"
      onRequestClose={onClose}
      onShow={() =>
        requestAnimationFrame(() => closeControlRef.current?.focus?.())
      }
      transparent
      visible
    >
      <Pressable
        accessibilityLabel="Dismiss milestone achieved dialog"
        onPress={onClose}
        style={[
          styles.backdrop,
          {
            paddingBottom: Math.max(12, insets.bottom + 8),
            paddingTop: Math.max(12, insets.top + 8),
          },
        ]}
        testID="milestone-claimed-backdrop"
      >
        <Pressable
          accessibilityLabel={`Milestone achieved: ${milestone.title}`}
          accessibilityViewIsModal
          onPress={(event) => event.stopPropagation()}
          role="dialog"
          style={[
            styles.card,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
              maxHeight: cardHeight,
              width: cardWidth,
            },
          ]}
          testID="milestone-claimed-modal"
        >
          <View style={styles.accent}>
            <Trophy color={colors.brand} size={28} strokeWidth={2.2} />
          </View>
          <ScrollView
            contentContainerStyle={styles.bodyContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            style={styles.body}
          >
            <FitText style={styles.heading}>Milestone achieved!</FitText>
            <FitText style={styles.milestoneTitle}>{milestone.title}</FitText>
            <FitText style={styles.copy}>
              Congratulations! Another challenge conquered. Keep going—your next milestone awaits.
            </FitText>
          </ScrollView>
          <Pressable
            accessibilityLabel="Let’s go!"
            accessibilityRole="button"
            onPress={onClose}
            ref={(element) => {
              closeControlRef.current = element as unknown as FocusableElement | null;
            }}
            style={[styles.closeButton, { backgroundColor: colors.brand }]}
            testID="milestone-claimed-close"
          >
            <FitText style={[styles.closeButtonText, { color: colors.onBrand ?? "#FFFFFF" }]}>Let’s go!</FitText>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function makeStyles(colors: ReturnType<typeof useTheme>["colors"]) {
  return StyleSheet.create({
    accent: {
      alignItems: "center",
      alignSelf: "center",
      backgroundColor: colors.brand + "18",
      borderColor: colors.brand + "66",
      borderRadius: 999,
      borderWidth: 1,
      height: 56,
      justifyContent: "center",
      width: 56,
    },
    backdrop: {
      alignItems: "center",
      backgroundColor: "rgba(0,0,0,0.62)",
      flex: 1,
      justifyContent: "center",
      paddingHorizontal: 12,
    },
    body: {
      flexShrink: 1,
      minHeight: 0,
      width: "100%",
    },
    bodyContent: {
      gap: 12,
      paddingBottom: 4,
    },
    card: {
      borderRadius: R.xl,
      borderWidth: 1,
      gap: 14,
      maxWidth: 560,
      minHeight: 0,
      padding: 16,
    },
    closeButton: {
      alignItems: "center",
      alignSelf: "stretch",
      borderRadius: R.md,
      justifyContent: "center",
      minHeight: 48,
      paddingHorizontal: 14,
    },
    closeButtonText: {
      fontSize: 14,
      fontWeight: "800",
    },
    copy: {
      color: colors.textSecondary,
      fontSize: 14,
      lineHeight: 21,
    },
    heading: {
      color: colors.textPrimary,
      fontSize: 20,
      fontWeight: "800",
      lineHeight: 25,
      textAlign: "center",
    },
    milestoneTitle: {
      color: colors.brand,
      fontSize: 18,
      fontWeight: "800",
      lineHeight: 24,
      textAlign: "center",
    },
  });
}
