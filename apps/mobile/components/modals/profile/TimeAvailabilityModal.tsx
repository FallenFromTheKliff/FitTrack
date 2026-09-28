import { useMemo } from "react";
import { Modal, Pressable, StyleSheet, View, useWindowDimensions } from "react-native";
import Animated, { useAnimatedStyle } from "react-native-reanimated";
import { CalendarDays, Clock } from "lucide-react-native";
import { R, MAX_WIDTH } from "@fittrack/ui/tokens";
import { to12HourLabel } from "@fittrack/utils";

import type { ThemeColors } from "@fittrack/types";
import { FitButton, FitText } from "@/components/fit";
import FitModalScrollView from "@/components/modals/shared/FitModalScrollView";
import { useTheme } from "@/contexts/ThemeContext";
import { useThemeTransitionAnim } from "@/hooks/animations/core/useThemeTransition";
import { useOverlayAnim } from "@/hooks/animations/modal/useOverlayAnim";
import {
  type ProfileScreenController,
  WEEKDAY_OPTIONS,
} from "@/hooks/profile/useProfileScreen";

type TimeAvailabilityModalProps = {
  controller: ProfileScreenController;
  isVisible: boolean;
  onClose: () => void;
};

function makeStyles(colors: ThemeColors, smallViewport: boolean) {
  return StyleSheet.create({
    backdrop: {
      alignItems: "center",
      backgroundColor: colors.overlay,
      flex: 1,
      justifyContent: "center",
      paddingHorizontal: 20,
    },
    card: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: R.xl,
      borderWidth: 1,
      height: 500,
      maxHeight: "82%",
      maxWidth: MAX_WIDTH,
      overflow: "hidden",
      width: "100%",
    },
    header: {
      alignItems: "center",
      borderBottomColor: colors.border,
      borderBottomWidth: 1,
      flexDirection: "row",
      gap: 10,
      paddingHorizontal: 16,
      paddingVertical: 14,
    },
    headerIcon: {
      alignItems: "center",
      backgroundColor: colors.surfaceRaised,
      borderColor: colors.border,
      borderRadius: R.md,
      borderWidth: 1,
      height: 34,
      justifyContent: "center",
      width: 34,
    },
    headerCopy: {
      flex: 1,
      gap: 2,
    },
    headerTitle: {
      color: colors.textPrimary,
      fontSize: 17,
      fontWeight: "800",
    },
    headerSubtitle: {
      color: colors.textMuted,
      fontSize: 12,
      lineHeight: 17,
    },
    body: {
      padding: 16,
      gap: 16,
    },
    middle: {
      flex: 1,
      minHeight: 0,
    },
    fieldBlock: {
      gap: 8,
    },
    sectionLabel: {
      color: colors.textMuted,
      fontSize: 11,
      fontWeight: "800",
      letterSpacing: 0.8,
    },
    dayGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
    },
    dayChip: {
      alignItems: "center",
      backgroundColor: colors.surfaceRaised,
      borderColor: colors.border,
      borderRadius: R.md,
      borderWidth: 1,
      flexGrow: 1,
      minWidth: 74,
      paddingHorizontal: 12,
      paddingVertical: 9,
      ...(smallViewport ? { justifyContent: "center" as const, minHeight: 44 } : {}),
    },
    dayChipActive: {
      backgroundColor: colors.brand + "18",
      borderColor: colors.brand,
    },
    dayChipText: {
      color: colors.textPrimary,
      fontSize: 13,
      fontWeight: "700",
    },
    dayChipTextActive: {
      color: colors.brand,
    },
    timeRow: {
      flexDirection: "row",
      gap: 10,
    },
    timeNote: {
      color: colors.textMuted,
      fontSize: 12,
      lineHeight: 17,
    },
    footer: {
      borderTopColor: colors.border,
      borderTopWidth: 1,
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 10,
      padding: 16,
    },
    footerAction: {
      flex: 1,
      minWidth: 96,
    },
  });
}

export default function TimeAvailabilityModal({
  controller,
  isVisible,
  onClose,
}: TimeAvailabilityModalProps) {
  const { colors } = useTheme();
  const { ic } = useThemeTransitionAnim();
  const { opacity, scale } = useOverlayAnim(isVisible, "scale");
  const { width: viewportWidth } = useWindowDimensions();
  const smallViewport = viewportWidth < 360;
  const s = useMemo(() => makeStyles(colors, smallViewport), [colors, smallViewport]);

  const cardStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
    backgroundColor: ic.value.surface,
    borderColor: ic.value.border,
  }));
  const backdropStyle = useAnimatedStyle(() => ({
    backgroundColor: ic.value.overlay,
  }));
  const headerBorderStyle = useAnimatedStyle(() => ({
    borderBottomColor: ic.value.border,
  }));
  const footerBorderStyle = useAnimatedStyle(() => ({
    borderTopColor: ic.value.border,
  }));

  const title = controller.availabilityDraft.id
    ? "Edit Availability"
    : "Add Availability";
  const canSave =
    !!controller.availabilityDraft.startTime &&
    !!controller.availabilityDraft.endTime &&
    !controller.isAvailabilitySaving;

  const handleDelete = () => {
    const target =
      controller.availabilitySlots.find(
        (slot) => slot.id === controller.availabilityDraft.id,
      ) ?? null;
    controller.setAvailabilityDeleteTarget(target);
  };

  return (
    <Modal
      visible={isVisible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <Animated.View style={[s.backdrop, backdropStyle]}>
        <Animated.View style={[s.card, cardStyle]}>
          <Animated.View style={[s.header, headerBorderStyle]}>
            <View style={s.headerIcon}>
              <CalendarDays size={18} color={colors.brand} strokeWidth={2} />
            </View>
            <View style={s.headerCopy}>
              <FitText style={s.headerTitle}>{title}</FitText>
              <FitText style={s.headerSubtitle}>
                Set the day and time window members can book.
              </FitText>
            </View>
          </Animated.View>

          <FitModalScrollView
            contentContainerStyle={s.body}
            resetKey={`${isVisible}-${controller.availabilityDraft.id ?? "new"}`}
            style={s.middle}
          >
            <View style={s.fieldBlock}>
              <FitText style={s.sectionLabel}>DAY OF WEEK</FitText>
              <View style={s.dayGrid}>
                {WEEKDAY_OPTIONS.map((option) => {
                  const isActive =
                    controller.availabilityDraft.dayOfWeek === option.value;
                  return (
                    <Pressable
                      key={option.value}
                      accessibilityRole="button"
                      accessibilityState={{ selected: isActive }}
                      onPress={() =>
                        controller.setAvailabilityDraft((prev) => ({
                          ...prev,
                          dayOfWeek: option.value,
                        }))
                      }
                      style={[s.dayChip, isActive ? s.dayChipActive : null]}
                    >
                      <FitText
                        style={[
                          s.dayChipText,
                          isActive ? s.dayChipTextActive : null,
                        ]}
                      >
                        {option.label}
                      </FitText>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <View style={s.fieldBlock}>
              <FitText style={s.sectionLabel}>TIME RANGE</FitText>
              <View style={s.timeRow}>
                <FitButton
                  label={
                    controller.availabilityDraft.startTime
                      ? to12HourLabel(controller.availabilityDraft.startTime)
                      : "Start Time"
                  }
                  variant="field"
                  icon={Clock}
                  onPress={() => {
                    controller.setAvailabilityTimeTarget("start");
                    controller.setIsAvailabilityTimeOpen(true);
                  }}
                  flex={1}
                />
                <FitButton
                  label={
                    controller.availabilityDraft.endTime
                      ? to12HourLabel(controller.availabilityDraft.endTime)
                      : "End Time"
                  }
                  variant="field"
                  icon={Clock}
                  onPress={() => {
                    if (!controller.availabilityDraft.startTime) return;
                    controller.setAvailabilityTimeTarget("end");
                    controller.setIsAvailabilityTimeOpen(true);
                  }}
                  disabled={!controller.availabilityDraft.startTime}
                  flex={1}
                />
              </View>
              <FitText style={s.timeNote}>
                Choose a start time first, then select the end time for the
                available booking window.
              </FitText>
            </View>
          </FitModalScrollView>

          <Animated.View style={[s.footer, footerBorderStyle]}>
            <FitButton
              label="Cancel"
              variant="ghost"
              onPress={onClose}
              flex={1}
              style={s.footerAction}
            />
            {controller.availabilityDraft.id ? (
              <FitButton
                label="Delete"
                variant="danger"
                onPress={handleDelete}
                flex={1}
                style={s.footerAction}
              />
            ) : null}
            <FitButton
              label={
                controller.isAvailabilitySaving
                  ? "Saving"
                  : controller.availabilityDraft.id
                    ? "Update"
                    : "Save"
              }
              variant="primary"
              onPress={controller.handleSaveAvailability}
              disabled={!canSave}
              flex={1}
              style={s.footerAction}
            />
          </Animated.View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}
