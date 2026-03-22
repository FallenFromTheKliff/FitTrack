import { Dumbbell, Flame, TrendingUp, Trophy, Zap, type LucideIcon } from "lucide-react-native";
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

export const BADGE_COLORS: Record<string, string> = {
  Diamond: "#3B82F6",
  Gold: "#F59E0B",
  Silver: "#9CA3AF",
  Bronze: "#CD7C3A"
};

export const MOCK_BADGES: Array<{
  tier: "Diamond" | "Gold" | "Silver" | "Bronze";
  label: string;
  subtitle: string;
  progress: number;
}> = [
  { tier: "Diamond", label: "Diamond Biceps", subtitle: "180 workouts completed", progress: 0.95 },
  { tier: "Gold", label: "Gold Legs", subtitle: "120 workouts completed", progress: 0.76 },
  { tier: "Silver", label: "Silver Chest", subtitle: "80 workouts completed", progress: 0.55 },
  { tier: "Bronze", label: "Bronze Back", subtitle: "45 workouts completed", progress: 0.32 }
];

export const PROFILE_STATS: Array<{ icon: LucideIcon; label: string; value: string }> = [
  { icon: Dumbbell, label: "Workouts", value: "156" },
  { icon: Flame, label: "Streak", value: "12" },
  { icon: Trophy, label: "Badges", value: "4" }
];

export const MOCK_ACHIEVEMENTS: Array<{ icon: LucideIcon; label: string; date: string }> = [
  { icon: Trophy, label: "50 Workouts Milestone", date: "Jan 25, 2025" },
  { icon: Zap, label: "Early Bird Streak (7 days)", date: "Jan 20, 2025" },
  { icon: TrendingUp, label: "Personal Best: Bench Press", date: "Jan 15, 2025" }
];
