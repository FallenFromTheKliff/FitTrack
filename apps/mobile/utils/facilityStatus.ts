import type {
  EquipmentStatus,
  FacilityTodayBookingState,
  ThemeColors,
} from "@fittrack/types";

export function getFacilityStatusLabel(status?: EquipmentStatus | null) {
  switch (status ?? "available") {
    case "maintenance":
      return "Under Maintenance";
    case "occupied":
      return "Occupied";
    case "broken":
      return "Broken";
    case "missing":
      return "Missing";
    default:
      return "Available";
  }
}

export function getFacilityStatusColor(
  status: EquipmentStatus | null | undefined,
  colors: ThemeColors,
) {
  if (status === "maintenance" || status === "broken" || status === "missing") {
    return colors.danger;
  }
  if (status === "occupied") {
    return colors.warning;
  }
  return colors.success;
}

export function getFacilityBookingBorderColor(
  input: {
    isBookable: boolean;
    todayBookingState: FacilityTodayBookingState;
  },
  colors: ThemeColors,
) {
  if (!input.isBookable || input.todayBookingState === "full") {
    return colors.danger;
  }
  if (input.todayBookingState === "partial") {
    return colors.warning;
  }
  return colors.success;
}
