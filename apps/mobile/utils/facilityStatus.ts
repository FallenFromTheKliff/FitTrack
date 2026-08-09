import type { EquipmentStatus, ThemeColors } from "@fittrack/types";

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
