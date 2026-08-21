import { useMemo } from "react";
import { Modal, Pressable, View } from "react-native";
import Animated, { useAnimatedStyle } from "react-native-reanimated";
import { Clock, CheckCircle } from "lucide-react-native";

import { useTheme } from "@/contexts/ThemeContext";
import { useThemeTransitionAnim } from "@/hooks/animations/core/useThemeTransition";
import { useOverlayAnim } from "@/hooks/animations/modal/useOverlayAnim";
import { makeTimeSlotModalStyles } from "@/styles/modals/TimeSlotStyles";

import { FitText, AnimatedFitText } from "@/components/fit/FitText";
import FitButton from "@/components/fit/FitButton";
import FitModalScrollView from "./FitModalScrollView";

export type TimeSlot = {
  time: string;
  duration: string;
  status: "available" | "selected" | "waitlisted" | "full";
  spots?: number;
};

type Props = {
  emptyMessage?: string;
  isVisible: boolean;
  slots: TimeSlot[];
  selectedTime: string;
  showAvailabilityLegend?: boolean;
  title?: string;
  onSelect: (slot: TimeSlot) => void;
  onClose: () => void;
};

export default function TimeSlotModal({
  emptyMessage = "No time slots are available.",
  isVisible,
  slots,
  selectedTime,
  showAvailabilityLegend = true,
  title = "Available Time Slots",
  onSelect,
  onClose,
}: Props) {
  const { colors } = useTheme();
  const { ic } = useThemeTransitionAnim();
  const { opacity, scale } = useOverlayAnim(isVisible, "scale");
  const s = useMemo(() => makeTimeSlotModalStyles(), []);

  const backdropStyle = useAnimatedStyle(() => ({ backgroundColor: ic.value.overlay }));
  const cardStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
    backgroundColor: ic.value.surface,
    borderColor: ic.value.border
  }));
  const headerBorderStyle = useAnimatedStyle(() => ({ borderBottomColor: ic.value.border }));
  const titleStyle = useAnimatedStyle(() => ({ color: ic.value.textPrimary }));
  const legendBorderStyle = useAnimatedStyle(() => ({ borderBottomColor: ic.value.border }));
  const footerBorderStyle = useAnimatedStyle(() => ({ borderTopColor: ic.value.border }));

  const getSlotColors = (status: TimeSlot["status"], isChosen: boolean) => {
    if (isChosen)
      return {
        bg: colors.brand,
        border: colors.brand,
        text: colors.surface,
        subText: colors.surface + "CC"
      };
    switch (status) {
      case "available":
        return {
          bg: colors.fieldBg,
          border: colors.fieldBorder,
          text: colors.textPrimary,
          subText: colors.textMuted
        };
      case "waitlisted":
        return {
          bg: colors.warning + "18",
          border: colors.warning,
          text: colors.textPrimary,
          subText: colors.warning
        };
      case "full":
        return {
          bg: colors.surfaceRaised,
          border: colors.border,
          text: colors.textDisabled,
          subText: colors.textDisabled
        };
      default:
        return {
          bg: colors.fieldBg,
          border: colors.fieldBorder,
          text: colors.textPrimary,
          subText: colors.textMuted
        };
    }
  };
  return (
    <Modal
      visible={isVisible}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Animated.View style={[s.backdrop, backdropStyle]}>
        <Animated.View style={[s.card, cardStyle]}>
          <Animated.View style={[s.header, headerBorderStyle]}>
            <View style={[s.headerIcon, { backgroundColor: colors.brand + "22", borderColor: colors.brand + "44"}]}>
              <Clock size={18} color={colors.brand} strokeWidth={2} />
            </View>
            <AnimatedFitText style={[s.headerTitle, titleStyle]}>{title}</AnimatedFitText>
          </Animated.View>
          {showAvailabilityLegend ? (
            <Animated.View style={[s.legend, legendBorderStyle]}>
              <FitText style={[s.legendLabel, { color: colors.textMuted }]}>LEGEND:</FitText>
              <View style={s.legendItem}>
                <View style={[s.legendDot, { backgroundColor: colors.brand }]} />
                <FitText style={[s.legendText, { color: colors.textMuted }]}>Selected</FitText>
              </View>
              <View style={s.legendItem}>
                <View style={[s.legendDot, { borderWidth: 1, borderColor: colors.fieldBorder, backgroundColor: colors.fieldBg}]} />
                <FitText style={[s.legendText, { color: colors.textMuted }]}>
                  Available
                </FitText>
              </View>
              <View style={s.legendItem}>
                <View style={[s.legendDot, { backgroundColor: colors.warning }]} />
                <FitText style={[s.legendText, { color: colors.textMuted }]}>Waitlist</FitText>
              </View>
              <View style={s.legendItem}>
                <View style={[s.legendDot, { backgroundColor: colors.surfaceRaised, borderWidth: 1, borderColor: colors.border }]} />
                <FitText style={[s.legendText, { color: colors.textMuted }]}>Full</FitText>
              </View>
            </Animated.View>
          ) : null}
          <FitModalScrollView
            contentContainerStyle={s.grid}
            resetKey={`${isVisible}-${selectedTime}-${slots.length}`}
          >
            {slots.length === 0 ? (
              <FitText style={[s.emptyText, { color: colors.textMuted }]}>
                {emptyMessage}
              </FitText>
            ) : slots.map((slot) => {
              const isChosen = slot.time === selectedTime;
              const isFull = slot.status === "full";
              const c = getSlotColors(slot.status, isChosen);
              const statusLabel = isFull
                ? "full"
                : isChosen
                  ? "selected"
                  : slot.status === "waitlisted"
                    ? "waitlist"
                    : "available";
              return (
                <Pressable
                  key={slot.time}
                  style={[
                    s.slotCard,
                    { backgroundColor: c.bg, borderColor: c.border }
                  ]}
                  onPress={() => !isFull && onSelect(slot)}
                  disabled={isFull}
                  accessibilityRole="button"
                  accessibilityLabel={`${slot.time}, ${slot.duration}, ${statusLabel}`}
                  accessibilityState={{ disabled: isFull, selected: isChosen }}
                >
                  <FitText style={[s.slotTime, { color: c.text }]}>
                    {slot.time}
                  </FitText>
                  <FitText style={[s.slotDuration, { color: c.subText }]}>
                    {slot.duration}
                  </FitText>
                  {slot.status === "waitlisted" && slot.spots !== undefined && (
                    <FitText style={[s.slotSpots, { color: c.subText }]}>
                      {slot.spots}
                    </FitText>
                  )}
                  {isChosen && (
                    <CheckCircle
                      size={14}
                      color={colors.surface}
                      strokeWidth={2.5}
                      style={s.slotCheck}
                    />
                  )}
                </Pressable>
              );
            })}
          </FitModalScrollView>
          <Animated.View style={[s.footer, footerBorderStyle]}>
            <FitButton
              label="Cancel"
              variant="primary"
              onPress={onClose}
              flex={1}
            />
          </Animated.View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}
