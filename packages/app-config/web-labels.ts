export type PageKey =
  | "dashboard"
  | "ai"
  | "members"
  | "schedule"
  | "exercise-lab"
  | "facilities"
  | "inventory"
  | "analytics"
  | "settings"
  | "profile";

export const PAGE_NAMES: Record<PageKey, string> = {
  dashboard: "Analytics",
  ai: "BrodigyAI",
  members: "Account Module",
  schedule: "Gym Operations",
  "exercise-lab": "Exercise Lab",
  facilities: "Facilities",
  inventory: "Inventory Management",
  analytics: "Analytics",
  settings: "Settings",
  profile: "Profile Settings",
};

export const ADMIN_SUBTITLES: Record<PageKey, string> = {
  dashboard: "Read the numbers and spot your next gain!",
  ai: "Live AI conversations across web and mobile.",
  members: "Accounts and access",
  schedule: "Run scheduling, appointments, and coach operations from one console.",
  "exercise-lab":
    "Review exercise submissions, milestone claims, and global definitions.",
  facilities: "Shape every zone for a cleaner training flow!",
  inventory: "Keep shelves ready for every workout day!",
  analytics: "Read the numbers and spot your next gain!",
  settings: "Tune the portal to match your gym rhythm!",
  profile: "Keep your admin profile secure and accurate!",
};
