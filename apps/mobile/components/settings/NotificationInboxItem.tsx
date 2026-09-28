import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentRef,
} from "react";
import {
  AccessibilityInfo,
  PanResponder,
  Platform,
  Pressable,
  View,
  findNodeHandle,
  type GestureResponderEvent,
  type LayoutChangeEvent,
  type PanResponderGestureState,
} from "react-native";
import Animated, {
  cancelAnimation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { Check, ChevronDown, ChevronUp, Trash2 } from "lucide-react-native";
import type { NotificationRecord } from "@fittrack/types";

import { FitText } from "@/components/fit/FitText";
import FitButton from "@/components/fit/FitButton";
import { useTheme } from "@/contexts/ThemeContext";
import { useExpandCard } from "@/hooks/animations/ui/useExpandCard";
import { makePrefModalStyles } from "@/styles/modals/PrefStyles";

const SWIPE_DISTANCE = 92;
const SWIPE_VELOCITY_DISTANCE = 28;
const SWIPE_VELOCITY = 0.75;
const SWIPE_DIRECTION_BIAS = 1.2;
const SWIPE_ACTIVATION_DISTANCE = 8;
const SWIPE_EXIT_DURATION = 180;
const SWIPE_COLLAPSE_DURATION = 210;

type SwipeDirection = -1 | 1;

type WebFocusableNode = {
  contains?: (node: unknown) => boolean;
  focus?: () => void;
};

type NotificationInboxItemProps = {
  errorMessage?: string | null;
  exitDelay?: number;
  exitDirection?: SwipeDirection;
  isDismissed: boolean;
  isInteractionDisabled?: boolean;
  notification: NotificationRecord;
  onDismissRequest: (notificationId: string, direction: SwipeDirection) => boolean;
  onExitComplete: (notificationId: string) => void;
  onMarkRead: (notificationId: string) => void;
  restoreToken: number;
};

function formatNotificationDate(value: string | null | undefined) {
  if (!value) return "Date unavailable";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleString("en-PH", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function getNotificationPreview(body: string) {
  const compact = body.replace(/\s+/g, " ").trim();
  return compact || "No additional message.";
}

function formatLabel(value: string) {
  return value
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatNotificationData(data: Record<string, unknown> | null) {
  if (!data) return null;

  const entries = Object.entries(data).filter(([, value]) => value !== null);
  if (entries.length === 0) return null;

  return entries
    .map(([key, value]) => {
      let displayValue: string;
      if (typeof value === "string") {
        displayValue = value;
      } else {
        try {
          displayValue = JSON.stringify(value);
        } catch {
          displayValue = String(value);
        }
      }
      return `${formatLabel(key)}: ${displayValue}`;
    })
    .join(" • ");
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export default function NotificationInboxItem({
  errorMessage = null,
  exitDelay = 0,
  exitDirection = 1,
  isDismissed,
  isInteractionDisabled = false,
  notification,
  onDismissRequest,
  onExitComplete,
  onMarkRead,
  restoreToken,
}: NotificationInboxItemProps) {
  const { colors, settings } = useTheme();
  const s = useMemo(() => makePrefModalStyles(colors), [colors]);
  const shouldAnimate = settings.animationLevel === "full";
  const [rowHeight, setRowHeight] = useState(0);
  const [rowWidth, setRowWidth] = useState(0);
  const [isHidden, setIsHidden] = useState(false);
  const exitStartedRef = useRef(false);
  const previousDismissedRef = useRef(false);
  const rowToggleRef = useRef<ComponentRef<typeof Pressable>>(null);
  const expandedContentRef = useRef<ComponentRef<typeof View>>(null);
  const translateX = useSharedValue(0);
  const opacity = useSharedValue(1);
  const collapse = useSharedValue(0);
  const {
    bodyHeight,
    setBodyHeight,
    handleToggleExpand,
    isExpanded,
    anim,
    bodyHeightAnim,
    bodyOpacityAnim,
  } = useExpandCard();

  const detailData = useMemo(
    () => formatNotificationData(notification.data),
    [notification.data],
  );

  const focusRowToggleBeforeCollapse = useCallback(() => {
    if (Platform.OS === "web") {
      const activeElement = globalThis.document?.activeElement;
      const expandedNode = expandedContentRef.current as WebFocusableNode | null;
      if (!activeElement || !expandedNode?.contains?.(activeElement)) return;

      const toggleNode = rowToggleRef.current as WebFocusableNode | null;
      toggleNode?.focus?.();
      return;
    }

    const toggleHandle = findNodeHandle(rowToggleRef.current);
    if (toggleHandle) AccessibilityInfo.setAccessibilityFocus(toggleHandle);
  }, []);

  const handleToggleDetails = useCallback(() => {
    if (isExpanded) focusRowToggleBeforeCollapse();
    handleToggleExpand();
  }, [focusRowToggleBeforeCollapse, handleToggleExpand, isExpanded]);

  const finishExit = useCallback(() => {
    setIsHidden(true);
    onExitComplete(notification.id);
  }, [notification.id, onExitComplete]);

  const restoreRow = useCallback(() => {
    cancelAnimation(translateX);
    cancelAnimation(opacity);
    cancelAnimation(collapse);
    setIsHidden(false);
    if (!shouldAnimate) {
      translateX.value = 0;
      opacity.value = 1;
      collapse.value = 0;
      return;
    }

    translateX.value = withTiming(0, { duration: 180 });
    opacity.value = withTiming(1, { duration: 160 });
    collapse.value = withTiming(0, { duration: 220 });
  }, [collapse, opacity, shouldAnimate, translateX]);

  useEffect(() => {
    if (isDismissed) {
      if (exitStartedRef.current) return;

      exitStartedRef.current = true;
      previousDismissedRef.current = true;
      setIsHidden(false);
      const targetX = exitDirection * Math.max(rowWidth, 360);

      if (!shouldAnimate) {
        translateX.value = targetX;
        opacity.value = 0;
        collapse.value = 1;
        finishExit();
        return;
      }

      translateX.value = withDelay(
        exitDelay,
        withTiming(targetX, { duration: SWIPE_EXIT_DURATION }),
      );
      opacity.value = withDelay(
        exitDelay,
        withTiming(0, { duration: 150 }),
      );
      collapse.value = withDelay(
        exitDelay,
        withTiming(1, { duration: SWIPE_COLLAPSE_DURATION }, (finished) => {
          if (finished) runOnJS(finishExit)();
        }),
      );
      return;
    }

    if (exitStartedRef.current || previousDismissedRef.current || isHidden) {
      exitStartedRef.current = false;
      previousDismissedRef.current = false;
      restoreRow();
    }
  }, [
    collapse,
    exitDelay,
    exitDirection,
    finishExit,
    isDismissed,
    isHidden,
    restoreRow,
    restoreToken,
    opacity,
    rowWidth,
    shouldAnimate,
    translateX,
  ]);

  const resetSwipe = useCallback(() => {
    cancelAnimation(translateX);
    if (!shouldAnimate) {
      translateX.value = 0;
      return;
    }
    translateX.value = withSpring(0, {
      damping: 20,
      stiffness: 260,
      mass: 0.7,
    });
  }, [shouldAnimate, translateX]);

  const requestDismiss = useCallback(
    (direction: SwipeDirection) => {
      if (isInteractionDisabled || isDismissed) {
        resetSwipe();
        return;
      }

      if (!onDismissRequest(notification.id, direction)) {
        resetSwipe();
      }
    },
    [
      isDismissed,
      isInteractionDisabled,
      notification.id,
      onDismissRequest,
      resetSwipe,
    ],
  );

  const handlePanMove = useCallback(
    (_event: GestureResponderEvent, gestureState: PanResponderGestureState) => {
      if (isInteractionDisabled || isDismissed) return;
      const maxOffset = Math.max(rowWidth, 360);
      translateX.value = clamp(gestureState.dx, -maxOffset, maxOffset);
    },
    [isDismissed, isInteractionDisabled, rowWidth, translateX],
  );

  const handlePanRelease = useCallback(
    (_event: GestureResponderEvent, gestureState: PanResponderGestureState) => {
      const absDistance = Math.abs(gestureState.dx);
      const absVelocity = Math.abs(gestureState.vx);
      const qualifiesByDistance = absDistance >= SWIPE_DISTANCE;
      const qualifiesByVelocity =
        absDistance >= SWIPE_VELOCITY_DISTANCE && absVelocity >= SWIPE_VELOCITY;

      if (qualifiesByDistance || qualifiesByVelocity) {
        requestDismiss(gestureState.dx < 0 ? -1 : 1);
        return;
      }

      resetSwipe();
    },
    [requestDismiss, resetSwipe],
  );

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_event, gestureState) => {
          if (isInteractionDisabled || isDismissed) return false;
          const absX = Math.abs(gestureState.dx);
          const absY = Math.abs(gestureState.dy);
          return (
            absX > SWIPE_ACTIVATION_DISTANCE &&
            absX > absY * SWIPE_DIRECTION_BIAS
          );
        },
        onPanResponderGrant: () => {
          cancelAnimation(translateX);
        },
        onPanResponderMove: handlePanMove,
        onPanResponderRelease: handlePanRelease,
        onPanResponderTerminate: resetSwipe,
        onPanResponderTerminationRequest: () => true,
        onShouldBlockNativeResponder: () => false,
      }),
    [
      handlePanMove,
      handlePanRelease,
      isDismissed,
      isInteractionDisabled,
      resetSwipe,
      translateX,
    ],
  );

  const rowStyle = useAnimatedStyle(() => ({
    height:
      isDismissed && rowHeight > 0
        ? rowHeight * (1 - collapse.value)
        : undefined,
    marginBottom: 10 * (1 - collapse.value),
    opacity: opacity.value,
    transform: [
      { translateX: translateX.value },
      { scaleY: 0.98 + 0.02 * (1 - collapse.value) },
    ],
  }));
  const expandedStyle = useAnimatedStyle(() => ({
    maxHeight: interpolate(bodyHeightAnim.value, [0, 1], [0, bodyHeight || 720]),
    opacity: bodyOpacityAnim.value,
  }));
  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${interpolate(anim.value, [0, 1], [0, 180])}deg` }],
  }));

  const handleRowLayout = (event: LayoutChangeEvent) => {
    const { height, width } = event.nativeEvent.layout;
    if (!isDismissed && height > 0) {
      setRowHeight((current) => (current === height ? current : height));
    }
    if (width > 0) setRowWidth((current) => (current === width ? current : width));
  };

  if (isHidden) return null;

  const notificationDate = formatNotificationDate(
    notification.sentAt ?? notification.createdAt,
  );
  const preview = getNotificationPreview(notification.body);

  return (
    <Animated.View
      {...panResponder.panHandlers}
      onLayout={handleRowLayout}
      style={[s.notificationItemContainer, rowStyle]}
    >
      <Animated.View
        style={[
          s.notificationItem,
          notification.readAt ? undefined : s.notificationItemUnread,
          { borderColor: notification.readAt ? colors.border : colors.brand + "66" },
        ]}
      >
        <Pressable
          ref={rowToggleRef}
          accessibilityLabel={`${isExpanded ? "Collapse" : "Expand"} notification ${notification.title}`}
          accessibilityRole="button"
          accessibilityState={{ expanded: isExpanded }}
          disabled={isInteractionDisabled}
          onPress={handleToggleDetails}
          style={s.notificationItemHeader}
        >
          <View style={s.notificationUnreadColumn}>
            {!notification.readAt ? (
              <View
                accessibilityLabel="Unread"
                style={[s.notificationUnreadDot, { backgroundColor: colors.brand }]}
              />
            ) : (
              <View style={s.notificationReadDotPlaceholder} />
            )}
          </View>
          <View style={s.notificationItemCopy}>
            <FitText numberOfLines={1} style={s.notificationItemTitle}>
              {notification.title}
            </FitText>
            {!isExpanded ? (
              <FitText numberOfLines={1} style={s.notificationItemPreview}>
                {preview}
              </FitText>
            ) : null}
            <FitText style={s.notificationItemTimestamp}>{notificationDate}</FitText>
          </View>
          <Animated.View style={chevronStyle}>
            {isExpanded ? (
              <ChevronUp color={colors.textMuted} size={18} strokeWidth={2} />
            ) : (
              <ChevronDown color={colors.textMuted} size={18} strokeWidth={2} />
            )}
          </Animated.View>
        </Pressable>

        <Animated.View
          accessibilityElementsHidden={!isExpanded}
          aria-hidden={!isExpanded}
          importantForAccessibility={
            isExpanded ? "auto" : "no-hide-descendants"
          }
          pointerEvents={isExpanded ? "auto" : "none"}
          style={[s.notificationExpanded, expandedStyle]}
        >
          <View
            ref={expandedContentRef}
            onLayout={(event) => {
              const height = event.nativeEvent.layout.height;
              if (height > 0) setBodyHeight(height);
            }}
            style={s.notificationExpandedInner}
          >
            <View style={s.infoCardDivider} />
            <FitText style={s.notificationDetailText}>{notification.body}</FitText>
            <View style={s.notificationMetaRow}>
              <FitText style={s.notificationMetaLabel}>Type</FitText>
              <FitText style={s.notificationMetaValue}>
                {formatLabel(notification.type)}
              </FitText>
            </View>
            <View style={s.notificationMetaRow}>
              <FitText style={s.notificationMetaLabel}>Status</FitText>
              <FitText style={s.notificationMetaValue}>
                {notification.readAt ? "Read" : "Unread"}
              </FitText>
            </View>
            {detailData ? (
              <View style={s.notificationDetailData}>
                <FitText style={s.notificationMetaLabel}>Details</FitText>
                <FitText style={s.notificationMetaValue}>{detailData}</FitText>
              </View>
            ) : null}
            {errorMessage ? (
              <View style={s.notificationError}>
                <FitText style={s.notificationErrorText}>{errorMessage}</FitText>
              </View>
            ) : null}
            <View style={s.notificationItemActions}>
              {!notification.readAt ? (
                <FitButton
                  accessibilityLabel={`Mark notification ${notification.title} as read`}
                  disabled={isInteractionDisabled || !isExpanded}
                  icon={Check}
                  iconSize={15}
                  label="Mark read"
                  onPress={() => onMarkRead(notification.id)}
                  style={s.notificationItemAction}
                  textStyle={s.notificationItemActionText}
                  variant="ghost"
                />
              ) : null}
              <FitButton
                accessibilityLabel={`Dismiss notification ${notification.title}`}
                disabled={isInteractionDisabled || !isExpanded}
                icon={Trash2}
                iconSize={15}
                label="Dismiss"
                onPress={() => requestDismiss(1)}
                style={s.notificationItemAction}
                textStyle={s.notificationItemDismissText}
                variant="danger"
              />
            </View>
          </View>
        </Animated.View>
        {!isExpanded && errorMessage ? (
          <View style={s.notificationError}>
            <FitText style={s.notificationErrorText}>{errorMessage}</FitText>
          </View>
        ) : null}
      </Animated.View>
    </Animated.View>
  );
}
