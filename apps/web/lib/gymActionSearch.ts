export function matchesGymActionSearch(
  values: Array<string | number | null | undefined>,
  search: string,
) {
  const query = search.trim().toLowerCase().replace(/\s+/g, " ");
  if (!query) return true;
  const candidate = values
    .map((value) => String(value ?? "").trim().toLowerCase())
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ");
  if (candidate.includes(query)) return true;
  return query.split(" ").every((term) => candidate.includes(term));
}
