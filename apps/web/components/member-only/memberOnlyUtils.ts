import type { VenueBookingRecord } from "@fittrack/api-client";
import { mapVenueBookingRecords, normalizeBookingStatus, toDateTimeRange } from "@fittrack/app-core";
import type {
  ActiveNutritionProfileRecord,
  Booking,
  DailyNutritionSummaryRecord,
  FacilityFloorId,
  FitnessMasteryRank,
  MuscleMasteryRecord,
  NutritionCoachingInsightRecord,
  NutritionMacroTotalsRecord,
  NutritionLogRecord,
  NutritionTdeeRecord,
  VenueRecord,
  WorkoutSessionSummaryRecord,
} from "@fittrack/types";

export type MemberBookingItem = Booking & {
  amountDueNow?: number;
  bookingType?: "recurring" | "single";
  coachId?: string;
  detailSubtitle?: string;
  detailTitle?: string;
  nextPaymentDate?: string;
  participantLabel?: string;
  participantName?: string;
  paymentPlan?: "downpayment" | "free" | "full";
  remainingBalance?: number;
  totalAmount?: number;
};

export type AppointmentLikeRecord = {
  activePaymentStage?: "balance" | "downpayment" | "full" | null;
  amountDueNow?: number | null;
  balancePaidAt?: string | null;
  coach?: {
    displayName?: string | null;
    hourlyRate?: number | null;
  } | null;
  coachId?: string;
  downpaymentPaidAt?: string | null;
  duration: number;
  id: string;
  nextPaymentDate?: string | null;
  notes?: string | null;
  paymentPlan?: "downpayment" | "free" | "full";
  remainingBalance?: number | null;
  recurringPlanId?: string | null;
  scheduledAt: string;
  sessionType?: string | null;
  status?: string;
  totalAmount?: number | null;
};

export type BlueprintMarkerTone = "muted" | "primary";

export type BlueprintMarker = {
  hint: string;
  label: string;
  left: number;
  top: number;
  tone: BlueprintMarkerTone;
  width: number;
  height: number;
};

export const FACILITY_BLUEPRINT_COPY: Record<
  FacilityFloorId,
  {
    description: string;
    eyebrow: string;
    routeLabel: string;
    markers: BlueprintMarker[];
  }
> = {
  "floor-1": {
    description:
      "Entry-friendly view with the lobby edge, open training floor, and main court lanes laid out along one readable path.",
    eyebrow: "Orientation Path",
    routeLabel: "Main circulation lane",
    markers: [
      { hint: "Arrival and check-in", label: "Entry", left: 6, top: 8, tone: "muted", width: 22, height: 18 },
      { hint: "Free movement and machine zone", label: "Training", left: 31, top: 12, tone: "primary", width: 29, height: 28 },
      { hint: "Court-side wayfinding", label: "Courts", left: 63, top: 12, tone: "muted", width: 27, height: 34 },
    ],
  },
  "floor-2": {
    description:
      "A tighter training annex with coaching and ring-side movement kept readable through one central spine.",
    eyebrow: "Focused Zone",
    routeLabel: "Coach access lane",
    markers: [
      { hint: "Warm-up and prep", label: "Prep", left: 12, top: 18, tone: "muted", width: 22, height: 22 },
      { hint: "Main session zone", label: "Ring", left: 39, top: 24, tone: "primary", width: 32, height: 28 },
      { hint: "Support edge", label: "Recovery", left: 72, top: 18, tone: "muted", width: 16, height: 22 },
    ],
  },
  "floor-3": {
    description:
      "The studio floor stays calm and open, with the blueprint layer acting as a soft guide instead of a busy architectural diagram.",
    eyebrow: "Studio Flow",
    routeLabel: "Quiet movement lane",
    markers: [
      { hint: "Light prep zone", label: "Prep", left: 10, top: 18, tone: "muted", width: 18, height: 18 },
      { hint: "Main studio footprint", label: "Studio", left: 31, top: 18, tone: "primary", width: 40, height: 40 },
      { hint: "Stretch edge", label: "Stretch", left: 74, top: 22, tone: "muted", width: 14, height: 22 },
    ],
  },
};

export const BOOKING_STATUS_FILTERS = [
  { label: "All", value: "all" },
  { label: "Pending", value: "pending" },
  { label: "Active", value: "confirmed" },
  { label: "Completed", value: "completed" },
  { label: "No Show", value: "no_show" },
  { label: "Cancelled", value: "cancelled" },
] as const;

export type BookingStatusFilter = (typeof BOOKING_STATUS_FILTERS)[number]["value"];
export type BookingSection = "appointments" | "bookings";

export const MEMBER_BOOKING_SECTIONS: Array<{ label: string; value: BookingSection }> = [
  { label: "Reservations", value: "bookings" },
  { label: "Appointments", value: "appointments" },
];

const RANK_PRIORITY: Record<FitnessMasteryRank, number> = {
  bronze: 1,
  silver: 2,
  gold: 3,
  platinum: 4,
  adamantite: 5,
};

export type NutritionFoodCatalogItem = {
  id: string;
  name: string;
  serving: string;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  focus: Array<"balance" | "carbs" | "fat" | "protein">;
  initials: string;
  highlight: string;
};

export type NutritionGuidanceAlertTone = "brand" | "success" | "warning";
export type NutritionGuidanceAlert = {
  id: string;
  tone: NutritionGuidanceAlertTone;
  eyebrow: string;
  title: string;
  message: string;
};

export const CURATED_FOOD_CATALOG: NutritionFoodCatalogItem[] = [
  {
    id: "greek-yogurt-power-cup",
    name: "Greek Yogurt Power Cup",
    serving: "170 g cup",
    calories: 170,
    proteinG: 17,
    carbsG: 12,
    fatG: 4,
    focus: ["protein", "balance"],
    initials: "GY",
    highlight: "Fast protein support without blowing up your calories.",
  },
  {
    id: "chicken-adobo-rice-bowl",
    name: "Chicken Adobo Rice Bowl",
    serving: "1 bowl",
    calories: 420,
    proteinG: 35,
    carbsG: 42,
    fatG: 12,
    focus: ["protein", "carbs"],
    initials: "CA",
    highlight: "Balanced post-lift meal when both protein and carbs are lagging.",
  },
  {
    id: "banana-oat-recovery-cup",
    name: "Banana Oat Recovery Cup",
    serving: "1 cup",
    calories: 310,
    proteinG: 8,
    carbsG: 58,
    fatG: 6,
    focus: ["carbs"],
    initials: "BO",
    highlight: "Simple carb refill for low-energy or low-glycogen days.",
  },
  {
    id: "peanut-butter-toast-stack",
    name: "Peanut Butter Toast Stack",
    serving: "2 slices",
    calories: 290,
    proteinG: 11,
    carbsG: 26,
    fatG: 16,
    focus: ["fat", "carbs"],
    initials: "PB",
    highlight: "Useful when you need a compact calorie bump and healthy fats.",
  },
  {
    id: "tuna-pandesal-pair",
    name: "Tuna Pandesal Pair",
    serving: "2 rolls",
    calories: 250,
    proteinG: 24,
    carbsG: 22,
    fatG: 7,
    focus: ["protein"],
    initials: "TP",
    highlight: "Quick high-protein option that still feels like a real snack.",
  },
  {
    id: "avocado-egg-wrap",
    name: "Avocado Egg Wrap",
    serving: "1 wrap",
    calories: 360,
    proteinG: 18,
    carbsG: 24,
    fatG: 20,
    focus: ["fat", "balance"],
    initials: "AE",
    highlight: "Helps round out fats while keeping the meal satisfying.",
  },
];

export function getTodayString() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function clampProgress(value: number) {
  return Math.max(0, Math.min(value, 1));
}

export function formatCompactNumber(value: number) {
  if (value >= 1000) {
    return `${(value / 1000).toFixed(value >= 10000 ? 0 : 1)}`.replace(".0", "") + "K";
  }
  return value.toLocaleString("en-US");
}

export function formatTitle(value: string) {
  return value
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function formatStatusLabel(status: string) {
  const explicitLabels: Record<string, string> = {
    pending_downpayment: "Pending Downpayment",
    pending_payment: "Pending Payment",
    pending_full_payment: "Pending Full Payment",
    balance_pending: "Pending Full Payment",
  };

  if (explicitLabels[status]) return explicitLabels[status];
  return formatTitle(status);
}

export function formatGoalLabel(value?: string | null) {
  return value ? formatTitle(value) : "No active target";
}

export function getMembershipStatusLabel(membershipCardStatus: string, hasMemberCardAccess: boolean) {
  if (membershipCardStatus === "pending_verification") return "Pending verification";
  if (membershipCardStatus === "revoked") return "Revoked";
  return hasMemberCardAccess ? "Member" : "Non-member";
}

export function getMemberLockMessage(membershipCardStatus: string, featureName: string) {
  if (membershipCardStatus === "pending_verification") {
    return `Your membership card payment is waiting for verification. ${featureName} unlocks as soon as staff confirms it.`;
  }
  if (membershipCardStatus === "revoked") {
    return "Your membership card access is revoked right now. Ask the front desk to repair the account if this is unexpected.";
  }
  return `${featureName} unlocks after this account has an active membership card.`;
}

function getLocalDayKey(dateLike: string) {
  const date = new Date(dateLike);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

export function countRecentActiveDays(sessions: WorkoutSessionSummaryRecord[]) {
  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 6).getTime();
  const activeDays = new Set(
    sessions
      .filter((session) => session.status === "completed")
      .filter((session) => {
        const sourceDate = session.completedAt ?? session.startedAt;
        return new Date(sourceDate).getTime() >= start;
      })
      .map((session) => getLocalDayKey(session.completedAt ?? session.startedAt)),
  );
  return activeDays.size;
}

export function countRecentCompletedSessions(sessions: WorkoutSessionSummaryRecord[]) {
  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 6).getTime();
  return sessions.filter((session) => {
    if (session.status !== "completed") return false;
    const sourceDate = session.completedAt ?? session.startedAt;
    return new Date(sourceDate).getTime() >= start;
  }).length;
}

export function countCurrentStreakDays(sessions: WorkoutSessionSummaryRecord[]) {
  const completedDayKeys = new Set(
    sessions
      .filter((session) => session.status === "completed")
      .map((session) => getLocalDayKey(session.completedAt ?? session.startedAt)),
  );

  let streak = 0;
  const cursor = new Date();
  while (
    completedDayKeys.has(
      `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}-${String(cursor.getDate()).padStart(2, "0")}`,
    )
  ) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

export function resolveHighestRank(mastery: MuscleMasteryRecord[]) {
  return mastery.reduce<MuscleMasteryRecord | null>((highest, entry) => {
    if (!highest) return entry;
    if (RANK_PRIORITY[entry.rank] > RANK_PRIORITY[highest.rank]) return entry;
    if (RANK_PRIORITY[entry.rank] === RANK_PRIORITY[highest.rank] && entry.xpPoints > highest.xpPoints) {
      return entry;
    }
    return highest;
  }, null);
}

export function toMemberBookings(records: VenueBookingRecord[], venues: VenueRecord[]): MemberBookingItem[] {
  const bookings = mapVenueBookingRecords(records, venues);
  return bookings.map((booking) => {
    const venue = venues.find((entry) => String(entry.id) === booking.resourceId);
    const record = records.find((entry) => entry.id === booking.id);
    const durationHours = record?.durationHours ?? 0;
    const totalAmount = record?.totalAmount;
    return {
      ...booking,
      detailSubtitle: booking.resourceName,
      detailTitle: "Reservation Details",
      price: totalAmount ?? (venue?.hourlyRate ?? 0) * durationHours,
      totalAmount: totalAmount ?? undefined,
    };
  });
}

export function toMemberAppointment(appointment: AppointmentLikeRecord): MemberBookingItem {
  const { startLabel, endLabel, date } = toDateTimeRange(appointment.scheduledAt, appointment.duration);
  const standaloneName = appointment.coach?.displayName?.trim();
  const coachName = standaloneName && !standaloneName.includes("@") ? standaloneName : "Coach Session";
  const normalizedStatus =
    appointment.status === "pending_payment" && appointment.activePaymentStage === "full"
      ? "pending_full_payment"
      : appointment.status === "pending_payment" && appointment.activePaymentStage === "downpayment"
        ? "pending_downpayment"
        : appointment.status === "confirmed" && Number(appointment.remainingBalance ?? 0) > 0 && !appointment.balancePaidAt
          ? "pending_full_payment"
          : normalizeBookingStatus(appointment.status);

  return {
    amountDueNow: appointment.amountDueNow ?? undefined,
    bookingType: appointment.recurringPlanId ? "recurring" : "single",
    coachId: appointment.coachId ?? undefined,
    date,
    description: appointment.notes ?? undefined,
    detailSubtitle: appointment.recurringPlanId ? `${coachName} / Recurring` : coachName,
    detailTitle: "Appointment Details",
    endTime: endLabel,
    id: appointment.id,
    nextPaymentDate: appointment.nextPaymentDate ?? undefined,
    participantLabel: "Coach",
    participantName: coachName,
    paymentPlan: appointment.paymentPlan ?? undefined,
    price: appointment.coach?.hourlyRate ?? 0,
    remainingBalance: appointment.remainingBalance ?? undefined,
    resourceId: appointment.coachId ?? "coach",
    resourceName: coachName,
    resourceType: "trainer",
    startTime: startLabel,
    status: normalizedStatus as MemberBookingItem["status"],
    time: `${startLabel} - ${endLabel}`,
    totalAmount: appointment.totalAmount ?? undefined,
    trainerName: coachName,
  };
}

export function formatMacroRows(logged: NutritionMacroTotalsRecord, target: NutritionMacroTotalsRecord | null) {
  return [
    { key: "protein", label: "Protein", color: "brand" as const, value: logged.proteinG, target: target?.proteinG ?? 0 },
    { key: "carbs", label: "Carbs", color: "secondary" as const, value: logged.carbsG, target: target?.carbsG ?? 0 },
    { key: "fat", label: "Fats", color: "success" as const, value: logged.fatG, target: target?.fatG ?? 0 },
  ];
}

export function formatMacroDelta(delta: number) {
  return delta >= 0 ? `${delta.toFixed(0)}g remaining` : `${Math.abs(delta).toFixed(0)}g over target`;
}

export function formatNutritionLogSubtitle(entry: NutritionLogRecord) {
  return `${entry.calories.toFixed(0)} kcal | P ${entry.proteinG.toFixed(0)} C ${entry.carbsG.toFixed(0)} F ${entry.fatG.toFixed(0)}`;
}

export function formatShortDateTime(value?: string | null) {
  if (!value) return "Not calculated yet";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not calculated yet";
  return date.toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" });
}

export function formatCalorieDelta(current?: number, previous?: number) {
  if (!current || !previous) return "No previous target";
  const delta = current - previous;
  if (Math.abs(delta) < 1) return "No change";
  return `${delta > 0 ? "+" : ""}${delta.toFixed(0)} kcal`;
}

function getMacroGaps(logged: NutritionMacroTotalsRecord, target: NutritionMacroTotalsRecord) {
  return [
    { key: "protein" as const, label: "protein", delta: target.proteinG - logged.proteinG, threshold: 12 },
    { key: "carbs" as const, label: "carbs", delta: target.carbsG - logged.carbsG, threshold: 18 },
    { key: "fat" as const, label: "fats", delta: target.fatG - logged.fatG, threshold: 8 },
  ].sort((left, right) => Math.abs(right.delta) - Math.abs(left.delta));
}

export function mapCoachingInsightToAlert(insight: NutritionCoachingInsightRecord): NutritionGuidanceAlert {
  return {
    eyebrow: insight.source === "progression_summary" ? "PROGRESSION-AWARE" : "LIVE SUMMARY",
    id: insight.id,
    message: insight.message,
    title: insight.title,
    tone: insight.priority === "warning" ? "warning" : insight.priority === "recovery" ? "success" : "brand",
  };
}

export function getNutritionGuidanceAlerts(
  logged: NutritionMacroTotalsRecord,
  target: NutritionMacroTotalsRecord | null,
): NutritionGuidanceAlert[] {
  if (!target) {
    return [
      {
        id: "baseline-open",
        tone: "brand",
        eyebrow: "FREE BASELINE",
        title: "Macro math is live before premium tools",
        message:
          "Calories and macros already update from your daily intake. Save a nutrition goal whenever you want live target comparisons and tighter coaching signals.",
      },
    ];
  }

  const alerts: NutritionGuidanceAlert[] = [];
  const calorieDelta = target.calories - logged.calories;

  if (calorieDelta > 150) {
    alerts.push({
      id: "calories-under",
      tone: "brand",
      eyebrow: "UNDER TARGET",
      title: `${calorieDelta.toFixed(0)} kcal still open today`,
      message:
        "You are still below today's calorie target. A denser protein-plus-carb meal is the easiest way to close the gap without random snacking.",
    });
  } else if (calorieDelta < -150) {
    alerts.push({
      id: "calories-over",
      tone: "warning",
      eyebrow: "OVER TARGET",
      title: `${Math.abs(calorieDelta).toFixed(0)} kcal over target`,
      message:
        "Today's intake is already above the calorie target. Favor leaner and lower-fat choices for the rest of the day if you want to settle back into range.",
    });
  } else {
    alerts.push({
      id: "calories-steady",
      tone: "success",
      eyebrow: "ON TRACK",
      title: "Calories are sitting inside a healthy range",
      message:
        "You are close enough to target that the next meal should focus on whichever macro is still lagging rather than chasing calories alone.",
    });
  }

  const topMacroGap = getMacroGaps(logged, target)[0];
  if (!topMacroGap) return alerts;

  if (topMacroGap.delta > topMacroGap.threshold) {
    alerts.push({
      id: `${topMacroGap.key}-under`,
      tone: "brand",
      eyebrow: "LOW MACRO",
      title: `${topMacroGap.delta.toFixed(0)}g of ${topMacroGap.label} still missing`,
      message: `Bias the next meal toward ${topMacroGap.label}. The recommendation shelf below is sorted to close that gap first.`,
    });
  } else if (topMacroGap.delta < -topMacroGap.threshold) {
    alerts.push({
      id: `${topMacroGap.key}-over`,
      tone: "warning",
      eyebrow: "MACRO RUNNING HOT",
      title: `${Math.abs(topMacroGap.delta).toFixed(0)}g over on ${topMacroGap.label}`,
      message: `You have already pushed ${topMacroGap.label} past target. The next meal can ease off that macro and balance the rest of the plate instead.`,
    });
  } else {
    alerts.push({
      id: "macro-balanced",
      tone: "success",
      eyebrow: "BALANCED MACROS",
      title: "Macro split is holding together",
      message:
        "Protein, carbs, and fats are all living near target. Use the food catalog as a stable starter shelf instead of trying to fix a big imbalance.",
    });
  }

  return alerts;
}

export function getRecommendedFoodCatalogItems(
  logged: NutritionMacroTotalsRecord,
  target: NutritionMacroTotalsRecord | null,
  limit = 3,
) {
  const defaultShelf = CURATED_FOOD_CATALOG.filter((item) => item.focus.includes("balance")).slice(0, limit);
  if (!target) return defaultShelf.length > 0 ? defaultShelf : CURATED_FOOD_CATALOG.slice(0, limit);

  const positiveGaps = getMacroGaps(logged, target).filter((gap) => gap.delta > gap.threshold / 2);
  if (positiveGaps.length === 0) return defaultShelf.length > 0 ? defaultShelf : CURATED_FOOD_CATALOG.slice(0, limit);

  return CURATED_FOOD_CATALOG
    .map((item, index) => ({
      item,
      index,
      score: positiveGaps.reduce((score, gap, gapIndex) => {
        if (!item.focus.includes(gap.key)) return score;
        return score + (positiveGaps.length - gapIndex + 1);
      }, item.focus.includes("balance") ? 1 : 0),
    }))
    .filter((entry) => entry.score > 0)
    .sort((left, right) => right.score - left.score || left.item.calories - right.item.calories || left.index - right.index)
    .slice(0, limit)
    .map((entry) => entry.item);
}

export function getFoodTrailingLabel(item: NutritionFoodCatalogItem) {
  switch (item.focus[0]) {
    case "protein":
      return "PROTEIN";
    case "carbs":
      return "CARB REFILL";
    case "fat":
      return "FAT SUPPORT";
    default:
      return "BALANCED";
  }
}

export function formatFoodSubtitle(item: NutritionFoodCatalogItem) {
  return `${item.serving} | ${item.calories.toFixed(0)} kcal | P ${item.proteinG.toFixed(0)} C ${item.carbsG.toFixed(0)} F ${item.fatG.toFixed(0)} | ${item.highlight}`;
}

export function getActiveNutritionTotals(
  activeNutrition: ActiveNutritionProfileRecord | null,
  dailySummary: DailyNutritionSummaryRecord | null,
) {
  const logged = dailySummary?.logged ?? { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 };
  const target =
    dailySummary?.target ??
    (activeNutrition
      ? {
          calories: activeNutrition.macros.targetCalories,
          proteinG: activeNutrition.macros.proteinG,
          carbsG: activeNutrition.macros.carbsG,
          fatG: activeNutrition.macros.fatG,
        }
      : null);

  return { logged, target };
}

export function resolveRecentTdee(
  activeNutrition: ActiveNutritionProfileRecord | null,
  history: NutritionTdeeRecord[],
) {
  const recentTdee = history[0] ?? activeNutrition?.tdee ?? null;
  const previousTdee = history.find((entry) => entry.id !== activeNutrition?.tdee.id) ?? null;
  return { previousTdee, recentTdee };
}
