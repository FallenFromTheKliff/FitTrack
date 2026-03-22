import { useMemo, type ReactNode } from "react";
import { Modal, ScrollView } from "react-native";
import Animated, { useAnimatedStyle } from "react-native-reanimated";
import type { LucideIcon } from "lucide-react-native";

import { useTheme } from "@/contexts/ThemeContext";
import { useThemeTransitionAnim } from "@/hooks/animations/core/useThemeTransition";
import { useOverlayAnim } from "@/hooks/animations/modal/useOverlayAnim";
import { makePrefModalStyles } from "@/styles/modals/PrefStyles";

import { AnimatedFitText } from "@/components/fit/FitText";

export type PrefKey =
    | "notifications"
    | "appearance"
    | "password"
    | "privacy"
    | "help"
    | "terms";

type Props = {
  visible: boolean;
  title: string;
  icon: LucideIcon;
  onClose: () => void;
  children: ReactNode;
};

export default function SettingsModal({ visible, title, icon: Icon, onClose, children }: Props) {
  const { colors } = useTheme();
  const { ic } = useThemeTransitionAnim();
  const { opacity, scale } = useOverlayAnim(visible, "scale");
  const s = useMemo(() => makePrefModalStyles(colors), [colors]);

  const backdropStyle = useAnimatedStyle(() => ({ backgroundColor: ic.value.overlay }));
  const cardStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
    backgroundColor: ic.value.surface,
    borderColor: ic.value.border
  }));
  const headerBorderStyle = useAnimatedStyle(() => ({ borderBottomColor: ic.value.border }));
  const headerIconStyle = useAnimatedStyle(() => ({
    backgroundColor: ic.value.surfaceRaised,
    borderColor: ic.value.border
  }));
  const headerTitleStyle = useAnimatedStyle(() => ({ color: ic.value.textPrimary }));

  return (
      <Modal
          visible={visible}
          transparent
          animationType="none"
          onRequestClose={undefined}
          statusBarTranslucent
      >
        <Animated.View style={[s.backdrop, backdropStyle]}>
          <Animated.View style={[s.card, cardStyle]}>
            <Animated.View style={[s.header, headerBorderStyle]}>
              <Animated.View style={[s.headerIcon, headerIconStyle]}>
                <Icon size={17} color={colors.brand} strokeWidth={2} />
              </Animated.View>
              <AnimatedFitText style={[s.headerTitle, headerTitleStyle]}>
                {title}
              </AnimatedFitText>
            </Animated.View>
            <ScrollView
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
                bounces={false}
            >
              {children}
            </ScrollView>
          </Animated.View>
        </Animated.View>
      </Modal>
  );
}