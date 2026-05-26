"use client";

import { useEffect, useMemo, useState } from "react";
import type { ThemeColors } from "@fittrack/types";
import {
  FACILITY_FLOOR_MAP,
  type VenueRecord,
} from "@/data/facilities/mapTypes";

import FitButton from "@/components/fit/FitButton";
import FitPagination from "@/components/fit/FitPagination";
import { FitText } from "@/components/fit/FitText";

type Props<TVenue extends VenueRecord = VenueRecord> = {
  colors: ThemeColors;
  embedded?: boolean;
  isLoading: boolean;
  onEditVenue: (venue: VenueRecord) => void;
  onSelectVenue?: (venue: TVenue) => void;
  selectedVenueId?: TVenue["id"] | null;
  venues: TVenue[];
};

const COLS =
  "minmax(140px, 1fr) minmax(78px, 0.38fr) minmax(140px, 0.72fr) minmax(108px, 0.55fr) 104px";
const PAGE_SIZE = 5;

export function VenueManagementTable<TVenue extends VenueRecord = VenueRecord>({
  colors,
  embedded = false,
  isLoading,
  onEditVenue,
  onSelectVenue,
  selectedVenueId,
  venues,
}: Props<TVenue>) {
  const [page, setPage] = useState(1);
  const sortedVenues = useMemo(
    () =>
      [...venues].sort((a, b) => {
        const floorDiff = (a.floorId ?? "floor-1").localeCompare(
          b.floorId ?? "floor-1",
        );
        if (floorDiff !== 0) return floorDiff;
        const orderDiff = (a.displayOrder ?? 0) - (b.displayOrder ?? 0);
        if (orderDiff !== 0) return orderDiff;
        return a.name.localeCompare(b.name);
      }),
    [venues],
  );
  const totalPages = Math.max(1, Math.ceil(sortedVenues.length / PAGE_SIZE));
  const rows = sortedVenues.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  useEffect(() => {
    setPage((current) => Math.min(current, totalPages));
  }, [totalPages]);

  if (isLoading) {
    return (
      <FitText style={{ fontSize: 13, color: colors.textMuted }}>
        Loading venues...
      </FitText>
    );
  }

  if (venues.length === 0) {
    return (
      <FitText style={{ fontSize: 13, color: colors.textMuted }}>
        No active venues.
      </FitText>
    );
  }

  return (
    <div
      style={{
        border: embedded ? "none" : `1px solid ${colors.border}`,
        borderRadius: embedded ? 0 : 10,
        display: "grid",
        gridTemplateRows: "auto minmax(0, 1fr) auto",
        height: embedded ? "100%" : undefined,
        maxWidth: "100%",
        minHeight: 0,
        overflowX: "auto",
        overflowY: "hidden",
        WebkitOverflowScrolling: "touch",
      }}
    >
      <div
        style={{
          backgroundColor: colors.surfaceRaised,
          display: "grid",
          gridTemplateColumns: COLS,
          minWidth: 640,
        }}
      >
        {["NAME", "CAPACITY", "ZONE", "STATUS", "ACTION"].map((heading) => (
          <FitText
            key={heading}
            style={{
              color: colors.textMuted,
              fontSize: 10,
              fontWeight: 800,
              padding: "8px 10px",
            }}
          >
            {heading}
          </FitText>
        ))}
      </div>
      <div
        style={{
          alignContent: "start",
          display: "grid",
          minHeight: 0,
          overflow: "hidden",
        }}
      >
        {rows.map((venue) => {
          const isSelected = selectedVenueId === venue.id;

          return (
            <div
              key={venue.id}
              onClick={() => onSelectVenue?.(venue)}
              style={{
                backgroundColor: isSelected ? `${colors.brand}16` : undefined,
                borderTop: `1px solid ${colors.border}`,
                boxShadow: isSelected
                  ? `inset 0 0 0 1px ${colors.brand}88, 0 0 18px ${colors.brand}2e`
                  : undefined,
                cursor: onSelectVenue ? "pointer" : "default",
                display: "grid",
                gridTemplateColumns: COLS,
                minWidth: 640,
                position: "relative",
                transition: "background-color 140ms ease, box-shadow 140ms ease",
                zIndex: isSelected ? 1 : undefined,
              }}
            >
            <div
              style={{
                alignItems: "center",
                display: "flex",
                minWidth: 0,
                padding: "8px 10px",
              }}
            >
              <FitText
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {venue.name}
              </FitText>
            </div>
            <div
              style={{
                alignItems: "center",
                display: "flex",
                padding: "8px 10px",
              }}
            >
              <FitText style={{ fontSize: 12 }}>{venue.capacity ?? 0}</FitText>
            </div>
            <div
              style={{
                alignItems: "center",
                display: "flex",
                minWidth: 0,
                padding: "8px 10px",
              }}
            >
              <FitText
                style={{
                  fontSize: 12,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {FACILITY_FLOOR_MAP[venue.floorId ?? "floor-1"].shortLabel} C
                {venue.gridColumn ?? 1}/R{venue.gridRow ?? 1} -{" "}
                {venue.gridWidth ?? 2}x{venue.gridHeight ?? 2}
              </FitText>
            </div>
            <div
              style={{
                alignItems: "center",
                display: "flex",
                padding: "8px 10px",
              }}
            >
              <FitText
                style={{
                  color:
                    venue.isActive === false ? colors.warning : colors.success,
                  fontSize: 11,
                }}
              >
                {venue.isActive === false
                  ? "Inactive"
                  : venue.isReservable === false
                    ? "Core Facility"
                    : "Reservable"}
              </FitText>
            </div>
            <div
              style={{
                alignItems: "center",
                display: "flex",
                gap: 6,
                padding: "6px 8px",
              }}
            >
              <FitButton
                aria-label={`Edit ${venue.name}`}
                label="EDIT"
                onClick={(event) => {
                  event.stopPropagation();
                  onEditVenue(venue);
                }}
                style={{ height: 30, minHeight: 30 }}
                textStyle={{ fontSize: 11 }}
                variant="ghost"
              />
            </div>
          </div>
          );
        })}
      </div>
      <div style={{ borderTop: `1px solid ${colors.border}`, padding: "8px 10px" }}>
        <FitPagination
          currentPage={page}
          totalPages={totalPages}
          onPageChange={setPage}
          showSinglePage
          ariaLabel="Venue management pagination"
        />
      </div>
    </div>
  );
}
