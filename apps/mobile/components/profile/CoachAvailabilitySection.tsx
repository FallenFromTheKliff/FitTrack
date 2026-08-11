import { Pressable } from "react-native";
import { CalendarDays, Plus } from "lucide-react-native";
import { to12HourLabel } from "@fittrack/utils";

import { makeProfileStyles } from "@/styles/shared/ScreenStyles";
import { FitCard, FitSection, FitText } from "@/components/fit";
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
    <FitSection
      heading="AVAILABILITY"
      headerAccessory={
        controller.availabilityLocked ? null : (
          <Pressable
            accessibilityLabel="Add availability slot"
            accessibilityRole="button"
            hitSlop={8}
            onPress={() => controller.handleStartAvailabilityEditor()}
            style={styles.availabilityAddButton}
          >
            <Plus size={18} color="#FFFFFF" strokeWidth={2.8} />
          </Pressable>
        )
      }
    >
      {controller.availabilityLocked ? (
        <FitText
          style={{
            color: colors.textMuted,
            fontSize: 12,
            lineHeight: 18,
            marginBottom: 10,
            paddingHorizontal: 16,
            paddingTop: 14
          }}
        >
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
    </FitSection>
  );
}
