import type { MemberTier } from "@fittrack/types";

export const TIER_LABELS: Record<MemberTier, string> = {
  Basic: "Fit Starter",
  Premium: "Muscle Mastery",
  Elite: "Peak Performer"
};

export const TIER_LEVELS: Record<MemberTier, number> = {
  Basic: 4,
  Premium: 12,
  Elite: 24
};
