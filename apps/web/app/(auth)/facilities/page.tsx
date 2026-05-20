"use client";

import { useMemo, useState } from "react";
import {
  buildFacilityFloorVenues,
  type FacilityFloorId,
} from "@fittrack/types";

import FacilitiesMapPageView from "@/components/map/FacilitiesMapPageView";
import { useFacilitiesPageController } from "@/components/map/useFacilitiesPageController";
import { MemberFacilitiesMap } from "@/components/member-only/MemberFacilitiesMap";
import { MemberOnlyScreen } from "@/components/member-only/MemberOnlyPrimitives";
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
  const activeFloorVenues = floorVenues[activeFloor];
  const floorImageUrl = floorPlanMediaQuery.data?.find((item) => item.floorId === activeFloor)?.imageUrl ?? null;

  if (user?.role === "USER") {
    return (
      <MemberOnlyScreen>
        <MemberFacilitiesMap
          activeFloor={activeFloor}
          floorImageUrl={floorImageUrl}
          isLoading={venuesQuery.isPending}
          onFloorChange={setActiveFloor}
          venues={activeFloorVenues}
        />
      </MemberOnlyScreen>
    );
  }

  if (user?.role === "ADMIN") {
    return <FacilitiesOperationsPage />;
  }

  return null;
}
