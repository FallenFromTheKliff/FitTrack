"use client";

import { useEffect, useMemo, useState } from "react";
import { getVenueBookingBlockReason, type VenueBookingRecord } from "@fittrack/api-client";
import type { FloorVenueRecord, GymLayoutEquipmentRecord, ThemeColors } from "@fittrack/types";
import { buildRenderableAssetUrl } from "@fittrack/utils";
import { Archive, Building2, Eye, MoreVertical, Pencil, RotateCw, Trash2, Wrench } from "lucide-react";

import { FitDropdown, FitTextInput } from "@/components/fit";
import FitButton from "@/components/fit/FitButton";
import FitPagination from "@/components/fit/FitPagination";
import { FitText } from "@/components/fit/FitText";
import { FACILITY_FLOORS, FACILITY_FLOOR_MAP, type FacilityFloorId } from "@/data/facilities/floorPlans";
import { WEB_API_BASE_URL } from "@/lib/api-client";

type StatusFilter = "all" | "available" | "maintenance" | "inactive" | "hidden";
type Props = {
  activeBookings: VenueBookingRecord[];
  colors: ThemeColors;
  equipment: GymLayoutEquipmentRecord[];
  floorId: FacilityFloorId;
  isError: boolean;
  isLoading: boolean;
  onAddVenue: () => void;
  onArchiveVenue: (venue: FloorVenueRecord) => void;
  onEditVenue: (venue: FloorVenueRecord) => void;
  onFloorChange: (floorId: FacilityFloorId) => void;
  onOpenArchive: () => void;
  onRemoveFromMap: (venue: FloorVenueRecord) => void;
  onRetry: () => void;
  onSelectVenue: (venue: FloorVenueRecord) => void;
  onToggleMaintenance: (venue: FloorVenueRecord) => void;
  onViewDetails: (venue: FloorVenueRecord) => void;
  selectedVenueId?: FloorVenueRecord["id"] | null;
  venues: FloorVenueRecord[];
};

const COLS = "minmax(190px,1.35fr) minmax(110px,.72fr) 74px 76px 108px 118px 104px 112px";
const PAGE_SIZE = 5;

function venueState(venue: FloorVenueRecord): Exclude<StatusFilter, "all"> {
  if (venue.isMapped === false) return "hidden";
  if (venue.isActive === false) return "inactive";
  if (venue.status === "maintenance") return "maintenance";
  return "available";
}

function VenueThumbnail({ colors, venue }: { colors: ThemeColors; venue: FloorVenueRecord }) {
  const [failed, setFailed] = useState(false);
  const src = buildRenderableAssetUrl({ apiBaseUrl: WEB_API_BASE_URL, assetUrl: venue.imageUrl ?? null });
  useEffect(() => setFailed(false), [src]);
  return (
    <span style={{ alignItems: "center", backgroundColor: colors.surfaceRaised, border: `1px solid ${colors.border}`, borderRadius: 7, display: "flex", height: 42, justifyContent: "center", overflow: "hidden", width: 58 }}>
      {src && !failed ? (
        <img alt="" src={src} onError={() => setFailed(true)} style={{ height: "100%", objectFit: "cover", width: "100%" }} />
      ) : (
        <Building2 size={19} color={colors.textMuted} />
      )}
    </span>
  );
}

export function FacilitiesVenuesTable({
  activeBookings, colors, equipment, floorId, isError, isLoading, onAddVenue,
  onArchiveVenue, onEditVenue, onFloorChange, onOpenArchive, onRemoveFromMap,
  onRetry, onSelectVenue, onToggleMaintenance, onViewDetails, selectedVenueId, venues,
}: Props) {
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [openActionsId, setOpenActionsId] = useState<string | number | null>(null);
  const filteredVenues = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return [...venues]
      .filter((venue) => status === "all" || venueState(venue) === status)
      .filter((venue) => !normalized || venue.name.toLowerCase().includes(normalized) || (venue.description ?? "").toLowerCase().includes(normalized))
      .sort((left, right) => ((left.displayOrder ?? 0) - (right.displayOrder ?? 0)) || left.name.localeCompare(right.name));
  }, [query, status, venues]);
  const totalPages = Math.max(1, Math.ceil(filteredVenues.length / PAGE_SIZE));
  const rows = filteredVenues.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  useEffect(() => setPage(1), [floorId, query, status]);
  useEffect(() => setPage((current) => Math.min(current, totalPages)), [totalPages]);

  const renderBody = () => {
    if (isLoading) {
      return Array.from({ length: PAGE_SIZE }).map((_, index) => (
        <div key={index} aria-label={index === 0 ? "Loading venues" : undefined} style={{ alignItems: "center", borderTop: `1px solid ${colors.border}`, display: "grid", gap: 20, gridTemplateColumns: COLS, minHeight: 62, minWidth: 940, padding: "0 10px" }}>
          {Array.from({ length: 8 }).map((__, cell) => <span key={cell} style={{ backgroundColor: colors.border, borderRadius: 5, height: 10, opacity: .7, width: cell === 0 ? "70%" : "54%" }} />)}
        </div>
      ));
    }
    if (isError) {
      return (
        <div style={{ display: "grid", gap: 10, justifyItems: "center", padding: "52px 18px", textAlign: "center" }}>
          <FitText style={{ color: colors.danger, fontSize: 14, fontWeight: 850 }}>Unable to load venues</FitText>
          <FitText style={{ color: colors.textMuted, fontSize: 12 }}>Check the connection and try again.</FitText>
          <FitButton variant="ghost" label="Retry" icon={RotateCw} onClick={onRetry} />
        </div>
      );
    }
    if (filteredVenues.length === 0) {
      return (
        <div style={{ display: "grid", gap: 10, justifyItems: "center", padding: "52px 18px", textAlign: "center" }}>
          <Building2 size={28} color={colors.textMuted} />
          <FitText style={{ fontSize: 14, fontWeight: 850 }}>No venues found</FitText>
          <FitText style={{ color: colors.textMuted, fontSize: 12 }}>{venues.length === 0 ? "Create the first venue for this floor." : "Try another search or status filter."}</FitText>
          {venues.length === 0 ? <FitButton variant="primary" label="Add venue" icon={Building2} onClick={onAddVenue} /> : null}
        </div>
      );
    }

    return rows.map((venue) => {
      const state = venueState(venue);
      const venueKeys = new Set([venue.mapId, String(venue.id), String(venue.sourceVenueId ?? venue.id)]);
      const equipmentCount = equipment.filter((item) => venueKeys.has(String(item.venueId))).length;
      const bookingCount = activeBookings.filter((booking) => String(booking.venueId) === String(venue.sourceVenueId ?? venue.id)).length;
      const updatedAt = (venue as FloorVenueRecord & { updatedAt?: string }).updatedAt;
      const bookingBlockReason = getVenueBookingBlockReason(venue);
      const stateColor = state === "available" ? colors.success : state === "maintenance" ? colors.warning : colors.textMuted;
      const maintenanceLabel = state === "maintenance" ? "Maintenance" : state === "inactive" ? "Inactive" : "Active";
      return (
        <div key={venue.mapId} onClick={() => onSelectVenue(venue)} style={{ backgroundColor: selectedVenueId === venue.id ? `${colors.brand}12` : colors.surface, borderTop: `1px solid ${colors.border}`, boxShadow: selectedVenueId === venue.id ? `inset 3px 0 0 ${colors.brand}` : undefined, cursor: "pointer", display: "grid", gridTemplateColumns: COLS, minHeight: 62, minWidth: 940, position: "relative" }}>
          <div style={{ alignItems: "center", display: "grid", gap: 9, gridTemplateColumns: "58px minmax(0,1fr)", minWidth: 0, padding: "8px 10px" }}>
            <VenueThumbnail colors={colors} venue={venue} />
            <span style={{ minWidth: 0 }}><FitText style={{ display: "block", fontSize: 12, fontWeight: 850, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{venue.name}</FitText><FitText style={{ color: colors.textMuted, display: "block", fontSize: 9.5, marginTop: 3 }}>{venue.isMapped === false ? "Not on map" : "Visible on map"}</FitText></span>
          </div>
          <div style={{ alignContent: "center", display: "grid", padding: "8px 10px" }}><FitText style={{ fontSize: 11, fontWeight: 700 }}>{FACILITY_FLOOR_MAP[venue.floorId].label}</FitText><FitText style={{ color: colors.textMuted, fontSize: 9.5, marginTop: 2 }}>C{venue.gridColumn ?? 1} / R{venue.gridRow ?? 1}</FitText></div>
          <div style={{ alignItems: "center", display: "flex", padding: "8px 10px" }}><FitText style={{ fontSize: 11 }}>{venue.capacity ?? 0}</FitText></div>
          <div style={{ alignItems: "center", display: "flex", padding: "8px 10px" }}><FitText style={{ fontSize: 11 }}>{equipmentCount}</FitText></div>
          <div style={{ alignContent: "center", display: "grid", padding: "8px 10px" }}><FitText style={{ color: bookingBlockReason ? colors.danger : bookingCount ? colors.warning : colors.success, fontSize: 10.5, fontWeight: 750 }}>{bookingBlockReason ? state === "maintenance" ? "Unavailable - Maintenance" : "Unavailable" : bookingCount ? `${bookingCount} active` : "Available"}</FitText>{bookingBlockReason ? <FitText style={{ color: colors.textMuted, fontSize: 8.5, marginTop: 2 }}>{state === "maintenance" ? "Maintenance blocks booking" : bookingBlockReason}</FitText> : null}</div>
          <div style={{ alignItems: "center", display: "flex", padding: "8px 10px" }}><span style={{ backgroundColor: `${stateColor}18`, border: `1px solid ${stateColor}55`, borderRadius: 6, color: stateColor, fontSize: 9.5, fontWeight: 800, padding: "4px 6px" }}>{maintenanceLabel}</span></div>
          <div style={{ alignContent: "center", display: "grid", padding: "8px 10px" }}><FitText style={{ fontSize: 10.5 }}>{updatedAt ? new Date(updatedAt).toLocaleDateString() : "Current"}</FitText><FitText style={{ color: colors.textMuted, fontSize: 9, marginTop: 2 }}>{updatedAt ? new Date(updatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "API synced"}</FitText></div>
          <div style={{ alignItems: "center", display: "flex", gap: 5, padding: "7px 8px", position: "relative" }}>
            <FitButton variant="ghost" label="View" onClick={(event) => { event.stopPropagation(); onSelectVenue(venue); }} style={{ minHeight: 30 }} />
            <FitButton aria-label={`More actions for ${venue.name}`} variant="ghost" icon={MoreVertical} iconOnly onClick={(event) => { event.stopPropagation(); setOpenActionsId((current) => current === venue.id ? null : venue.id); }} style={{ minHeight: 30, width: 30 }} />
            {openActionsId === venue.id ? (
              <div onClick={(event) => event.stopPropagation()} style={{ backgroundColor: colors.surfaceRaised, border: `1px solid ${colors.border}`, borderRadius: 8, boxShadow: "0 12px 30px rgba(0,0,0,.28)", display: "grid", gap: 3, padding: 5, position: "absolute", right: 8, top: 42, width: 178, zIndex: 20 }}>
                {[
                  { icon: Eye, label: "View details", run: () => onViewDetails(venue) },
                  { icon: Pencil, label: "Edit venue", run: () => onEditVenue(venue) },
                  { icon: Wrench, label: state === "maintenance" ? "Mark available" : "Mark maintenance", run: () => onToggleMaintenance(venue), disabled: state !== "available" && state !== "maintenance" },
                  { icon: Trash2, label: "Remove from map", run: () => onRemoveFromMap(venue), disabled: venue.isMapped === false || venue.isSystem },
                  { icon: Archive, label: "Archive", run: () => onArchiveVenue(venue), disabled: venue.isSystem },
                ].map((action) => <FitButton key={action.label} variant="ghost" label={action.label} icon={action.icon} disabled={action.disabled} onClick={() => { setOpenActionsId(null); action.run(); }} style={{ justifyContent: "flex-start", minHeight: 32 }} />)}
              </div>
            ) : null}
          </div>
        </div>
      );
    });
  };

  return (
    <div style={{ display: "grid", gap: 10, gridTemplateRows: "auto minmax(0,1fr)", minHeight: 0 }}>
      <div style={{ alignItems: "end", display: "grid", gap: 8, gridTemplateColumns: "minmax(190px,1fr) 150px 150px auto auto" }}>
        <FitTextInput aria-label="Search venues" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search venues" style={{ minHeight: 38, width: "100%" }} />
        <FitDropdown ariaLabel="Filter venues by status" value={status} onChange={(value) => setStatus(value as StatusFilter)} options={[{ label: "All statuses", value: "all" }, { label: "Available", value: "available" }, { label: "Maintenance", value: "maintenance" }, { label: "Inactive", value: "inactive" }, { label: "Not on map", value: "hidden" }]} />
        <FitDropdown ariaLabel="Filter venues by floor" value={floorId} onChange={(value) => onFloorChange(value as FacilityFloorId)} options={FACILITY_FLOORS.map((floor) => ({ label: floor.label, value: floor.id }))} />
        <FitButton variant="ghost" label="Archive" icon={Archive} onClick={onOpenArchive} />
        <FitButton variant="primary" label="Add venue" icon={Building2} onClick={onAddVenue} />
      </div>
      <div style={{ border: `1px solid ${colors.border}`, borderRadius: 9, display: "grid", gridTemplateRows: "auto minmax(0,1fr) auto", minHeight: 0, overflowX: "auto", overflowY: "visible" }}>
        <div style={{ backgroundColor: colors.surfaceRaised, display: "grid", gridTemplateColumns: COLS, minWidth: 940 }}>{["Venue", "Floor / zone", "Capacity", "Equipment", "Booking", "Maintenance", "Updated", "Actions"].map((heading) => <FitText key={heading} style={{ color: colors.textMuted, fontSize: 9.5, fontWeight: 850, padding: "9px 10px" }}>{heading}</FitText>)}</div>
        <div style={{ alignContent: "start", display: "grid", minHeight: 0 }}>{renderBody()}</div>
        {!isLoading && !isError && filteredVenues.length > 0 ? (
          <div style={{ alignItems: "center", borderTop: `1px solid ${colors.border}`, display: "flex", gap: 12, justifyContent: "space-between", padding: "8px 10px" }}><FitText style={{ color: colors.textMuted, fontSize: 10.5 }}>Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filteredVenues.length)} of {filteredVenues.length}</FitText><FitPagination currentPage={page} totalPages={totalPages} onPageChange={setPage} showSinglePage ariaLabel="Venue management pagination" /></div>
        ) : null}
      </div>
    </div>
  );
}
