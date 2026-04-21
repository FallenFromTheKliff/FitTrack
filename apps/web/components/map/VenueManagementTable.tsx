"use client";
import type { ThemeColors } from "@fittrack/types";
import { FACILITY_FLOOR_MAP, type VenueRecord } from "@/data/facilities/mapTypes";

import { FitText } from "@/components/fit/FitText";
import FitButton from "@/components/fit/FitButton";

type Props = {
  colors: ThemeColors;
  venues: VenueRecord[];
  isLoading: boolean;
  onEditVenue: (venue: VenueRecord) => void;
};

const COLS = "minmax(140px, 1fr) minmax(88px, 0.45fr) minmax(140px, 0.75fr) minmax(120px, 0.65fr) 110px";

export function VenueManagementTable({ colors, venues, isLoading, onEditVenue }: Props) {
  if (isLoading) {
    return <FitText style={{ fontSize: 13, color: colors.textMuted }}>Loading venues...</FitText>;
  }

  if (venues.length === 0) {
    return <FitText style={{ fontSize: 13, color: colors.textMuted }}>No active venues.</FitText>;
  }

  const sortedVenues = [...venues].sort((a, b) => {
    const floorDiff = (a.floorId ?? "floor-1").localeCompare(b.floorId ?? "floor-1");
    if (floorDiff !== 0) return floorDiff;
    const orderDiff = (a.displayOrder ?? 0) - (b.displayOrder ?? 0);
    if (orderDiff !== 0) return orderDiff;
    return a.name.localeCompare(b.name);
  });

  return (
    <div style={{ border: `1px solid ${colors.border}`, borderRadius: 10, overflow: "hidden" }}>
      <div style={{ display: "grid", gridTemplateColumns: COLS, backgroundColor: colors.surfaceRaised }}>
        {["NAME", "CAPACITY", "ZONE", "STATUS", "ACTION"].map((heading) => (
          <FitText
            key={heading}
            style={{ fontSize: 11, fontWeight: 700, padding: "10px 12px", color: colors.textMuted }}
          >
            {heading}
          </FitText>
        ))}
      </div>
      {sortedVenues.map((venue) => (
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
              {FACILITY_FLOOR_MAP[venue.floorId ?? "floor-1"].shortLabel} • C{venue.gridColumn ?? 1}/R{venue.gridRow ?? 1} - {venue.gridWidth ?? 2}x{venue.gridHeight ?? 2}
            </FitText>
          </div>
          <div style={{ padding: "10px 12px", display: "flex", alignItems: "center" }}>
            <FitText
              style={{
                fontSize: 12,
                color: venue.isActive === false ? colors.warning : colors.success
              }}
            >
              {venue.isActive === false
                ? "Inactive"
                : venue.isReservable === false
                  ? "Core Facility"
                  : "Reservable"}
            </FitText>
          </div>
          <div style={{ padding: "8px 10px", display: "flex", gap: 6, alignItems: "center" }}>
            <FitButton variant="ghost" label="EDIT" onClick={() => onEditVenue(venue)} />
          </div>
        </div>
      ))}
    </div>
  );
}
