export type FacilityPlacementCell = {
  gridColumn: number;
  gridRow: number;
};

export function enumerateFacilityGridCandidates(args: {
  maxColumn: number;
  maxRow: number;
  minColumn?: number;
  minRow?: number;
}) {
  const minColumn = Math.max(1, Math.round(args.minColumn ?? 1));
  const minRow = Math.max(1, Math.round(args.minRow ?? 1));
  const maxColumn = Math.max(minColumn, Math.round(args.maxColumn));
  const maxRow = Math.max(minRow, Math.round(args.maxRow));
  const candidates: FacilityPlacementCell[] = [];

  for (let gridRow = minRow; gridRow <= maxRow; gridRow += 1) {
    for (let gridColumn = minColumn; gridColumn <= maxColumn; gridColumn += 1) {
      candidates.push({ gridColumn, gridRow });
    }
  }

  return candidates;
}

export function findNearestFacilityPlacement<T extends FacilityPlacementCell>(
  raw: FacilityPlacementCell,
  candidates: readonly T[],
  isValid: (candidate: T) => boolean,
) {
  let nearest: T | null = null;
  let nearestDistance = Number.POSITIVE_INFINITY;

  for (const candidate of candidates) {
    if (!isValid(candidate)) continue;
    const distance =
      Math.abs(candidate.gridColumn - raw.gridColumn) +
      Math.abs(candidate.gridRow - raw.gridRow);
    if (
      distance < nearestDistance ||
      (distance === nearestDistance &&
        (nearest === null ||
          candidate.gridRow < nearest.gridRow ||
          (candidate.gridRow === nearest.gridRow &&
            candidate.gridColumn < nearest.gridColumn)))
    ) {
      nearest = candidate;
      nearestDistance = distance;
    }
  }

  return nearest;
}
