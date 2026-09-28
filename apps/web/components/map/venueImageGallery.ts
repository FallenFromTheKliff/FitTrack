export const MAX_VENUE_IMAGES = 8;

export type VenueImageCollection = {
  imageUrl?: unknown;
  imageUrls?: unknown;
};

function normalizeImageUrl(value: unknown) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed || null;
}

export function parseVenueImageUrls(value: unknown): string[] {
  const values = Array.isArray(value)
    ? value
    : typeof value === "string" && value.trim().startsWith("[")
      ? (() => {
          try {
            const parsed = JSON.parse(value);
            return Array.isArray(parsed) ? parsed : [];
          } catch {
            return [];
          }
        })()
      : [];

  return values.reduce<string[]>((urls, candidate) => {
    const normalized = normalizeImageUrl(candidate);
    if (normalized && !urls.includes(normalized)) urls.push(normalized);
    return urls;
  }, []);
}

export function normalizeVenueImageUrls(
  collection: VenueImageCollection = {},
) {
  let urls = parseVenueImageUrls(collection.imageUrls);
  const primary = normalizeImageUrl(collection.imageUrl);
  if (primary) {
    urls = urls.filter((url) => url !== primary);
    urls.unshift(primary);
  }
  return urls.slice(0, MAX_VENUE_IMAGES);
}

export function serializeVenueImageUrls(urls: readonly string[]) {
  return JSON.stringify(normalizeVenueImageUrls({ imageUrls: urls }));
}

export function moveVenueImage(
  urls: readonly string[],
  fromIndex: number,
  toIndex: number,
) {
  const normalized = normalizeVenueImageUrls({ imageUrls: urls });
  if (
    !Number.isInteger(fromIndex) ||
    !Number.isInteger(toIndex) ||
    fromIndex < 0 ||
    toIndex < 0 ||
    fromIndex >= normalized.length ||
    toIndex >= normalized.length ||
    fromIndex === toIndex
  ) {
    return normalized;
  }

  const next = [...normalized];
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);
  return next;
}
