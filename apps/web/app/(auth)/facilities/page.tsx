"use client";

import { useMemo, useState } from "react";
import { Map } from "lucide-react";
import {
  buildFacilityFloorVenues,
  FACILITY_FLOOR_MAP,
  FACILITY_FLOORS,
  type FacilityFloorId,
} from "@fittrack/types";

import FacilitiesMapPageView from "@/components/map/FacilitiesMapPageView";
import { useFacilitiesPageController } from "@/components/map/useFacilitiesPageController";
import { MemberFacilitiesMap } from "@/components/member-only/MemberFacilitiesMap";
import { FilterChips } from "@/components/member-only/MemberOnlyPageControls";
import {
  EmptyState,
  MemberCard,
  MemberHero,
  MemberOnlyScreen,
  MemberPill,
  MemberSection,
  MemberSurface,
  MemberText,
} from "@/components/member-only/MemberOnlyPrimitives";
import { getVenueIcon } from "@/components/member-only/MemberOnlyPageShared";
import { useAuth } from "@/contexts/AuthContext";
import { useMemberOnlyAccess, useMemberOnlyFacilitiesData } from "@/hooks/member-only/useMemberOnlyData";

function FacilitiesOperationsPage() {
  const controller = useFacilitiesPageController();
  return <FacilitiesMapPageView controller={controller} />;
}

export default function FacilitiesMapPage() {
  const { user } = useAuth();
  const memberAccess = useMemberOnlyAccess("Facilities");
  const [activeFloor, setActiveFloor] = useState<FacilityFloorId>("floor-1");
  const { floorPlanMediaQuery, venuesQuery } = useMemberOnlyFacilitiesData(user?.role === "USER" ? memberAccess.user?.id : undefined);
  const floorVenues = useMemo(() => buildFacilityFloorVenues(venuesQuery.data ?? []), [venuesQuery.data]);
  const activeFloorConfig = FACILITY_FLOOR_MAP[activeFloor];
  const activeFloorVenues = floorVenues[activeFloor];
  const reservableCount = activeFloorVenues.filter((venue) => venue.isReservable).length;
  const supportCount = Math.max(activeFloorVenues.length - reservableCount, 0);
  const floorImageUrl = floorPlanMediaQuery.data?.find((item) => item.floorId === activeFloor)?.imageUrl ?? null;

  if (user?.role === "USER") {
    return (
      <MemberOnlyScreen>
        <MemberText as="h1" variant="title">Facilities</MemberText>
        <MemberText as="p" variant="subtitle">
          Explore the same persisted floor map and venue records managed from the web Facilities workspace.
        </MemberText>

        <FilterChips options={FACILITY_FLOORS.map((floor) => ({ label: floor.label, value: floor.id }))} value={activeFloor} onChange={setActiveFloor} />

        <MemberHero
          eyebrow={activeFloorConfig.label}
          title={`${activeFloorVenues.length} mapped zone${activeFloorVenues.length === 1 ? "" : "s"}`}
          subtitle={`${reservableCount} reservable zone${reservableCount === 1 ? "" : "s"} and ${supportCount} shared support area${supportCount === 1 ? "" : "s"} are available on this live 2D layout.`}
        >
          <MemberPill tone={activeFloorVenues.length > 0 ? "success" : "warning"}>
            {activeFloorVenues.length > 0 ? "Live floor data" : "Waiting for admin mapping"}
          </MemberPill>
        </MemberHero>

        <MemberFacilitiesMap activeFloor={activeFloor} floorImageUrl={floorImageUrl} venues={activeFloorVenues} />

        <MemberSection heading="Zones">
          <MemberSurface>
            {venuesQuery.isPending ? (
              <EmptyState icon={Map} title="Loading facilities" hint="Reading the same venue catalog used by mobile." />
            ) : activeFloorVenues.length === 0 ? (
              <EmptyState icon={Map} title="No zones mapped here yet" hint={activeFloorConfig.emptySubtitle} />
            ) : (
              activeFloorVenues.map((venue, index) => {
                const Icon = getVenueIcon(venue.iconKey);
                return (
                  <MemberCard
                    key={venue.mapId}
                    hasBorder={index < activeFloorVenues.length - 1}
                    icon={Icon}
                    label={venue.name}
                    subtitle={`${venue.isReservable ? "Reservable" : "Shared facility"} | ${
                      venue.capacity ? `${venue.capacity} slots` : "Capacity pending"
                    }`}
                    trailingLabel={venue.isReservable ? "Bookable" : "Open"}
                    trailingTone={venue.isReservable ? "success" : "brand"}
                  />
                );
              })
            )}
          </MemberSurface>
        </MemberSection>
      </MemberOnlyScreen>
    );
  }

  if (user?.role === "ADMIN") {
    return <FacilitiesOperationsPage />;
  }

  return null;
}
