"use client";
import { useTheme } from "@/contexts/ThemeContext";
import type { Resource } from "./types";

import FitCard from "@/components/fit/FitCard";
import { FitText } from "@/components/fit/FitText";

const VENUE_ICON_MAP: Record<string, string> = {
    basketball: "🏀",
    volleyball: "🏐",
    boxing: "🥊",
    reception: "🛎️",
    "gym-area": "🏋️",
    pool: "🏊",
    yoga: "🧘",
    cycling: "🚴",
    tennis: "🎾",
    cardio: "💓",
    weights: "💪",
    martial: "🥋",
    default: "🏟️"
};

function resolveVenueIcon(resource: Resource): string {
    if (resource.icon && resource.icon.trim() && !resource.initials) return resource.icon;
    const nameLower = resource.name.toLowerCase();
    for (const [key, emoji] of Object.entries(VENUE_ICON_MAP)) {
        if (key !== "default" && nameLower.includes(key)) return emoji;
    }
    return VENUE_ICON_MAP.default;
}

function resolveTypeLabel(resource: Resource): string {
    if (resource.type === "facility") {
        const nameLower = resource.name.toLowerCase();
        if (nameLower.includes("court") || nameLower.includes("ring") || nameLower.includes("pool")) return "Venue";
        if (nameLower.includes("reception")) return "Core Facility";
        if (nameLower.includes("gym") || nameLower.includes("area")) return "Gym Area";
        return "Facility";
    }
    return "Activity";
}

type Props = {
    resource: Resource;
};

export default function ResourceCard({ resource }: Props) {
    const { colors } = useTheme();
    const icon = resolveVenueIcon(resource);
    const typeLabel = resolveTypeLabel(resource);

    return (
        <FitCard
            renderMode="custom"
            contentStyle={{
                padding: 16, borderRadius: 12,
                border: `1px solid ${colors.border}`,
                backgroundColor: colors.surface,
                gap: 14, alignItems: "center"
            }}
        >
            <div style={{
                width: 46, height: 46, borderRadius: 12, flexShrink: 0,
                backgroundColor: colors.surfaceRaised,
                border: `1px solid ${colors.border}`,
                display: "flex", alignItems: "center", justifyContent: "center"
            }}>
                <FitText as="span" style={{ fontSize: 22 }}>{icon}</FitText>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
                <FitText as="span" style={{ fontSize: 15, fontWeight: 700, display: "block" }}>
                    {resource.name}
                </FitText>
                <FitText as="span" style={{ fontSize: 12, color: colors.textMuted, marginTop: 4, display: "block" }}>
                    {typeLabel}
                </FitText>
            </div>
            <FitText as="span" style={{ fontSize: 12, color: colors.textMuted, flexShrink: 0 }}>
                {typeLabel}
            </FitText>
        </FitCard>
    );
}