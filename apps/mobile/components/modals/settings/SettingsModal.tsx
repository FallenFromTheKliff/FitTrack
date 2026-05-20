import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Modal, Pressable, ScrollView } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { ChevronDown, X } from "lucide-react-native";
import type { LucideIcon } from "lucide-react-native";

import { useTheme } from "@/contexts/ThemeContext";
import { useThemeTransitionAnim } from "@/hooks/animations/core/useThemeTransition";
import { useOverlayAnim } from "@/hooks/animations/modal/useOverlayAnim";
import { makePrefModalStyles } from "@/styles/modals/PrefStyles";

import { AnimatedFitText, FitText } from "@/components/fit/FitText";

export type PrefKey =
    | "notifications"
    | "appearance"
    | "password"
    | "privacy"
    | "help"
    | "terms";

type Props = {
  allowRequestClose?: boolean;
  visible: boolean;
  title: string;
  icon: LucideIcon;
  onClose: () => void;
  children: ReactNode;
  hideHeaderClose?: boolean;
  showFixedCloseButton?: boolean;
  showScrollHint?: boolean;
};

export default function SettingsModal({
  allowRequestClose = true,
  visible,
  title,
  icon: Icon,
  onClose,
  children,
  hideHeaderClose = false,
  showFixedCloseButton = false,
  showScrollHint = false,
}: Props) {
  const { colors } = useTheme();
  const { ic } = useThemeTransitionAnim();
  const { opacity, scale } = useOverlayAnim(visible, "scale");
  const s = useMemo(() => makePrefModalStyles(colors), [colors]);
  const [scrollMetrics, setScrollMetrics] = useState({
    contentHeight: 0,
    offsetY: 0,
    viewportHeight: 0,
  });
  const scrollCueOpacity = useSharedValue(0);

  const canScroll =
    showScrollHint &&
    scrollMetrics.contentHeight > scrollMetrics.viewportHeight + 12;
  const isAtBottom =
    !canScroll ||
    scrollMetrics.offsetY + scrollMetrics.viewportHeight >=
      scrollMetrics.contentHeight - 18;
  const showScrollCue = canScroll && !isAtBottom;

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
  const scrollCueStyle = useAnimatedStyle(() => ({
    opacity: scrollCueOpacity.value,
    transform: [{ translateY: (1 - scrollCueOpacity.value) * 6 }],
  }));

  useEffect(() => {
    scrollCueOpacity.value = withTiming(showScrollCue ? 1 : 0, {
      duration: 180,
    });
  }, [scrollCueOpacity, showScrollCue]);

  useEffect(() => {
    if (visible) return;
    setScrollMetrics({ contentHeight: 0, offsetY: 0, viewportHeight: 0 });
  }, [visible]);

  return (
      <Modal
          visible={visible}
          transparent
          animationType="none"
          onRequestClose={allowRequestClose ? onClose : undefined}
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
              {hideHeaderClose ? null : (
                <Pressable
                  accessibilityLabel="Close modal"
                  accessibilityRole="button"
                  hitSlop={8}
                  onPress={onClose}
                  style={s.closeButton}
                >
                  <X size={18} color={colors.textPrimary} strokeWidth={2.4} />
                </Pressable>
              )}
            </Animated.View>
            <ScrollView
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
                bounces={false}
                contentContainerStyle={
                  showFixedCloseButton
                    ? s.scrollContentWithFixedClose
                    : showScrollHint
                      ? s.scrollContentWithCue
                      : undefined
                }
                onContentSizeChange={(_, contentHeight) => {
                  if (!showScrollHint) return;
                  setScrollMetrics((current) => ({
                    ...current,
                    contentHeight,
                  }));
                }}
                onLayout={(event) => {
                  if (!showScrollHint) return;
                  const viewportHeight = event.nativeEvent?.layout?.height ?? 0;
                  setScrollMetrics((current) => ({
                    ...current,
                    viewportHeight,
                  }));
                }}
                onScroll={(event) => {
                  if (!showScrollHint) return;
                  const nativeEvent = event.nativeEvent;
                  const contentHeight = nativeEvent?.contentSize?.height ?? 0;
                  const offsetY = nativeEvent?.contentOffset?.y ?? 0;
                  const viewportHeight = nativeEvent?.layoutMeasurement?.height ?? 0;
                  setScrollMetrics((current) => ({
                    ...current,
                    contentHeight,
                    offsetY,
                    viewportHeight,
                  }));
                }}
                scrollEventThrottle={showScrollHint ? 16 : undefined}
            >
              {children}
            </ScrollView>
            {showScrollHint ? (
              <Animated.View
                pointerEvents="none"
                style={[
                  showFixedCloseButton ? s.scrollCueWithFixedClose : s.scrollCue,
                  scrollCueStyle,
                ]}
              >
                <ChevronDown
                  color={colors.brand}
                  size={18}
                  strokeWidth={2.4}
                />
              </Animated.View>
            ) : null}
            {showFixedCloseButton ? (
              <Animated.View style={[s.fixedCloseFooter, headerBorderStyle]}>
                <Pressable
                  accessibilityLabel="Close help"
                  accessibilityRole="button"
                  onPress={onClose}
                  style={s.fixedCloseButton}
                >
                  <FitText style={s.fixedCloseText}>Close Help</FitText>
                </Pressable>
              </Animated.View>
            ) : null}
          </Animated.View>
        </Animated.View>
      </Modal>
  );
}
