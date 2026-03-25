export type PageKey =
  | "dashboard"
  | "members"
  | "schedule"
  | "facilities"
  | "inventory"
  | "analytics"
  | "settings"
  | "profile";

export const PAGE_NAMES: Record<PageKey, string> = {
  dashboard: "Dashboard",
  members: "Members",
  schedule: "Staff Schedule",
  facilities: "Facilities",
  inventory: "Inventory Management",
  analytics: "Analytics & Reports",
  settings: "Settings",
  profile: "Profile Settings"
};

export const ADMIN_SUBTITLES: Record<PageKey, string> = {
  dashboard: "Quick pulse check of today's gym activity!",
  members: "Keep your roster sharp and up to date!",
  schedule: "Keep sessions smooth and your team on time!",
  facilities: "Shape every zone for a cleaner training flow!",
  inventory: "Keep shelves ready for every workout day!",
  analytics: "Read the numbers and spot your next gain!",
  settings: "Tune the portal to match your gym rhythm!",
  profile: "Keep your admin profile secure and accurate!"
};