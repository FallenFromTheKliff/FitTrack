import { Pressable, View } from "react-native";
import { CalendarDays } from "lucide-react-native";
import { to12HourLabel } from "@fittrack/utils";

import { makeProfileStyles } from "@/styles/shared/ScreenStyles";
import { FitButton, FitCard, FitSection, FitText } from "@/components/fit";
import { type ProfileScreenController, WEEKDAY_OPTIONS } from "@/hooks/profile/useProfileScreen";

type ProfileColors = {
  border: string;
  brand: string;
  success: string;
  surface: string;
  surfaceRaised: string;
  textMuted: string;
  textPrimary: string;
};

type CoachAvailabilitySectionProps = {
  colors: ProfileColors;
  controller: ProfileScreenController;
  styles: ReturnType<typeof makeProfileStyles>;
};

export default function CoachAvailabilitySection({ colors, controller, styles }: CoachAvailabilitySectionProps) {
  return (
    <FitSection heading="AVAILABILITY">
      {controller.availabilityLocked ? (
        <FitText style={{ color: colors.textMuted, fontSize: 12, lineHeight: 18, marginBottom: 10 }}>
          Full-time working days and hours are managed by admin. These windows generate hourly member booking slots automatically.
        </FitText>
      ) : null}
      {controller.availabilitySlots.map((slot, index) => (
        <FitCard
          key={slot.id}
          icon={CalendarDays}
          label={WEEKDAY_OPTIONS.find((option) => option.value === slot.dayOfWeek)?.label ?? `Day ${slot.dayOfWeek}`}
          subtitle={`${to12HourLabel(slot.startTime)} - ${to12HourLabel(slot.endTime)}`}
          trailingLabel="Active"
          trailingLabelColor={colors.success}
          hasBorder={index < controller.availabilitySlots.length - 1}
          onPress={controller.availabilityLocked ? undefined : () => controller.handleStartAvailabilityEditor(slot)}
        />
      ))}
      {!controller.availabilityLocked ? (
        <FitButton
          label="Add Availability Slot"
          variant="primary"
          onPress={() => controller.handleStartAvailabilityEditor()}
          style={{ marginTop: 12 }}
        />
      ) : null}
      {controller.isAvailabilityEditorOpen ? (
        <View
          style={{
            marginTop: 12,
            padding: 14,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: 16,
            backgroundColor: colors.surface
          }}
        >
          <FitText style={{ fontSize: 12, color: colors.textMuted, marginBottom: 8 }}>DAY OF WEEK</FitText>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
            {WEEKDAY_OPTIONS.map((option) => {
              const isActive = controller.availabilityDraft.dayOfWeek === option.value;
              return (
                <Pressable
                  key={option.value}
                  onPress={() => controller.setAvailabilityDraft((prev) => ({ ...prev, dayOfWeek: option.value }))}
                  style={{
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: isActive ? colors.brand : colors.border,
                    backgroundColor: isActive ? colors.brand + "18" : colors.surfaceRaised
                  }}
                >
                  <FitText style={{ color: isActive ? colors.brand : colors.textPrimary, fontWeight: "600" }}>
                    {option.label}
                  </FitText>
                </Pressable>
              );
            })}
          </View>
          <FitText style={{ fontSize: 12, color: colors.textMuted, marginBottom: 8 }}>TIME RANGE</FitText>
          <View style={{ flexDirection: "row", gap: 10 }}>
            <FitButton
              label={controller.availabilityDraft.startTime ? to12HourLabel(controller.availabilityDraft.startTime) : "Start Time"}
              variant="field"
              onPress={() => {
                controller.setAvailabilityTimeTarget("start");
                controller.setIsAvailabilityTimeOpen(true);
              }}
              flex={1}
            />
            <FitButton
              label={controller.availabilityDraft.endTime ? to12HourLabel(controller.availabilityDraft.endTime) : "End Time"}
              variant="field"
              onPress={() => {
                if (!controller.availabilityDraft.startTime) return;
                controller.setAvailabilityTimeTarget("end");
                controller.setIsAvailabilityTimeOpen(true);
              }}
              disabled={!controller.availabilityDraft.startTime}
              flex={1}
            />
          </View>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 14 }}>
            <FitButton
              label="Cancel"
              variant="ghost"
              onPress={() => {
                controller.setIsAvailabilityEditorOpen(false);
                controller.setAvailabilityDeleteTarget(null);
              }}
              flex={1}
              style={{ minWidth: 96 }}
            />
            {controller.availabilityDraft.id ? (
              <FitButton
                label="Delete"
                variant="danger"
                onPress={() => {
                  const target = controller.availabilitySlots.find((slot) => slot.id === controller.availabilityDraft.id) ?? null;
                  controller.setAvailabilityDeleteTarget(target);
                }}
                flex={1}
                style={{ minWidth: 96 }}
              />
            ) : null}
            <FitButton
              label={controller.isAvailabilitySaving ? "Saving" : controller.availabilityDraft.id ? "Update" : "Save"}
              variant="primary"
              onPress={controller.handleSaveAvailability}
              disabled={!controller.availabilityDraft.startTime || !controller.availabilityDraft.endTime || controller.isAvailabilitySaving}
              flex={1}
              style={{ minWidth: 96 }}
            />
          </View>
        </View>
      ) : null}
    </FitSection>
  );
}
