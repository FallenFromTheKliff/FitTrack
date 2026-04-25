"use client";

import type { GymLayoutEquipmentRecord, ThemeColors } from "@fittrack/types";
import type { VenueRecord } from "@/data/facilities/mapTypes";
import { FACILITY_FLOOR_MAP } from "@/data/facilities/floorPlans";

import FitButton from "@/components/fit/FitButton";
import { FitText } from "@/components/fit/FitText";
import { FitModal } from "@/components/modals";

export type FacilitiesArchiveFilter = "all" | "venues" | "equipment";

type Props = {
  archivedEquipment: GymLayoutEquipmentRecord[];
  archivedVenues: VenueRecord[];
  colors: ThemeColors;
  filter: FacilitiesArchiveFilter;
  isLoadingEquipment: boolean;
  isLoadingVenues: boolean;
  isOpen: boolean;
  isRestoringEquipment: boolean;
  isRestoringVenue: boolean;
  onClose: () => void;
  onFilterChange: (filter: FacilitiesArchiveFilter) => void;
  onRestoreEquipment: (equipment: GymLayoutEquipmentRecord) => void;
  onRestoreVenue: (venue: VenueRecord) => void;
};

const FILTERS: Array<{ label: string; value: FacilitiesArchiveFilter }> = [
  { label: "All", value: "all" },
  { label: "Venues", value: "venues" },
  { label: "Equipment", value: "equipment" },
];

function resolveVenueZone(venue: VenueRecord) {
  const floorId = venue.floorId ?? "floor-1";
  const floor = FACILITY_FLOOR_MAP[floorId];
  return `${floor.shortLabel} - C${venue.gridColumn ?? 1}/R${venue.gridRow ?? 1}`;
}

export function FacilitiesArchiveModal({
  archivedEquipment,
  archivedVenues,
  colors,
  filter,
  isLoadingEquipment,
  isLoadingVenues,
  isOpen,
  isRestoringEquipment,
  isRestoringVenue,
  onClose,
  onFilterChange,
  onRestoreEquipment,
  onRestoreVenue,
}: Props) {
  const showVenues = filter === "all" || filter === "venues";
  const showEquipment = filter === "all" || filter === "equipment";
  const isLoading = (showVenues && isLoadingVenues) || (showEquipment && isLoadingEquipment);
  const hasRows =
    (showVenues && archivedVenues.length > 0) ||
    (showEquipment && archivedEquipment.length > 0);

  return (
    <FitModal
      isOpen={isOpen}
      onClose={onClose}
      title="Manage Archive"
      subtitle="Restore soft-deleted venues and floor-plan equipment placements."
      maxWidth={720}
      closeAriaLabel="Close facilities archive"
    >
      <div style={{ display: "grid", gap: 14 }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {FILTERS.map((option) => (
            <FitButton
              key={option.value}
              variant={filter === option.value ? "primary" : "ghost"}
              label={option.label}
              onClick={() => onFilterChange(option.value)}
            />
          ))}
        </div>

        {isLoading ? (
          <FitText style={{ fontSize: 13, color: colors.textMuted }}>
            Loading archived facilities...
          </FitText>
        ) : null}

        {!isLoading && !hasRows ? (
          <div
            style={{
              border: `1px solid ${colors.border}`,
              borderRadius: 12,
              backgroundColor: colors.surfaceRaised,
              padding: "18px 16px",
            }}
          >
            <FitText style={{ fontSize: 14, color: colors.textMuted }}>
              No archived facilities match this filter.
            </FitText>
          </div>
        ) : null}

        {showVenues && archivedVenues.length > 0 ? (
          <div style={{ display: "grid", gap: 8 }}>
            <FitText style={{ fontSize: 12, fontWeight: 700, color: colors.textMuted, letterSpacing: "0.08em", textTransform: "uppercase" }}>
              Archived Venues
            </FitText>
            {archivedVenues.map((venue) => (
              <div
                key={String(venue.id)}
                style={{
                  display: "grid",
                  gridTemplateColumns: "minmax(0, 1fr) auto",
                  gap: 12,
                  alignItems: "center",
                  border: `1px solid ${colors.border}`,
                  borderRadius: 12,
                  backgroundColor: colors.surfaceRaised,
                  padding: "12px 14px",
                }}
              >
                <div style={{ display: "grid", gap: 4, minWidth: 0 }}>
                  <FitText style={{ fontSize: 14, fontWeight: 700 }}>{venue.name}</FitText>
                  <FitText style={{ fontSize: 12, color: colors.textMuted }}>
                    {resolveVenueZone(venue)} - {venue.isReservable === false ? "Facility zone" : "Reservable"}
                  </FitText>
                </div>
                <FitButton
                  variant="ghost"
                  label="RESTORE"
                  loading={isRestoringVenue}
                  onClick={() => onRestoreVenue(venue)}
                />
              </div>
            ))}
          </div>
        ) : null}

        {showEquipment && archivedEquipment.length > 0 ? (
          <div style={{ display: "grid", gap: 8 }}>
            <FitText style={{ fontSize: 12, fontWeight: 700, color: colors.textMuted, letterSpacing: "0.08em", textTransform: "uppercase" }}>
              Archived Equipment Placements
            </FitText>
            {archivedEquipment.map((equipment) => (
              <div
                key={equipment.id}
                style={{
                  display: "grid",
                  gridTemplateColumns: "minmax(0, 1fr) auto",
                  gap: 12,
                  alignItems: "center",
                  border: `1px solid ${colors.border}`,
                  borderRadius: 12,
                  backgroundColor: colors.surfaceRaised,
                  padding: "12px 14px",
                }}
              >
                <div style={{ display: "grid", gap: 4, minWidth: 0 }}>
                  <FitText style={{ fontSize: 14, fontWeight: 700 }}>{equipment.name}</FitText>
                  <FitText style={{ fontSize: 12, color: colors.textMuted }}>
                    {FACILITY_FLOOR_MAP[equipment.floorId].shortLabel} - C{equipment.gridColumn}/R{equipment.gridRow} - {equipment.status}
                  </FitText>
                </div>
                <FitButton
                  variant="ghost"
                  label="RESTORE"
                  loading={isRestoringEquipment}
                  onClick={() => onRestoreEquipment(equipment)}
                />
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </FitModal>
  );
}
