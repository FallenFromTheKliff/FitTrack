import type {
  FacilityFloorSnapshot,
  FacilityMapRegionSnapshot,
} from "@fittrack/types";
import { findRouteAcrossPathCells, getVenueRouteTargets } from "@fittrack/utils";

export function buildFacilityMapRoute(
  floor: FacilityFloorSnapshot,
  selectedRegion: FacilityMapRegionSnapshot | null,
) {
  if (!selectedRegion) return [];
  const walkable = [
    ...floor.pathCells,
    ...floor.entryCells,
    ...floor.exitCells,
  ];
  return (
    findRouteAcrossPathCells({
      entryCells: floor.entryCells,
      exitCells: floor.exitCells,
      pathCells: floor.pathCells,
      targetCells: getVenueRouteTargets(selectedRegion, walkable),
    }) ?? []
  );
}
