export const MEMBERSHIP_DURATION_UNITS = [
  "days",
  "weeks",
  "months",
  "years",
] as const;

export type MembershipDurationUnit =
  (typeof MEMBERSHIP_DURATION_UNITS)[number];

export type MembershipDurationParts = {
  quantity: string;
  unit: MembershipDurationUnit;
};

export type MembershipDurationResult = {
  days: number | null;
  error: string | null;
};

const UNIT_FACTORS: Record<MembershipDurationUnit, number> = {
  days: 1,
  weeks: 7,
  months: 30,
  years: 365,
};

const UNIT_SINGULAR: Record<MembershipDurationUnit, string> = {
  days: "day",
  weeks: "week",
  months: "month",
  years: "year",
};

function isDurationUnit(value: string): value is MembershipDurationUnit {
  return MEMBERSHIP_DURATION_UNITS.includes(value as MembershipDurationUnit);
}

/** Convert a positive whole-number quantity and unit into API-compatible days. */
export function parseMembershipDuration(
  quantity: string,
  unit: MembershipDurationUnit,
): MembershipDurationResult {
  const trimmed = quantity.trim();
  if (!trimmed) {
    return { days: null, error: "Duration quantity is required." };
  }
  if (!/^\d+$/.test(trimmed)) {
    return { days: null, error: "Duration quantity must be a whole number." };
  }

  const numericQuantity = Number(trimmed);
  if (!Number.isSafeInteger(numericQuantity) || numericQuantity < 1) {
    return {
      days: null,
      error: "Duration quantity must be a positive whole number.",
    };
  }
  if (!isDurationUnit(unit)) {
    return { days: null, error: "Choose a valid duration unit." };
  }

  const days = numericQuantity * UNIT_FACTORS[unit];
  if (!Number.isSafeInteger(days) || days < 1) {
    return { days: null, error: "That duration is too large." };
  }

  return { days, error: null };
}

/** Express stored API days using the largest exact conventional unit. */
export function durationPartsFromDays(days: number): MembershipDurationParts {
  if (!Number.isSafeInteger(days) || days < 1) {
    throw new RangeError("Duration days must be a positive safe integer.");
  }

  for (const unit of ["years", "months", "weeks", "days"] as const) {
    const factor = UNIT_FACTORS[unit];
    if (days % factor === 0) {
      return { quantity: String(days / factor), unit };
    }
  }

  return { quantity: String(days), unit: "days" };
}

export function formatMembershipDuration(
  quantity: string,
  unit: MembershipDurationUnit,
): string {
  const numericQuantity = Number(quantity);
  const label = numericQuantity === 1 ? UNIT_SINGULAR[unit] : unit;
  return `${quantity} ${label}`;
}
