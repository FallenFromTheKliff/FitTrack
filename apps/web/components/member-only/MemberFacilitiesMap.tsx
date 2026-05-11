"use client";

import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import { CalendarDays, Map, MapPin, RotateCcw, ZoomIn, ZoomOut } from "lucide-react";
import type { FacilityFloorId, FloorVenueRecord } from "@fittrack/types";
import { buildRenderableAssetUrl } from "@fittrack/utils";

import FitButton from "@/components/fit/FitButton";
import { useTheme } from "@/contexts/ThemeContext";
import { WEB_API_BASE_URL } from "@/lib/api-client";
import type { VenueEquipmentAssignments } from "@/data/facilities/mapTypes";

import {
  EmptyState,
  MemberCard,
  MemberPanelHeader,
  MemberPill,
  MemberStack,
  MemberSurface,
  MemberText,
} from "./MemberOnlyPrimitives";

const FacilitiesKonvaMap = dynamic(() => import("@/components/map/FacilitiesKonvaMap"), {
  ssr: false,
});

type Props = {
  activeFloor: FacilityFloorId;
  floorImageUrl?: string | null;
  venues: FloorVenueRecord[];
};

const EMPTY_ASSIGNMENTS: VenueEquipmentAssignments = {};
const EMPTY_EQUIPMENT: Record<string, { color: string; id: string; name: string }> = {};
const ZOOM_STEP = 0.1;

export function MemberFacilitiesMap({ activeFloor, floorImageUrl, venues }: Props) {
  const { colors } = useTheme();
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(0.95);
  const [selectedVenueMapId, setSelectedVenueMapId] = useState<string | null>(null);
  const selectedVenue = useMemo(
    () => venues.find((venue) => venue.mapId === selectedVenueMapId) ?? venues[0] ?? null,
    [selectedVenueMapId, venues],
  );
  const renderedFloorImageUrl = buildRenderableAssetUrl({
    apiBaseUrl: WEB_API_BASE_URL,
    assetUrl: floorImageUrl,
  });

  const setZoomBy = (delta: number) => {
    setZoom((current) => Math.min(1.25, Math.max(0.75, Number((current + delta).toFixed(2)))));
  };

  const resetMap = () => {
    setPan({ x: 0, y: 0 });
    setZoom(0.95);
  };

  return (
    <div className="member-only-facility-map-shell">
      <div className="member-only-facility-map-grid">
        <MemberSurface
          style={{
            minHeight: 0,
            padding: 12,
          }}
        >
          <div
            style={{
              alignItems: "center",
              display: "flex",
              flexWrap: "wrap",
              gap: 10,
              justifyContent: "space-between",
              marginBottom: 10,
            }}
          >
            <MemberPanelHeader eyebrow="2D Map Layout" title="Live floor plan" />
            <div style={{ display: "flex", gap: 8 }}>
              <FitButton icon={ZoomOut} iconOnly label="Zoom out" onClick={() => setZoomBy(-ZOOM_STEP)} variant="ghost" />
              <FitButton icon={RotateCcw} iconOnly label="Reset map" onClick={resetMap} variant="ghost" />
              <FitButton icon={ZoomIn} iconOnly label="Zoom in" onClick={() => setZoomBy(ZOOM_STEP)} variant="ghost" />
            </div>
          </div>
          <div className="member-only-facility-map-stage">
            {venues.length === 0 ? (
              <EmptyState
                icon={Map}
                title="No mapped zones yet"
                hint="The floor plan stays ready here as soon as staff publishes zones from Facilities."
              />
            ) : (
              <FacilitiesKonvaMap
                assignedEquipment={EMPTY_ASSIGNMENTS}
                colors={colors}
                equipmentById={EMPTY_EQUIPMENT}
                floorImageUrl={renderedFloorImageUrl}
                height={undefined}
                isEditMode={false}
                onAssignEquipmentToVenue={() => undefined}
                onPanChange={setPan}
                onSelectVenue={(venue) => setSelectedVenueMapId(venue.mapId)}
                pan={pan}
                selectedVenueMapId={selectedVenue?.mapId ?? null}
                venues={venues}
                zoom={zoom}
              />
            )}
          </div>
        </MemberSurface>
        <MemberSurface className="member-only-facility-map-detail" padded>
          {selectedVenue ? (
            <MemberStack>
              <MemberPanelHeader eyebrow={activeFloor.replace("floor-", "Floor ")} title={selectedVenue.name} />
              <MemberText variant="muted">{selectedVenue.description || "Tap a zone on the map to inspect member-facing facility details."}</MemberText>
              <div className="member-only-chip-row">
                <MemberPill tone={selectedVenue.isReservable ? "success" : "brand"}>
                  {selectedVenue.isReservable ? "Reservable" : "Open facility"}
                </MemberPill>
                <MemberPill tone="muted">
                  {selectedVenue.capacity ? `${selectedVenue.capacity} slots` : "Capacity pending"}
                </MemberPill>
              </div>
              <MemberCard
                icon={MapPin}
                label="Map placement"
                subtitle={`Column ${selectedVenue.gridColumn}, Row ${selectedVenue.gridRow}`}
                trailingLabel={`${selectedVenue.gridWidth} x ${selectedVenue.gridHeight}`}
                trailingTone="brand"
              />
              {selectedVenue.isReservable ? (
                <MemberCard
                  icon={CalendarDays}
                  label="Booking availability"
                  subtitle="Reservations use the same venue record shown in mobile bookings."
                  trailingLabel={selectedVenue.hourlyRate ? `PHP ${selectedVenue.hourlyRate}` : "Bookable"}
                  trailingTone="success"
                />
              ) : null}
            </MemberStack>
          ) : (
            <EmptyState icon={MapPin} title="Select a zone" hint="Mapped venues will appear here after the floor has published zones." />
          )}
        </MemberSurface>
      </div>
    </div>
  );
}
