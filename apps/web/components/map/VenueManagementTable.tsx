"use client";
import type { ThemeColors } from "@fittrack/types";
import type { VenueRecord } from "@/data/facilities/mapTypes";

import { FitText } from "@/components/fit/FitText";
import FitButton from "@/components/fit/FitButton";

type Props = {
    colors: ThemeColors;
    venues: VenueRecord[];
    isLoading: boolean;
    onAddVenue: () => void;
    onEditVenue: (venue: VenueRecord) => void;
    onDeleteVenue: (venue: VenueRecord) => void;
};

const COLS = "minmax(140px, 1fr) minmax(80px, 0.4fr) minmax(120px, 0.7fr) minmax(100px, 0.6fr) 148px";

export function VenueManagementTable({ colors, venues, isLoading, onEditVenue, onDeleteVenue }: Props) {
    if (isLoading) {
        return <FitText style={{ fontSize: 13, color: colors.textMuted }}>Loading venues...</FitText>;
    }
    if (venues.length === 0) {
        return <FitText style={{ fontSize: 13, color: colors.textMuted }}>No active venues.</FitText>;
    }
    return (
        <div style={{ border: `1px solid ${colors.border}`, borderRadius: 10, overflow: "hidden" }}>
            <div style={{ display: "grid", gridTemplateColumns: COLS, backgroundColor: colors.surfaceRaised }}>
                {["NAME", "CAPACITY", "ZONE", "STATUS", "ACTIONS"].map((h) => (
                    <FitText
                        key={h}
                        style={{ fontSize: 11, fontWeight: 700, padding: "10px 12px", color: colors.textMuted }}
                    >
                        {h}
                    </FitText>
                ))}
            </div>
            {venues.map((venue) => (
                <div
                    key={venue.id}
                    style={{ display: "grid", gridTemplateColumns: COLS, borderTop: `1px solid ${colors.border}` }}
                >
                    <div style={{ padding: "10px 12px", display: "flex", alignItems: "center" }}>
                        <FitText style={{ fontSize: 13, fontWeight: 600 }}>{venue.name}</FitText>
                    </div>
                    <div style={{ padding: "10px 12px", display: "flex", alignItems: "center" }}>
                        <FitText style={{ fontSize: 13 }}>{venue.capacity ?? 0}</FitText>
                    </div>
                    <div style={{ padding: "10px 12px", display: "flex", alignItems: "center" }}>
                        <FitText style={{ fontSize: 13 }}>
                            C{venue.gridColumn ?? 1}/R{venue.gridRow ?? 1} · {venue.gridWidth ?? 2}x{venue.gridHeight ?? 2}
                        </FitText>
                    </div>
                    <div style={{ padding: "10px 12px", display: "flex", alignItems: "center" }}>
                        <FitText style={{
                            fontSize: 12,
                            color: venue.isActive === false ? colors.warning : colors.success
                        }}>
                            {venue.isActive === false
                                ? "Inactive"
                                : venue.isReservable === false
                                    ? "Core Facility"
                                    : "Reservable"}
                        </FitText>
                    </div>
                    <div style={{ padding: "8px 10px", display: "flex", gap: 6, alignItems: "center" }}>
                        <FitButton variant="ghost" label="EDIT" onClick={() => onEditVenue(venue)} />
                        <FitButton
                            variant="danger"
                            label={venue.isSystem ? "LOCKED" : "DELETE"}
                            onClick={() => onDeleteVenue(venue)}
                            disabled={venue.isSystem}
                        />
                    </div>
                </div>
            ))}
        </div>
    );
}