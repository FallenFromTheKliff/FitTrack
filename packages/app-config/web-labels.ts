export type PageKey =
  | "dashboard"
  | "ai"
  | "members"
  | "schedule"
  | "exercise-lab"
  | "gamification"
  | "gym-actions"
  | "memberships-promos"
  | "facilities"
  | "inventory"
  | "analytics"
  | "settings"
  | "profile";

export const PAGE_NAMES: Record<PageKey, string> = {
  dashboard: "Dashboard",
  ai: "BrodigyAI",
  members: "Accounts",
  schedule: "Gym Operations",
  "exercise-lab": "Exercise Lab",
  gamification: "Gamification",
  "gym-actions": "Gym Actions",
  "memberships-promos": "Membership",
  facilities: "Facilities",
  inventory: "Inventory Management",
  analytics: "Data Analytics",
  settings: "Settings",
  profile: "Profile Settings",
};

export const ADMIN_SUBTITLES: Record<PageKey, string> = {
  dashboard: "Admin pulse check before the gym floor goes full send!",
  ai: "Admin operations desk, let BrodigyAI sharpen the next business move!",
  members: "Keep every account dialed in and the crew moving strong!",
  schedule: "Staff ops, stack the day like a clean workout split!",
  "exercise-lab": "Admin eyes on form, approvals, and every legit rep!",
  gamification: "Keep the leaderboard fair and the win streaks firing!",
  "gym-actions": "Staff crew, keep payments, logs, and floor moves tight!",
  "memberships-promos": "Admin mode, keep plans pumping and promos ready!",
  facilities: "Staff check, keep every training zone ready to rip!",
  inventory: "Admin sweep, stock the essentials before the gains stall!",
  analytics: "Admin squad, read the numbers and spot the next win!",
  settings: "Admin tune-up, keep the portal running smooth!",
  profile: "Keep your portal profile fit, secure, and locked in!",
};
