import {
  ConciergeBell,
  Dribbble,
  Dumbbell,
  Eye,
  EyeOff,
  Swords,
  UserRound,
  Volleyball,
  Waves,
  type LucideIcon,
} from "lucide-react";
import {
  normalizeVenueIconKey,
  type FitnessMilestoneProgressRecord,
  type FitnessRankingVisibility,
} from "@fittrack/types";

export type MasteryTab = "leaderboard" | "milestones" | "muscles" | "summary";
export type MuscleRankFilter = "adamantite" | "all" | "bronze" | "gold" | "platinum" | "silver";

export const RANK_FILTERS: Array<{ label: string; value: MuscleRankFilter }> = [
  { label: "All", value: "all" },
  { label: "Bronze", value: "bronze" },
  { label: "Silver", value: "silver" },
  { label: "Gold", value: "gold" },
  { label: "Platinum", value: "platinum" },
  { label: "Adamantite", value: "adamantite" },
];

const VENUE_ICONS: Record<ReturnType<typeof normalizeVenueIconKey>, LucideIcon> = {
  basketball: Dribbble,
  boxing: Swords,
  "gym-area": Dumbbell,
  reception: ConciergeBell,
  volleyball: Volleyball,
  yoga: Waves,
};

export function getVenueIcon(iconKey?: string | null): LucideIcon {
  return VENUE_ICONS[normalizeVenueIconKey(iconKey)];
}

export function formatSessionDate(value?: string | null) {
  if (!value) return "No activity yet";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "No activity yet";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function formatSessionDuration(seconds?: number | null) {
  if (!seconds) return "00:00";
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
}

export function getInitials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function getStatusTone(status: string): "brand" | "danger" | "muted" | "success" | "warning" {
  if (status === "confirmed" || status === "completed" || status === "claimed") return "success";
  if (status === "cancelled" || status === "no_show") return "danger";
  if (status.includes("pending") || status === "unlocked") return "warning";
  return "brand";
}

export function getRankingPrivacyIcon(value: FitnessRankingVisibility): LucideIcon {
  if (value === "anonymous") return UserRound;
  if (value === "private") return EyeOff;
  return Eye;
}

export function getMemberSinceLabel(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `Member since ${date.toLocaleDateString("en-US", { month: "short", year: "numeric" })}`;
}

export function getMembershipAccessSummary(status: string, hasMemberCardAccess: boolean) {
  if (status === "active") {
    return "Your membership card is active. Member-only app features are unlocked on this account.";
  }
  if (status === "pending_verification") {
    return "Your membership card payment is waiting for verification. Member-only app features unlock as soon as staff confirms it.";
  }
  if (status === "revoked") {
    return "Your membership card access is currently revoked. Ask the front desk to restore access; your one-time card payment stays on record.";
  }
  return hasMemberCardAccess
    ? "Member-only access is active for this account."
    : "No active membership card is linked to this account yet.";
}

export function sortMilestones(left: FitnessMilestoneProgressRecord, right: FitnessMilestoneProgressRecord) {
  if (left.status !== right.status) {
    if (left.status === "claimed") return 1;
    if (right.status === "claimed") return -1;
    if (left.status === "unlocked") return -1;
    if (right.status === "unlocked") return 1;
  }
  return right.progressPercent - left.progressPercent;
}
