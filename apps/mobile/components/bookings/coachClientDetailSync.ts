export function areCoachClientDetailsEquivalent(
  current: unknown,
  refreshed: unknown,
) {
  return JSON.stringify(current) === JSON.stringify(refreshed);
}

