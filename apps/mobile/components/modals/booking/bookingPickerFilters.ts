export type CoachPickerFilter = {
  minimumRating: 0 | 4;
  specialty: string | null;
};

export type FilterableCoachProfile = {
  averageRating?: number | string | null;
  specialties?: string[] | null;
};

export type SearchablePickerOption = {
  detail?: string | null;
  keywords?: string[];
  subtitle?: string | null;
  title: string;
};

export const DEFAULT_COACH_PICKER_FILTER: CoachPickerFilter = {
  minimumRating: 0,
  specialty: null,
};

export function filterCoachProfiles<T extends FilterableCoachProfile>(
  coaches: readonly T[],
  filter: CoachPickerFilter,
) {
  const specialty = filter.specialty?.trim().toLowerCase() ?? null;
  return coaches.filter((coach) => {
    const matchesSpecialty =
      !specialty ||
      (coach.specialties ?? []).some(
        (value) => value.trim().toLowerCase() === specialty,
      );
    const rating = Number(coach.averageRating ?? 0);
    const matchesRating =
      filter.minimumRating === 0 ||
      (Number.isFinite(rating) && rating >= filter.minimumRating);
    return matchesSpecialty && matchesRating;
  });
}

export function filterBookingPickerOptions<T extends SearchablePickerOption>(
  options: readonly T[],
  query: string,
) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return [...options];
  return options.filter((option) =>
    [option.title, option.subtitle, option.detail, ...(option.keywords ?? [])]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(normalized)),
  );
}
