"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { facilityMapSnapshotQueryOptions } from "@fittrack/query";
import type { FacilityFloorId } from "@fittrack/types";

import FacilitiesMapPageView from "@/components/map/FacilitiesMapPageView";
import { useFacilitiesPageController } from "@/components/map/useFacilitiesPageController";
import { MemberFacilitiesMap } from "@/components/member-only/MemberFacilitiesMap";
import { mapSnapshotFloorVenues } from "@/components/member-only/facilityMapViewModel";
import { MemberOnlyScreen } from "@/components/member-only/MemberOnlyPrimitives";
import { useAuth } from "@/contexts/AuthContext";
import { useMemberOnlyAccess } from "@/hooks/member-only/useMemberOnlyData";
import { webApiClient } from "@/lib/api-client";
import FitButton from "@/components/fit/FitButton";

function FacilitiesOperationsPage() {
  const controller = useFacilitiesPageController();
  return <FacilitiesMapPageView controller={controller} />;
}

function SnapshotFacilitiesPage() {
  const [activeFloor, setActiveFloor] = useState<FacilityFloorId>("floor-1");
  const snapshotQuery = useQuery({
    ...facilityMapSnapshotQueryOptions(webApiClient),
    refetchInterval: 20_000,
    refetchOnWindowFocus: true,
  });
  const floor = snapshotQuery.data?.floors.find((item) => item.floorId === activeFloor);
  const venues = mapSnapshotFloorVenues(floor);

  if (snapshotQuery.isError && !snapshotQuery.data) {
    return (
      <MemberOnlyScreen>
        <section role="alert" className="member-only-surface">
          <h2>Facility map unavailable</h2>
          <p>The published facility snapshot could not be loaded.</p>
          <FitButton
            label={snapshotQuery.isFetching ? "Retrying..." : "Retry facility map"}
            disabled={snapshotQuery.isFetching}
            onClick={() => void snapshotQuery.refetch()}
          />
        </section>
      </MemberOnlyScreen>
    );
  }

  return (
    <MemberOnlyScreen>
      <MemberFacilitiesMap
        activeFloor={activeFloor}
        floorImageUrl={floor?.imageUrl}
        footprintCells={floor?.footprintCells}
        pathCells={floor?.pathCells}
        entryCells={floor?.entryCells}
        exitCells={floor?.exitCells}
        equipment={floor?.equipment}
        isLoading={snapshotQuery.isPending}
        onFloorChange={setActiveFloor}
        venues={venues}
      />
    </MemberOnlyScreen>
  );
}

export default function FacilitiesMapPage() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  useMemberOnlyAccess("Facilities");

  if (user?.role === "USER") return <SnapshotFacilitiesPage />;
  if (user?.role === "ADMIN") {
    if (searchParams.get("preview") === "mobile") return <SnapshotFacilitiesPage />;
    return <FacilitiesOperationsPage />;
  }
  return null;
}
