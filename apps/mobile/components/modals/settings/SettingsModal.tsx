import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Modal, Pressable, ScrollView } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { ChevronDown } from "lucide-react-native";
import type { LucideIcon } from "lucide-react-native";

import { useTheme } from "@/contexts/ThemeContext";
import { useThemeTransitionAnim } from "@/hooks/animations/core/useThemeTransition";
import { useOverlayAnim } from "@/hooks/animations/modal/useOverlayAnim";
import { makePrefModalStyles } from "@/styles/modals/PrefStyles";

import { AnimatedFitText, FitText } from "@/components/fit/FitText";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

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
  fixedFooterAccessory?: ReactNode;
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
  fixedFooterAccessory,
  showFixedCloseButton = false,
  showScrollHint = false,
}: Props) {
  const { colors } = useTheme();
  const { ic } = useThemeTransitionAnim();
  const { opacity, scale } = useOverlayAnim(visible, "scale");
  const s = useMemo(() => makePrefModalStyles(colors), [colors]);
  const scrollRef = useRef<ScrollView | null>(null);
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
  const hasFixedFooterAccessory = Boolean(fixedFooterAccessory);

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
    setScrollMetrics((current) =>
      current.contentHeight === 0 &&
      current.offsetY === 0 &&
      current.viewportHeight === 0
        ? current
        : { contentHeight: 0, offsetY: 0, viewportHeight: 0 },
    );
  }, [visible]);

  const handleScrollCuePress = () => {
    scrollRef.current?.scrollToEnd({ animated: true });
  };

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
            </Animated.View>
            <ScrollView
                ref={scrollRef}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
                bounces={false}
                contentContainerStyle={[
                  s.scrollContent,
                  showFixedCloseButton
                    ? s.scrollContentWithFixedClose
                    : showScrollHint
                      ? s.scrollContentWithCue
                      : undefined
                ]}
                onContentSizeChange={(_, contentHeight) => {
                  if (!showScrollHint) return;
                  setScrollMetrics((current) =>
                    current.contentHeight === contentHeight
                      ? current
                      : {
                          ...current,
                          contentHeight,
                        },
                  );
                }}
                onLayout={(event) => {
                  if (!showScrollHint) return;
                  const viewportHeight = event.nativeEvent?.layout?.height ?? 0;
                  setScrollMetrics((current) =>
                    current.viewportHeight === viewportHeight
                      ? current
                      : {
                          ...current,
                          viewportHeight,
                        },
                  );
                }}
                onScroll={(event) => {
                  if (!showScrollHint) return;
                  const nativeEvent = event.nativeEvent;
                  const contentHeight = nativeEvent?.contentSize?.height ?? 0;
                  const offsetY = nativeEvent?.contentOffset?.y ?? 0;
                  const viewportHeight = nativeEvent?.layoutMeasurement?.height ?? 0;
                  setScrollMetrics((current) =>
                    current.contentHeight === contentHeight &&
                    current.offsetY === offsetY &&
                    current.viewportHeight === viewportHeight
                      ? current
                      : {
                          contentHeight,
                          offsetY,
                          viewportHeight,
                        },
                  );
                }}
                persistentScrollbar={false}
                scrollEventThrottle={showScrollHint ? 16 : undefined}
            >
              {children}
            </ScrollView>
            {showScrollHint ? (
              <AnimatedPressable
                accessibilityLabel="Scroll settings modal to bottom"
                accessibilityRole="button"
                disabled={!showScrollCue}
                hitSlop={8}
                onPress={handleScrollCuePress}
                pointerEvents={showScrollCue ? "auto" : "none"}
                style={[
                  showFixedCloseButton
                    ? hasFixedFooterAccessory
                      ? s.scrollCueWithFixedCloseAccessory
                      : s.scrollCueWithFixedClose
                    : s.scrollCue,
                  scrollCueStyle,
                ]}
              >
                <ChevronDown
                  color={colors.brand}
                  size={18}
                  strokeWidth={2.4}
                />
              </AnimatedPressable>
            ) : null}
            {showFixedCloseButton ? (
              <Animated.View style={[s.fixedCloseFooter, headerBorderStyle]}>
                {fixedFooterAccessory}
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
