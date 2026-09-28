import { useMemo } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { useAnimatedStyle } from "react-native-reanimated";
import { X } from "lucide-react-native";
import { R } from "@fittrack/ui/tokens";

import type { CommerceCheckoutAttempt } from "@fittrack/api-client";
import type { ThemeColors } from "@fittrack/types";

import { useTheme } from "@/contexts/ThemeContext";
import { useThemeTransitionAnim } from "@/hooks/animations/core/useThemeTransition";
import { useOverlayAnim } from "@/hooks/animations/modal/useOverlayAnim";
import { FitButton } from "@/components/fit";
import { AnimatedFitText } from "@/components/fit/FitText";
import type { CheckoutRecoveryOperation } from "@/hooks/commerce/useCommerceCheckoutReturn";
import {
  CheckoutRecoveryActions,
  CheckoutRecoveryContent,
} from "./CheckoutRecoveryPanel";

type Props = {
  attempt: CommerceCheckoutAttempt;
  errorMessage: string | null;
  isBusy: boolean;
  isVisible: boolean;
  onCancel: () => void;
  onCheckStatus: () => void;
  onClose: () => void;
  onDismiss?: () => void;
  onResume: () => void;
  onShow?: () => void;
  operation: CheckoutRecoveryOperation;
  remainingSeconds: number | null;
};

function makeStyles(
  colors: ThemeColors,
  maxHeight: number,
) {
  return StyleSheet.create({
    overlay: {
      alignItems: "center",
      flex: 1,
      justifyContent: "center",
      paddingBottom: 16,
      paddingHorizontal: 12,
      paddingTop: 16,
    },
    backdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: colors.overlay,
    },
    card: {
      borderColor: colors.border,
      borderRadius: R.xl,
      borderWidth: 1,
      maxHeight,
      maxWidth: 540,
      overflow: "hidden",
      width: "92%",
    },
    header: {
      alignItems: "center",
      borderBottomColor: colors.border,
      borderBottomWidth: 1,
      flexDirection: "row",
      gap: 10,
      minHeight: 64,
      paddingHorizontal: 16,
      paddingVertical: 10,
    },
    headerText: {
      flex: 1,
      gap: 2,
    },
    title: {
      fontSize: 19,
      fontWeight: "700",
    },
    subtitle: {
      color: colors.textMuted,
      fontSize: 12,
      lineHeight: 17,
    },
    close: {
      alignItems: "center",
      borderRadius: R.md,
      height: 44,
      justifyContent: "center",
      width: 44,
    },
    body: {
      flexGrow: 0,
      flexShrink: 1,
      minHeight: 0,
    },
    bodyContent: {
      gap: 10,
      padding: 16,
    },
    footer: {
      borderTopColor: colors.border,
      borderTopWidth: 1,
      flexShrink: 0,
      gap: 8,
      paddingHorizontal: 16,
      paddingVertical: 12,
    },
    browseButton: {
      minHeight: 44,
    },
  });
}

export default function CheckoutRecoveryModal({
  attempt,
  errorMessage,
  isBusy,
  isVisible,
  onCancel,
  onCheckStatus,
  onClose,
  onDismiss,
  onResume,
  onShow,
  operation,
  remainingSeconds,
}: Props) {
  const { colors } = useTheme();
  const { ic } = useThemeTransitionAnim();
  const { height: viewportHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { opacity, scale } = useOverlayAnim(isVisible, "scale");
  const availableHeight = Math.max(
    320,
    viewportHeight - Math.max(24, insets.top + 12) - Math.max(24, insets.bottom + 12),
  );
  const s = useMemo(
    () => makeStyles(colors, Math.min(520, availableHeight)),
    [availableHeight, colors],
  );
  const isCancelling = operation === "cancelling";
  const isChecking = !isCancelling && operation !== null;

  const backdropStyle = useAnimatedStyle(() => ({
    backgroundColor: ic.value.overlay,
  }));
  const cardStyle = useAnimatedStyle(() => ({
    backgroundColor: ic.value.surface,
    borderColor: ic.value.border,
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));
  const titleStyle = useAnimatedStyle(() => ({
    color: ic.value.textPrimary,
  }));
  const subtitleStyle = useAnimatedStyle(() => ({
    color: ic.value.textMuted,
  }));

  const handleClose = () => {
    if (isBusy) return;
    onClose();
  };

  return (
    <Modal
      animationType="none"
      onDismiss={onDismiss}
      onRequestClose={isBusy ? undefined : handleClose}
      onShow={onShow}
      statusBarTranslucent
      transparent
      visible={isVisible}
    >
      <Animated.View style={[s.overlay, backdropStyle]}>
        <Pressable
          accessibilityLabel="Close payment recovery"
          accessibilityRole="button"
          disabled={isBusy}
          onPress={handleClose}
          style={s.backdrop}
        />
        <Animated.View
          accessibilityViewIsModal
          style={[s.card, cardStyle]}
          testID="checkout-recovery-modal"
        >
          <View style={s.header}>
            <View style={s.headerText}>
              <AnimatedFitText style={[s.title, titleStyle]}>
                {isCancelling
                  ? "Cancelling payment"
                  : isChecking
                    ? "Checking payment"
                    : "Payment pending"}
              </AnimatedFitText>
              <AnimatedFitText style={[s.subtitle, subtitleStyle]}>
                Keep browsing or continue the same payment.
              </AnimatedFitText>
            </View>
            <Pressable
              accessibilityLabel="Close payment recovery"
              accessibilityRole="button"
              disabled={isBusy}
              hitSlop={8}
              onPress={handleClose}
              style={s.close}
            >
              <X color={colors.textMuted} size={20} strokeWidth={2.2} />
            </Pressable>
          </View>
          <ScrollView
            contentContainerStyle={s.bodyContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator
            style={s.body}
          >
            <CheckoutRecoveryContent
              attempt={attempt}
              errorMessage={errorMessage}
              operation={operation}
              remainingSeconds={remainingSeconds}
            />
          </ScrollView>
          <View style={s.footer}>
            <CheckoutRecoveryActions
              attempt={attempt}
              errorMessage={errorMessage}
              isBusy={isBusy}
              onCancel={onCancel}
              onCheckStatus={onCheckStatus}
              onResume={onResume}
            />
            <FitButton
              label="Continue browsing"
              variant="ghost"
              disabled={isBusy}
              onPress={handleClose}
              style={s.browseButton}
            />
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}
