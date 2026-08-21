import type { MemberRecord } from "@fittrack/types";

export const COACH_CLIENT_ACTIONS = [
  "overview",
  "schedule",
  "workout",
  "feedback",
] as const;

export type CoachClientAction = (typeof COACH_CLIENT_ACTIONS)[number];

export const COACH_CLIENT_ACTION_LABELS: Record<CoachClientAction, string> = {
  overview: "Overview",
  schedule: "Schedule",
  workout: "Workout",
  feedback: "Session Report",
};

export function formatCoachDetailValue(
  value?: string | number | null,
  suffix?: string,
) {
  if (value === null || value === undefined || value === "") return "N/A";
  return suffix ? `${value}${suffix}` : String(value);
}

export function formatCoachScheduleDate(value?: string | null) {
  if (!value) return "Not scheduled";

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Not scheduled";

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(parsed);
}

export function formatCoachStatusLabel(status?: string | null) {
  if (!status) return "Unknown";

  return status
    .split("_")
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
}

export function getCoachRelationshipLabel(member?: MemberRecord | null) {
  return member?.membershipCard?.status === "active"
    ? "Member"
    : "No active membership";
}

export function getCoachAccountStatusLabel(member?: MemberRecord | null) {
  return member?.status === "active" ? "Active" : "Inactive";
}

export function getCoachMetricsLabel(member?: MemberRecord | null) {
  if (!member?.profile) return "N/A";

  const weight = formatCoachDetailValue(member.profile.currentWeightKg, " kg");
  const height = formatCoachDetailValue(member.profile.heightCm, " cm");
  if (weight === "N/A" && height === "N/A") return "N/A";
  return `${weight} / ${height}`;
}

export function getCoachActionDisabledReason(
  member?: MemberRecord | null,
  canManageWorkout = true,
) {
  if (!member) return "Select a client to open coach tools.";
  if (!canManageWorkout) {
    return "Workout editing unlocks after an active paid coaching relationship.";
  }
  return null;
}
