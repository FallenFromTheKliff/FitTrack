export function groupItemsByDate<T extends { date: string }>(
  items: T[],
  order: "asc" | "desc" = "asc"
): [string, T[]][] {
  const grouped = new Map<string, T[]>();
  for (const item of items) {
    const existing = grouped.get(item.date) ?? [];
    existing.push(item);
    grouped.set(item.date, existing);
  }
  return Array.from(grouped.entries()).sort(([a], [b]) =>
    order === "asc" ? a.localeCompare(b) : b.localeCompare(a)
  );
}