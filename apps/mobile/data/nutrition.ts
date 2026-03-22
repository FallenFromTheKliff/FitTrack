import { TrendingUp, TrendingDown, Minus, type LucideIcon } from "lucide-react-native";

export type GoalType = "bulking" | "cutting" | "maintain";

export const GOAL_TYPES: { value: GoalType; label: string; Icon: LucideIcon }[] = [
  { value: "bulking", label: "Bulking", Icon: TrendingUp },
  { value: "cutting", label: "Cutting", Icon: TrendingDown },
  { value: "maintain", label: "Maintain", Icon: Minus }
];