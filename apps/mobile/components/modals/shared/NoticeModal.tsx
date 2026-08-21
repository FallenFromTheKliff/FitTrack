import { useMemo } from "react";
import { Modal, View } from "react-native";
import Animated, { useAnimatedStyle } from "react-native-reanimated";

import { useTheme } from "@/contexts/ThemeContext";
import { useThemeTransitionAnim } from "@/hooks/animations/core/useThemeTransition";
import { useOverlayAnim } from "@/hooks/animations/modal/useOverlayAnim";
import { makeConfirmStyles } from "@/styles/modals/ConfirmStyles";

import { AnimatedFitText } from "@/components/fit/FitText";
import FitButton from "@/components/fit/FitButton";

type NoticeModalProps = {
  buttonLabel?: string;
  isVisible: boolean;
  message: string;
  onClose: () => void;
  title: string;
};

export default function NoticeModal({
  buttonLabel = "Got It",
  isVisible,
  message,
  onClose,
  title
}: NoticeModalProps) {
  const { colors } = useTheme();
  const { ic } = useThemeTransitionAnim();
  const { opacity, scale } = useOverlayAnim(isVisible, "scale");
  const s = useMemo(() => makeConfirmStyles(colors), [colors]);

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
      onRequestClose={onClose}
    >
      <Animated.View style={[s.modalOverlay, backdropStyle]}>
        <Animated.View style={[s.container, cardStyle]}>
          <AnimatedFitText style={[s.title, titleStyle]}>
            {title}
          </AnimatedFitText>
          <AnimatedFitText style={[s.message, messageStyle]}>
            {message}
          </AnimatedFitText>
          <View style={s.actions}>
            <FitButton
              label={buttonLabel}
              variant="primary"
              onPress={onClose}
              flex={1}
              style={s.actionBtn}
              textStyle={s.actionBtnText}
            />
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}
