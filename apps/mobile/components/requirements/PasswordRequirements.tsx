import { useEffect, useMemo } from "react";
import { View } from "react-native";
import { CheckCircle, XCircle } from "lucide-react-native";

import { useTheme } from "@/contexts/ThemeContext";
import { PASSWORD_REQUIREMENT_ITEMS, revisePassword } from "@fittrack/utils";
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

  const items: { met: boolean; label: string }[] = PASSWORD_REQUIREMENT_ITEMS.map((item) => ({
    met: r[item.key],
    label: item.label
  }));

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
