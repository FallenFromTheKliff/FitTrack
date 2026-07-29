import { useMemo } from "react";
import { View } from "react-native";

import type { FitTrackLegalSection } from "@fittrack/app-config";
import { FITTRACK_LEGAL_VERSION } from "@fittrack/app-config";

import { FitText } from "@/components/fit/FitText";
import { useTheme } from "@/contexts/ThemeContext";
import { makePrefModalStyles } from "@/styles/modals/PrefStyles";

type LegalDocumentSectionsProps = {
  eyebrow: string;
  sections: readonly FitTrackLegalSection[];
};

export function LegalDocumentSections({
  eyebrow,
  sections,
}: LegalDocumentSectionsProps) {
  const { colors } = useTheme();
  const s = useMemo(() => makePrefModalStyles(colors), [colors]);

  return (
    <View style={{ gap: 12 }}>
      <View
        style={{
          borderBottomColor: colors.border,
          borderBottomWidth: 1,
          gap: 4,
          paddingBottom: 12,
        }}
      >
        <FitText style={{ color: colors.brand, fontSize: 12, fontWeight: "800" }}>
          {eyebrow.toUpperCase()}
        </FitText>
        <FitText style={s.infoCardHint}>
          Policy version {FITTRACK_LEGAL_VERSION}. Written in plain language for
          FitTrack members, coaches, staff, and administrators.
        </FitText>
      </View>

      {sections.map((section, index) => (
        <View
          key={section.title}
          style={{
            borderBottomColor: colors.border,
            borderBottomWidth: index === sections.length - 1 ? 0 : 1,
            gap: 5,
            paddingBottom: index === sections.length - 1 ? 0 : 12,
          }}
        >
          <FitText style={s.infoCardTitle}>{section.title}</FitText>
          <FitText style={[s.infoCardHint, { lineHeight: 20 }]}>
            {section.body}
          </FitText>
        </View>
      ))}
    </View>
  );
}
