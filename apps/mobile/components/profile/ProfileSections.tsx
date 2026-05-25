import { Skull, XCircle } from "lucide-react-native";

import { makeProfileStyles } from "@/styles/shared/ScreenStyles";
import { FitButton, FitText } from "@/components/fit";
import CoachProfileSections from "@/components/profile/CoachProfileSections";
import MemberProfileSections from "@/components/profile/MemberProfileSections";
import { type ProfileScreenController } from "@/hooks/profile/useProfileScreen";

type ProfileColors = {
  border: string;
  brand: string;
  success: string;
  surface: string;
  surfaceRaised: string;
  textMuted: string;
  textPrimary: string;
  warning: string;
};

type ProfileSectionsProps = {
  colors: ProfileColors;
  controller: ProfileScreenController;
  styles: ReturnType<typeof makeProfileStyles>;
};

export default function ProfileSections({ colors, controller, styles }: ProfileSectionsProps) {
  return (
    <>
      {controller.statusMessage ? (
        <FitText style={{ fontSize: 12, color: colors.textMuted, lineHeight: 18, marginBottom: 12 }}>
          {controller.statusMessage}
        </FitText>
      ) : null}
      {controller.isCoach ? (
        <CoachProfileSections colors={colors} controller={controller} styles={styles} />
      ) : (
        <MemberProfileSections colors={colors} controller={controller} styles={styles} />
      )}
      {controller.isMember ? (
        <FitButton
          label={controller.hasPendingTermination ? "CANCEL TERMINATION REQUEST" : "REQUEST ACCOUNT TERMINATION"}
          variant="danger"
          icon={controller.hasPendingTermination ? XCircle : Skull}
          onPress={() => (controller.hasPendingTermination ? controller.setCancelVisible(true) : controller.setTerminateVisible(true))}
          style={styles.terminateBtn}
        />
      ) : null}
    </>
  );
}
