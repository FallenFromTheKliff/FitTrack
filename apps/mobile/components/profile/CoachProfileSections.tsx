import { View } from "react-native";
import { CalendarDays, CreditCard, UserCog } from "lucide-react-native";

import { makeProfileStyles } from "@/styles/shared/ScreenStyles";
import { FitCard, FitSection } from "@/components/fit";
import { type ProfileScreenController } from "@/hooks/profile/useProfileScreen";

import CoachAvailabilitySection from "@/components/profile/CoachAvailabilitySection";

type ProfileColors = {
  success: string;
  warning: string;
  border: string;
  brand: string;
  surface: string;
  surfaceRaised: string;
  textMuted: string;
  textPrimary: string;
};

type CoachProfileSectionsProps = {
  colors: ProfileColors;
  controller: ProfileScreenController;
  styles: ReturnType<typeof makeProfileStyles>;
};

export default function CoachProfileSections({ colors, controller, styles }: CoachProfileSectionsProps) {
  return (
    <>
      <FitSection heading="COACH SUMMARY">
        <View style={styles.statsRow}>
          <View style={{ flex: 1, flexDirection: "row", alignItems: "stretch" }}>
            <FitCard
              icon={CreditCard}
              iconSize={20}
              label="Hourly Rate"
              statValue={controller.coachProfile?.hourlyRate ? `PHP ${controller.coachProfile.hourlyRate}` : "--"}
            />
            <View style={styles.statDivider} />
          </View>
          <View style={{ flex: 1, flexDirection: "row", alignItems: "stretch" }}>
            <FitCard
              icon={CalendarDays}
              iconSize={20}
              label="Active Slots"
              statValue={String(controller.availabilitySlots.length)}
            />
          </View>
        </View>
      </FitSection>
      <FitSection heading="COACH PROFILE">
        <FitCard
          icon={UserCog}
          label="Edit Coach Profile"
          subtitle={controller.coachProfile?.specialties?.length
            ? controller.coachProfile.specialties.join(", ")
            : "Update bio, specialties, certifications, and rates"}
          hasBorder
          onPress={() => controller.setEditVisible(true)}
        />
        <FitCard
          icon={CalendarDays}
          label="Availability Status"
          subtitle={controller.availabilityLocked ? "Full-time schedule is admin controlled" : controller.coachProfile?.isActive === false ? "Coach profile is inactive" : "Coach profile is active"}
          trailingLabel={controller.availabilityLocked ? "Full-Time" : controller.coachProfile?.isActive === false ? "Inactive" : "Active"}
          trailingLabelColor={controller.coachProfile?.isActive === false ? colors.warning : colors.success}
          noChevron
        />
      </FitSection>
      <CoachAvailabilitySection colors={colors} controller={controller} styles={styles} />
    </>
  );
}
