export type AmenityStatus = "available" | "maintenance" | "unavailable";

export const AMENITY_STATUS_META: Record<AmenityStatus, { label: string; color: string }> = {
  available: { label: "Available", color: "#22C55E" },
  maintenance: { label: "Under Maintenance", color: "#F59E0B" },
  unavailable: { label: "Unavailable", color: "#EF4444" }
};
