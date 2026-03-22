import { Flame, TrendingUp, Trophy, type LucideIcon } from "lucide-react-native";

export const GOAL_ROWS: { label: string; value: string; progress: number; color: string }[] = [
  { label: "Calories Burned", value: "1,247 / 2,000", progress: 0.62, color: "#E87722" },
  { label: "Workouts Completed", value: "2 / 3", progress: 0.67, color: "#22C55E" },
  { label: "Water Intake", value: "6 / 8 glasses", progress: 0.75, color: "#3B82F6" }
];

export const HOME_STAT_CARDS: {
  icon: LucideIcon;
  label: string;
  value: string;
  sub: string;
}[] = [
  { icon: Flame, label: "Streak", value: "7", sub: "days active" },
  { icon: TrendingUp, label: "Workouts", value: "12", sub: "this week" },
  { icon: Trophy, label: "Points", value: "840", sub: "this month" }
];

export const HOME_BADGE_BANNER = {
  title: "Almost there!",
  body: "Complete 1 more workout to unlock the \"Week Warrior\" badge!"
};