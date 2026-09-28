export type GymActionPdfRow = {
  primary: string;
  secondary?: string;
  actor?: string;
  status?: string;
  amount?: number;
  occurredAt?: string;
};

type GymActionPdfRowInput = {
  primary?: unknown;
  secondary?: unknown;
  actor?: unknown;
  status?: unknown;
  amount?: unknown;
  occurredAt?: unknown;
};

function normalizeText(value: unknown) {
  if (value == null) return undefined;
  const normalized = String(value).replace(/\s+/g, " ").trim();
  return normalized || undefined;
}

function normalizeAmount(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string" || !value.trim()) return undefined;
  const parsed = Number(value.replace(/[^0-9.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : undefined;
}

/**
 * Keep PDF payloads predictable even when a record contains nullable or
 * malformed display values. The API receives no empty strings or NaN values.
 */
export function normalizeGymActionPdfRows(
  rows: GymActionPdfRowInput[],
): GymActionPdfRow[] {
  return rows.flatMap((row) => {
    const primary = normalizeText(row.primary);
    if (!primary) return [];

    const secondary = normalizeText(row.secondary);
    const actor = normalizeText(row.actor);
    const status = normalizeText(row.status);
    const occurredAt = normalizeText(row.occurredAt);
    const amount = normalizeAmount(row.amount);

    return [
      {
        primary,
        ...(secondary ? { secondary } : {}),
        ...(actor ? { actor } : {}),
        ...(status ? { status } : {}),
        ...(amount !== undefined ? { amount } : {}),
        ...(occurredAt ? { occurredAt } : {}),
      },
    ];
  });
}

export function formatGymActionFilter(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

