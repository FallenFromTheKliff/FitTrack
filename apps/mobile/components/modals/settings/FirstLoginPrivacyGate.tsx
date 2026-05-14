import { useMemo, useState } from "react";
import { View } from "react-native";
import { ShieldCheck } from "lucide-react-native";

import { useTheme } from "@/contexts/ThemeContext";
import { makePrefModalStyles } from "@/styles/modals/PrefStyles";

import FitButton from "@/components/fit/FitButton";
import { FitText } from "@/components/fit/FitText";
import SettingsModal from "./SettingsModal";

type FirstLoginPrivacyGateProps = {
  isVisible: boolean;
  onAccept: () => Promise<{ success: boolean; error?: string }>;
};

export default function FirstLoginPrivacyGate({
  isVisible,
  onAccept,
}: FirstLoginPrivacyGateProps) {
  const { colors } = useTheme();
  const s = useMemo(() => makePrefModalStyles(colors), [colors]);
  const [isSaving, setIsSaving] = useState(false);
  const [errorText, setErrorText] = useState("");

  const handleAccept = async () => {
    if (isSaving) return;
    setIsSaving(true);
    setErrorText("");
    const result = await onAccept();
    if (!result.success) {
      setErrorText(result.error ?? "Could not save privacy acceptance.");
    }
    setIsSaving(false);
  };

  return (
    <SettingsModal
      allowRequestClose={false}
      visible={isVisible}
      title="Data Privacy Policy"
      icon={ShieldCheck}
      onClose={() => {}}
    >
      <View style={[s.body, { gap: 14 }]}>
        <View style={s.infoCard}>
          <FitText style={s.infoCardTitle}>SertFit Gym Data Privacy</FitText>
          <FitText style={s.infoCardHint}>
            FitTrack stores your account details, contact information,
            verification status, bookings, attendance, payments, workout
            activity, and app usage needed to operate your gym account. Your
            data is used for account security, membership access, booking
            records, coaching support, payments, and service notifications.
          </FitText>
        </View>
        <View style={s.infoCard}>
          <FitText style={s.infoCardTitle}>Your control</FitText>
          <FitText style={s.infoCardHint}>
            Continue only after you understand and accept this policy. You can
            review privacy settings later from Settings.
          </FitText>
        </View>
        {errorText ? (
          <FitText style={[s.infoCardHint, { color: colors.danger }]}>
            {errorText}
          </FitText>
        ) : null}
        <FitButton
          label={isSaving ? "Saving" : "I Accept"}
          variant="primary"
          onPress={handleAccept}
          disabled={isSaving}
          style={{ width: "100%" }}
        />
      </View>
    </SettingsModal>
  );
}
