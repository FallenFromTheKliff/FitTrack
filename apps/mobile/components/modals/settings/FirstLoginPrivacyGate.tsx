import { useMemo, useState } from "react";
import { View } from "react-native";
import { ShieldCheck } from "lucide-react-native";
import {
  FITTRACK_PRIVACY_SECTIONS,
  FITTRACK_TERMS_SECTIONS,
} from "@fittrack/app-config";

import { useTheme } from "@/contexts/ThemeContext";
import { makePrefModalStyles } from "@/styles/modals/PrefStyles";

import FitButton from "@/components/fit/FitButton";
import { FitText } from "@/components/fit/FitText";
import { LegalDocumentSections } from "@/components/legal/LegalDocumentSections";
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
      showScrollHint
      onClose={() => {}}
    >
      <View style={[s.body, { gap: 14 }]}>
        <LegalDocumentSections
          eyebrow="Terms of Service"
          sections={FITTRACK_TERMS_SECTIONS}
        />
        <LegalDocumentSections
          eyebrow="Philippine Data Privacy Notice"
          sections={FITTRACK_PRIVACY_SECTIONS}
        />
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
