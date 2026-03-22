import { useEffect, useMemo } from "react";
import { View } from "react-native";
import { CheckCircle, XCircle } from "lucide-react-native";

import { useTheme } from "@/contexts/ThemeContext";
import { revisePassword } from "@fittrack/utils";
import { makeRequirementStyles } from "@/styles/components/RequirementStyles";

import { FitText } from "@/components/fit/FitText";

type Props = {
  password: string;
  onValidationChange: (isValid: boolean) => void;
};

export default function PasswordRequirements({ password, onValidationChange }: Props) {
  const { colors } = useTheme();
  const r = revisePassword(password);
  const allMet = r.minLength && r.hasUppercase && r.hasLowercase && r.hasNumber && r.hasSpecial;
  const s = useMemo(() => makeRequirementStyles(colors, allMet), [colors, allMet]);

  useEffect(() => {
    onValidationChange(allMet);
  }, [allMet, onValidationChange]);

  const items: { met: boolean; label: string }[] = [
    { met: r.minLength, label: "Minimum 8 characters" },
    { met: r.hasUppercase, label: "At least one uppercase letter (A–Z)" },
    { met: r.hasLowercase, label: "At least one lowercase letter (a–z)" },
    { met: r.hasNumber, label: "At least one number (0–9)" },
    { met: r.hasSpecial, label: "At least one special character (@$!%*?&)" }
  ];

  return (
    <View style={s.container}>
      <FitText style={s.header}>Password Requirements:</FitText>
      {items.map(({ met, label }) => (
        <View key={label} style={s.row}>
          {met ? (
            <CheckCircle size={15} color={colors.brand} strokeWidth={2} />
          ) : (
            <XCircle size={15} color={colors.danger} strokeWidth={2} />
          )}
          <FitText style={[s.text, met && s.textMet]}>{label}</FitText>
        </View>
      ))}
    </View>
  );
}