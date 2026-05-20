import { useEffect, useMemo, useState } from "react";
import {
  ScrollView,
  StyleSheet,
  View,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ScrollViewProps,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { ChevronDown } from "lucide-react-native";

import type { ThemeColors } from "@fittrack/types";
import { useTheme } from "@/contexts/ThemeContext";

type FitModalScrollViewProps = ScrollViewProps & {
  cueBottom?: number;
  cueStyle?: StyleProp<ViewStyle>;
  fill?: boolean;
  resetKey?: unknown;
  showScrollCue?: boolean;
};

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    host: {
      minHeight: 0,
      position: "relative",
    },
    hostFill: {
      flex: 1,
      flexShrink: 1,
      minHeight: 0,
      position: "relative",
    },
    scrollFill: {
      flex: 1,
      flexShrink: 1,
      minHeight: 0,
    },
    scrollCue: {
      alignItems: "center",
      alignSelf: "center",
      backgroundColor: colors.surfaceRaised,
      borderColor: colors.border,
      borderRadius: 999,
      borderWidth: 1,
      bottom: 10,
      boxShadow: "0 4px 12px rgba(0,0,0,0.16)",
      elevation: 7,
      height: 34,
      justifyContent: "center",
      position: "absolute",
      width: 34,
      zIndex: 4,
    },
  });
}

export default function FitModalScrollView({
  children,
  contentContainerStyle,
  cueBottom = 10,
  cueStyle,
  fill = true,
  keyboardShouldPersistTaps,
  nestedScrollEnabled,
  onContentSizeChange,
  onLayout,
  onScroll,
  resetKey,
  scrollEventThrottle,
  showScrollCue = true,
  showsVerticalScrollIndicator = false,
  style,
  ...scrollProps
}: FitModalScrollViewProps) {
  const { colors } = useTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);
  const [scrollMetrics, setScrollMetrics] = useState({
    contentHeight: 0,
    offsetY: 0,
    viewportHeight: 0,
  });
  const cueOpacity = useSharedValue(0);

  const canScroll =
    showScrollCue &&
    scrollMetrics.contentHeight > scrollMetrics.viewportHeight + 12;
  const isAtBottom =
    !canScroll ||
    scrollMetrics.offsetY + scrollMetrics.viewportHeight >=
      scrollMetrics.contentHeight - 18;
  const shouldShowCue = canScroll && !isAtBottom;

  const cueAnimStyle = useAnimatedStyle(() => ({
    opacity: cueOpacity.value,
    transform: [{ translateY: (1 - cueOpacity.value) * 6 }],
  }));

  useEffect(() => {
    cueOpacity.value = withTiming(shouldShowCue ? 1 : 0, { duration: 180 });
  }, [cueOpacity, shouldShowCue]);

  useEffect(() => {
    setScrollMetrics({ contentHeight: 0, offsetY: 0, viewportHeight: 0 });
    cueOpacity.value = 0;
  }, [cueOpacity, resetKey]);

  const handleContentSizeChange = (width: number, height: number) => {
    if (showScrollCue) {
      setScrollMetrics((current) => ({
        ...current,
        contentHeight: height,
      }));
    }
    onContentSizeChange?.(width, height);
  };

  const handleLayout = (event: LayoutChangeEvent) => {
    if (showScrollCue) {
      const viewportHeight = event.nativeEvent?.layout?.height ?? 0;
      setScrollMetrics((current) => ({
        ...current,
        viewportHeight,
      }));
    }
    onLayout?.(event);
  };

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (showScrollCue) {
      const nativeEvent = event.nativeEvent;
      const contentHeight = nativeEvent?.contentSize?.height ?? 0;
      const offsetY = nativeEvent?.contentOffset?.y ?? 0;
      const viewportHeight = nativeEvent?.layoutMeasurement?.height ?? 0;
      setScrollMetrics({
        contentHeight,
        offsetY,
        viewportHeight,
      });
    }
    onScroll?.(event);
  };

  return (
    <View style={fill ? s.hostFill : s.host}>
      <ScrollView
        {...scrollProps}
        contentContainerStyle={contentContainerStyle}
        keyboardShouldPersistTaps={keyboardShouldPersistTaps ?? "handled"}
        nestedScrollEnabled={nestedScrollEnabled ?? true}
        onContentSizeChange={handleContentSizeChange}
        onLayout={handleLayout}
        onScroll={handleScroll}
        scrollEventThrottle={scrollEventThrottle ?? 16}
        showsVerticalScrollIndicator={showsVerticalScrollIndicator}
        style={[fill ? s.scrollFill : undefined, style]}
      >
        {children}
      </ScrollView>
      {showScrollCue ? (
        <Animated.View
          pointerEvents="none"
          style={[
            s.scrollCue,
            { bottom: cueBottom },
            cueStyle,
            cueAnimStyle,
          ]}
        >
          <ChevronDown color={colors.brand} size={18} strokeWidth={2.4} />
        </Animated.View>
      ) : null}
    </View>
  );
}
