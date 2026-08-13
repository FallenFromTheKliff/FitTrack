import {
  DEFAULT_COACH_PICKER_FILTER,
  filterBookingPickerOptions,
  filterCoachProfiles,
} from "./bookingPickerFilters";

function assertEqual(actual: unknown, expected: unknown, message: string) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(
      `${message}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
    );
  }
}

const coaches = [
  { averageRating: "4.8", id: "domingo", specialties: ["Body Recomposition"] },
  { averageRating: 4.7, id: "mercado", specialties: ["Body Recomposition"] },
  { averageRating: 3.9, id: "low-rating", specialties: ["Body Recomposition"] },
  { averageRating: 4.9, id: "endurance", specialties: ["Endurance Conditioning"] },
];

const filtered = filterCoachProfiles(coaches, {
  minimumRating: 4,
  specialty: "Body Recomposition",
});
assertEqual(
  filtered.map((coach) => coach.id),
  ["domingo", "mercado"],
  "specialty and 4+ rating compose without discarding 4.7-4.8 coaches",
);

const options = filtered.map((coach) => ({
  id: coach.id,
  keywords: coach.specialties,
  subtitle: `${coach.averageRating} stars`,
  title:
    coach.id === "domingo" ? "Juan Carlos Domingo" : "Juan Carlos Mercado",
}));
assertEqual(
  filterBookingPickerOptions(options, "mercado").map((option) => option.id),
  ["mercado"],
  "search composes with specialty and rating",
);
assertEqual(
  filterBookingPickerOptions(options, "").map((option) => option.id),
  ["domingo", "mercado"],
  "clearing search restores the locally filtered result",
);
assertEqual(
  filterCoachProfiles(coaches, {
    ...DEFAULT_COACH_PICKER_FILTER,
    specialty: "Body Recomposition",
  }).map((coach) => coach.id),
  ["domingo", "mercado", "low-rating"],
  "Any rating resets only the rating condition",
);
