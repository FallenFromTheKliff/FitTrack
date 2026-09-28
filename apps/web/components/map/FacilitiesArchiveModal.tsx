"use client";

import { useMemo, useState } from "react";
import type { GymLayoutEquipmentRecord, ThemeColors } from "@fittrack/types";
import type { VenueRecord } from "@/data/facilities/mapTypes";
import { FACILITY_FLOOR_MAP } from "@/data/facilities/floorPlans";

import FitButton from "@/components/fit/FitButton";
import { FitText, FitTextInput } from "@/components/fit/FitText";
import { ConfirmModal, FitModal } from "@/components/modals";

export type FacilitiesArchiveFilter = "all" | "venues" | "equipment";

type Props = {
  archivedEquipment: GymLayoutEquipmentRecord[];
  archivedVenues: VenueRecord[];
  colors: ThemeColors;
  filter: FacilitiesArchiveFilter;
  isLoadingEquipment: boolean;
  isLoadingVenues: boolean;
  isErrorEquipment: boolean;
  isErrorVenues: boolean;
  isOpen: boolean;
  isRestoringEquipment: boolean;
  isRestoringVenue: boolean;
  onClose: () => void;
  onFilterChange: (filter: FacilitiesArchiveFilter) => void;
  onRetryEquipment: () => void;
  onRetryVenues: () => void;
  onRestoreEquipment: (
    equipment: GymLayoutEquipmentRecord,
  ) => void | Promise<void>;
  onRestoreVenue: (venue: VenueRecord) => void | Promise<void>;
};

const FILTERS: Array<{ label: string; value: FacilitiesArchiveFilter }> = [
  { label: "All Archived", value: "all" },
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
  isErrorEquipment,
  isErrorVenues,
  isOpen,
  isRestoringEquipment,
  isRestoringVenue,
  onClose,
  onFilterChange,
  onRetryEquipment,
  onRetryVenues,
  onRestoreEquipment,
  onRestoreVenue,
}: Props) {
  const [query, setQuery] = useState("");
  const [restoreTarget, setRestoreTarget] = useState<
    | { type: "venue"; value: VenueRecord }
    | { type: "equipment"; value: GymLayoutEquipmentRecord }
    | null
  >(null);
  const showVenues = filter === "all" || filter === "venues";
  const showEquipment = filter === "all" || filter === "equipment";
  const isLoading = (showVenues && isLoadingVenues) || (showEquipment && isLoadingEquipment);
  const hasError =
    (showVenues && isErrorVenues) || (showEquipment && isErrorEquipment);
  const normalizedQuery = query.trim().toLowerCase();
  const filteredVenues = useMemo(
    () =>
      archivedVenues.filter(
        (venue) =>
          !normalizedQuery ||
          venue.name.toLowerCase().includes(normalizedQuery),
      ),
    [archivedVenues, normalizedQuery],
  );
  const filteredEquipment = useMemo(
    () =>
      archivedEquipment.filter(
        (equipment) =>
          !normalizedQuery ||
          equipment.name.toLowerCase().includes(normalizedQuery),
      ),
    [archivedEquipment, normalizedQuery],
  );
  const hasRows =
    (showVenues && filteredVenues.length > 0) ||
    (showEquipment && filteredEquipment.length > 0);

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
        <FitTextInput
          aria-label="Search archived facilities"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search archived venues or equipment"
        />
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

        {hasError ? (
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 10,
              border: `1px solid ${colors.danger}`,
              borderRadius: 12,
              backgroundColor: colors.surfaceRaised,
              padding: "12px 14px",
            }}
          >
            <FitText style={{ fontSize: 13, color: colors.danger }}>
              Archived facilities could not be loaded.
            </FitText>
            <FitButton
              variant="ghost"
              label="RETRY"
              onClick={() => {
                if (showVenues && isErrorVenues) onRetryVenues();
                if (showEquipment && isErrorEquipment) onRetryEquipment();
              }}
            />
          </div>
        ) : null}

        {isLoading && !hasError ? (
          <FitText style={{ fontSize: 13, color: colors.textMuted }}>
            Loading archived facilities...
          </FitText>
        ) : null}

        {!isLoading && !hasError && !hasRows ? (
          <div
            style={{
              border: `1px solid ${colors.border}`,
              borderRadius: 12,
              backgroundColor: colors.surfaceRaised,
              padding: "18px 16px",
            }}
          >
            <FitText style={{ fontSize: 14, color: colors.textMuted }}>
              {normalizedQuery
                ? "No archived facilities match your search."
                : "No archived facilities match this filter."}
            </FitText>
          </div>
        ) : null}

        {showVenues && filteredVenues.length > 0 ? (
          <div style={{ display: "grid", gap: 8 }}>
            <FitText style={{ fontSize: 12, fontWeight: 700, color: colors.textMuted, letterSpacing: "0.08em", textTransform: "uppercase" }}>
              Archived Venues
            </FitText>
            {filteredVenues.map((venue) => (
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
                  onClick={() => setRestoreTarget({ type: "venue", value: venue })}
                />
              </div>
            ))}
          </div>
        ) : null}

        {showEquipment && filteredEquipment.length > 0 ? (
          <div style={{ display: "grid", gap: 8 }}>
            <FitText style={{ fontSize: 12, fontWeight: 700, color: colors.textMuted, letterSpacing: "0.08em", textTransform: "uppercase" }}>
              Archived Equipment Placements
            </FitText>
            {filteredEquipment.map((equipment) => (
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
                  onClick={() =>
                    setRestoreTarget({ type: "equipment", value: equipment })
                  }
                />
              </div>
            ))}
          </div>
        ) : null}
      </div>
      <ConfirmModal
        isOpen={!!restoreTarget}
        title="Restore archived facility"
        message={`Restore ${restoreTarget?.value.name ?? "this facility"} to Facilities?`}
        confirmLabel="RESTORE"
        loadingLabel="RESTORING"
        loadingTitle="RESTORING FACILITY"
        isLoading={
          restoreTarget?.type === "venue"
            ? isRestoringVenue
            : isRestoringEquipment
        }
        onConfirm={async () => {
          if (!restoreTarget) return;
          if (restoreTarget.type === "venue") {
            await onRestoreVenue(restoreTarget.value);
          } else {
            await onRestoreEquipment(restoreTarget.value);
          }
          setRestoreTarget(null);
        }}
        onCancel={() => setRestoreTarget(null)}
      />
    </FitModal>
  );
}
