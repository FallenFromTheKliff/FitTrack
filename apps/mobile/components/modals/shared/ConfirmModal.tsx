import { useMemo } from "react";
import { Modal, View } from "react-native";
import Animated, { useAnimatedStyle } from "react-native-reanimated";
import type { LucideIcon } from "lucide-react-native";

import { useTheme } from "@/contexts/ThemeContext";
import { useThemeTransitionAnim } from "@/hooks/animations/core/useThemeTransition";
import { useOverlayAnim } from "@/hooks/animations/modal/useOverlayAnim";
import { useLoadingText } from "@fittrack/hooks";
import { makeConfirmStyles } from "@/styles/modals/ConfirmStyles";

import { AnimatedFitText } from "@/components/fit/FitText";
import FitButton from "@/components/fit/FitButton";

type ConfirmModalProps = {
  isVisible: boolean;
  title: string;
  message: string;
  yesLabel: string;
  noLabel: string;
  yesIcon?: LucideIcon;
  isDestructive?: boolean;
  isLoading?: boolean;
  loadingLabel?: string;
  loadingTitle?: string;
  onDismiss?: () => void;
  onNo: () => void;
  onShow?: () => void;
  onYes: () => void;
};

function getLoadingTitle(title: string, actionLabel?: string, loadingTitle?: string) {
  if (loadingTitle) return loadingTitle;
  const nextTitle = (actionLabel ?? "").replace(/\.+$/, "").trim();
  return nextTitle || title;
}

export default function ConfirmModal({
  isVisible,
  title,
  message,
  yesLabel,
  noLabel,
  yesIcon,
  isDestructive = false,
  isLoading = false,
  loadingLabel,
  loadingTitle,
  onDismiss,
  onNo,
  onShow,
  onYes,
}: ConfirmModalProps) {
  const { colors } = useTheme();
  const { ic } = useThemeTransitionAnim();
  const { opacity, scale } = useOverlayAnim(isVisible, "scale");
  const s = useMemo(() => makeConfirmStyles(colors), [colors]);

  const displayTitle = isLoading
    ? getLoadingTitle(title, loadingLabel ?? yesLabel, loadingTitle)
    : title;
  const loadingText = useLoadingText(loadingLabel ?? "LOADING", isLoading);

  const backdropStyle = useAnimatedStyle(() => ({ backgroundColor: ic.value.overlay }));
  const cardStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
    backgroundColor: ic.value.surface,
    borderColor: ic.value.border
  }));
  const titleStyle = useAnimatedStyle(() => ({ color: ic.value.textPrimary }));
  const messageStyle = useAnimatedStyle(() => ({ color: ic.value.textMuted }));

  return (
    <Modal
      visible={isVisible}
      transparent
      animationType="none"
      statusBarTranslucent
      onDismiss={onDismiss}
      onRequestClose={isLoading ? undefined : onNo}
      onShow={onShow}
    >
      <Animated.View style={[s.modalOverlay, backdropStyle]}>
        <Animated.View style={[s.container, cardStyle]}>
          <AnimatedFitText style={[s.title, titleStyle]}>
            {displayTitle}
          </AnimatedFitText>
          {isLoading ? (
            <AnimatedFitText style={[s.message, messageStyle]}>
              {loadingText}
            </AnimatedFitText>
          ) : (
            <>
              <AnimatedFitText style={[s.message, messageStyle]}>
                {message}
              </AnimatedFitText>
              <View style={s.actions}>
                <FitButton
                  label={noLabel}
                  variant="ghost"
                  onPress={onNo}
                  flex={1}
                  style={s.actionBtn}
                  textStyle={s.actionBtnText}
                />
                <FitButton
                  label={yesLabel}
                  icon={yesIcon}
                  iconSize={16}
                  variant={isDestructive ? "danger" : "primary"}
                  onPress={onYes}
                  flex={1}
                  style={s.actionBtn}
                  textStyle={s.actionBtnText}
                />
              </View>
            </>
          )}
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}
