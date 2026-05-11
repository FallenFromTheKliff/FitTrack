"use client";

import { Building2 } from "lucide-react";
import { GYM_FIELDS, type GymData } from "@fittrack/app-config";

import { useTheme } from "@/contexts/ThemeContext";
import FitSection from "@/components/fit/FitSection";
import { FitText } from "@/components/fit/FitText";

export default function GymDetailsSection() {
  const { colors } = useTheme();
  const gymData = Object.fromEntries(
    GYM_FIELDS.map((field) => [field.key, field.default]),
  ) as GymData;

  return (
    <FitSection
      heading="Gym Details"
      headingStyle={{ fontSize: 13 }}
      action={
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <Building2 size={13} color={colors.brand} />
          <FitText style={{ fontSize: 13, color: colors.brand }}>SertFit Gym</FitText>
        </div>
      }
    >
      <div style={{ padding: "16px 16px 0" }}>
        <FitText as="p" style={{ fontSize: 13, color: colors.textMuted }}>
          Gym profile details are currently read-only and follow the seeded FitTrack configuration.
        </FitText>
      </div>
      <div style={{ padding: 4 }}>
        {GYM_FIELDS.map((field) => (
          <div
            key={field.key}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "16px 16px",
              borderBottom: `1px solid ${colors.border}`
            }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <FitText style={{ fontSize: 13, color: colors.textMuted, display: "block" }}>
                {field.label}
              </FitText>
              <FitText style={{ fontSize: 15, marginTop: 2, display: "block" }}>
                {gymData[field.key]}
              </FitText>
            </div>
          </div>
        ))}
      </div>
    </FitSection>
  );
}
