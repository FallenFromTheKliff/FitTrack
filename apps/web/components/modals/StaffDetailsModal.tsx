"use client";
import { Activity, BadgeCheck, Clock } from "lucide-react";
import type { ThemeColors } from "@fittrack/types";
import type { Booking } from "@/data/schedule-constants";

import { FitText } from "@/components/fit/FitText";
import FitModal from "@/components/modals/FitModal";

type Props = {
  isOpen: boolean;
  coachAvailability: string[];
  coachBio?: string | null;
  coachCertifications: string[];
  coachEmail?: string;
  coachHourlyRate?: number | null;
  coachName: string;
  coachSpecialties: string[];
  bookings: Booking[];
  colors: ThemeColors;
  onClose: () => void;
};

function formatPeso(value?: number | null) {
  if (value == null || !Number.isFinite(value)) {
    return "Unset";
  }

  return `PHP ${value.toLocaleString("en-PH")}`;
}

export default function StaffDetailsModal({
  isOpen,
  coachAvailability,
  coachBio,
  coachCertifications,
  coachEmail,
  coachHourlyRate,
  coachName,
  coachSpecialties,
  bookings,
  colors,
  onClose,
}: Props) {
  if (!isOpen) return null;

  const confirmedCount = bookings.filter((b) => b.status === "confirmed").length;
  const venues = [...new Set(bookings.map((b) => b.venueLabel).filter(Boolean))];
  const headerIcon = (
    <div
      style={{
        width: 40,
        height: 40,
        borderRadius: 10,
        backgroundColor: colors.brand,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
      }}
    >
      <FitText
        style={{
          fontSize: 15,
          fontWeight: 700,
          color: colors.onBrand ?? colors.surface,
        }}
      >
        {coachName.slice(0, 2).toUpperCase()}
      </FitText>
    </div>
  );

  return (
    <FitModal
      isOpen={isOpen}
      onClose={onClose}
      title={coachName}
      subtitle="Coach Profile"
      iconNode={headerIcon}
      maxWidth={560}
      closeAriaLabel="Close coach profile"
      contentStyle={{ display: "flex", flexDirection: "column", gap: 18 }}
    >
      <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: 10,
          }}
        >
          {[
            {
              icon: Activity,
              label: "Availability",
              value:
                coachAvailability.length > 0
                  ? `${coachAvailability.length} active slots`
                  : "No active slots",
              color:
                coachAvailability.length > 0 ? colors.success : colors.warning,
            },
            {
              icon: BadgeCheck,
              label: "Rate",
              value: formatPeso(coachHourlyRate),
              color: colors.brand,
            },
            {
              icon: Clock,
              label: "Manual Blocks",
              value: String(confirmedCount),
              color: colors.brand,
            },
          ].map((item) => (
            <div
              key={item.label}
              style={{
                backgroundColor: colors.surfaceRaised,
                borderRadius: 10,
                border: `1px solid ${colors.border}`,
                padding: "12px 14px",
              }}
            >
              <item.icon size={16} color={item.color} strokeWidth={2} />
              <FitText
                style={{
                  fontSize: 11,
                  color: colors.textMuted,
                  display: "block",
                  marginTop: 6,
                }}
              >
                {item.label}
              </FitText>
              <FitText
                style={{
                  fontSize: 14,
                  fontWeight: 700,
                  color: item.color,
                  display: "block",
                  marginTop: 2,
                }}
              >
                {item.value}
              </FitText>
            </div>
          ))}
        </div>
        <div>
          <FitText
            style={{
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: "0.08em",
              color: colors.textMuted,
              marginBottom: 8,
              display: "block",
            }}
          >
            COACH SUMMARY
          </FitText>
          <FitText style={{ fontSize: 14, color: colors.textPrimary }}>
            {coachBio?.trim() ||
              "No coach bio has been added yet. Staff should complete this profile before using it for member-facing bookings."}
          </FitText>
          {coachEmail ? (
            <FitText
              style={{
                fontSize: 12,
                color: colors.textMuted,
                marginTop: 8,
                display: "block",
              }}
            >
              Contact: {coachEmail}
            </FitText>
          ) : null}
        </div>
        <div>
          <FitText
            style={{
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: "0.08em",
              color: colors.textMuted,
              marginBottom: 8,
              display: "block",
            }}
          >
            SPECIALTIES
          </FitText>
          {coachSpecialties.length > 0 ? (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {coachSpecialties.map((specialty) => (
                <div
                  key={specialty}
                  style={{
                    padding: "8px 12px",
                    borderRadius: 999,
                    backgroundColor: `${colors.brand}12`,
                    border: `1px solid ${colors.brand}30`,
                  }}
                >
                  <FitText style={{ fontSize: 13, color: colors.brand }}>
                    {specialty}
                  </FitText>
                </div>
              ))}
            </div>
          ) : (
            <FitText style={{ fontSize: 14, color: colors.textMuted }}>
              No specialties recorded yet.
            </FitText>
          )}
        </div>
        <div>
          <FitText
            style={{
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: "0.08em",
              color: colors.textMuted,
              marginBottom: 8,
              display: "block",
            }}
          >
            CERTIFICATIONS
          </FitText>
          {coachCertifications.length > 0 ? (
            coachCertifications.map((certification) => (
              <div
                key={certification}
                style={{
                  padding: "8px 12px",
                  borderRadius: 8,
                  backgroundColor: colors.surfaceRaised,
                  border: `1px solid ${colors.border}`,
                  marginBottom: 6,
                }}
              >
                <FitText style={{ fontSize: 14, color: colors.textPrimary }}>
                  {certification}
                </FitText>
              </div>
            ))
          ) : (
            <FitText style={{ fontSize: 14, color: colors.textMuted }}>
              No certifications recorded yet.
            </FitText>
          )}
        </div>
        <div>
          <FitText
            style={{
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: "0.08em",
              color: colors.textMuted,
              marginBottom: 8,
              display: "block",
            }}
          >
            ACTIVE WEEKLY AVAILABILITY
          </FitText>
          {coachAvailability.length > 0 ? (
            coachAvailability.map((slot) => (
              <div
                key={slot}
                style={{
                  padding: "8px 12px",
                  borderRadius: 8,
                  backgroundColor: `${colors.success}12`,
                  border: `1px solid ${colors.success}30`,
                  marginBottom: 6,
                }}
              >
                <FitText style={{ fontSize: 14, color: colors.textPrimary }}>
                  {slot}
                </FitText>
              </div>
            ))
          ) : (
            <FitText style={{ fontSize: 14, color: colors.textMuted }}>
              No active availability has been configured yet.
            </FitText>
          )}
        </div>
        {venues.length > 0 ? (
          <div>
            <FitText
              style={{
                fontSize: 12,
                fontWeight: 700,
                letterSpacing: "0.08em",
                color: colors.textMuted,
                marginBottom: 8,
                display: "block",
              }}
            >
              CURRENT MANUAL VENUE TAGS
            </FitText>
            {venues.map((venue) => (
              <div
                key={venue}
                style={{
                  padding: "8px 12px",
                  borderRadius: 8,
                  backgroundColor: `${colors.brand}12`,
                  border: `1px solid ${colors.brand}30`,
                  marginBottom: 6,
                }}
              >
                <FitText style={{ fontSize: 14, color: colors.brand }}>
                  {venue}
                </FitText>
              </div>
            ))}
          </div>
        ) : null}
    </FitModal>
  );
}
