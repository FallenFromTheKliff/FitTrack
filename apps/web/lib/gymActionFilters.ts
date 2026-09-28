export type GymActionDateEdge = "start" | "end";

/** Convert a YYYY-MM-DD value to an inclusive local-day ISO boundary. */
export function toInclusiveLocalBoundary(
  value: string,
  edge: GymActionDateEdge,
) {
  if (!value) return undefined;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const [year, month, day] = value.split("-").map(Number);
  if (![year, month, day].every(Number.isFinite)) return undefined;

  const date = new Date(
    year,
    month - 1,
    day,
    edge === "start" ? 0 : 23,
    edge === "start" ? 0 : 59,
    edge === "start" ? 0 : 59,
    edge === "start" ? 0 : 999,
  );
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return undefined;
  }
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}
