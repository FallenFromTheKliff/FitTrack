import { useMemo } from "react";
import { useRouter } from "expo-router";
import { Activity, CalendarPlus, MapPin, Swords } from "lucide-react-native";

import { useTheme } from "@/contexts/ThemeContext";
import type { FABMenuItem } from "@/contexts/FABStateContext";

export function useHomeFABItems(): FABMenuItem[] {
  const { colors } = useTheme();
  const router = useRouter();

  return useMemo<FABMenuItem[]>(() => [
    {
      label: "Start Workout",
      sub: "AI rep counter",
      icon: Swords,
      iconColor: colors.brand,
      iconBg: colors.brand + "22",
      onPress: () => router.push("/(tabs)/workout")
    },
    {
      label: "Book Slot",
      sub: "Reserve now",
      icon: CalendarPlus,
      iconColor: colors.textSecondary,
      iconBg: colors.textSecondary + "22",
      onPress: () => router.push("/(tabs)/bookings?openReservation=true")
    },
    {
      label: "Gym Map",
      sub: "Find equipment",
      icon: MapPin,
      iconColor: colors.success,
      iconBg: colors.success + "22",
      onPress: () => router.push("/(tabs)/facilities")
    },
    {
      label: "Track Progress",
      sub: "View stats",
      icon: Activity,
      iconColor: colors.warning,
      iconBg: colors.warning + "22",
      onPress: () => router.push("/(tabs)/nutrition")
    }
  ], [colors.brand, colors.success, colors.textSecondary, colors.warning, router]);
}
