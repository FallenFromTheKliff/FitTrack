"use client";
import { useTheme } from "@/contexts/ThemeContext";
import { BORDER_RADIUS } from "@fittrack/ui/tokens";
import type { Resource } from "@/data/schedule-constants";

import { FitText } from "@/components/fit/FitText";
import FitButton from "@/components/fit/FitButton";

type Props = {
    resource: Resource;
    bookingCount: number;
    isActive: boolean;
    onSelect: (id: string) => void;
    subtitle?: string;
};

export default function RosterCard({ resource, bookingCount, isActive, onSelect, subtitle }: Props) {
    const { colors } = useTheme();

    return (
        <FitButton
            variant="card"
            active={isActive}
            onClick={() => onSelect(resource.id)}
        >
            <div style={{
                width: 34,
                height: 34,
                borderRadius: BORDER_RADIUS.card ?? 10,
                flexShrink: 0,
                backgroundColor: isActive ? `${colors.brand}22` : colors.surfaceRaised,
                border: `1px solid ${isActive ? colors.brand : colors.border}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center"
            }}>
                {resource.initials ? (
                    <FitText as="span" style={{ fontSize: 12, fontWeight: 700, color: isActive ? colors.brand : colors.textPrimary }}>
                        {resource.initials}
                    </FitText>
                ) : (
                    <FitText as="span">{resource.icon}</FitText>
                )}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
                <FitText as="span" style={{ fontSize: 14, fontWeight: 700, display: "block" }}>
                    {resource.name}
                </FitText>
                <FitText as="span" style={{ fontSize: 12, color: colors.textMuted, display: "block", marginTop: 2 }}>
                    {subtitle ?? (resource.type === "trainer" ? "Staff" : "Facility")}
                </FitText>
            </div>
            <FitText as="span" style={{ fontSize: 11, color: colors.textMuted, flexShrink: 0 }}>
                {bookingCount} bookings
            </FitText>
        </FitButton>
    );
}
