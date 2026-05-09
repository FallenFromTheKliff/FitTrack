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
  | "profile"
  | "member-home"
  | "member-facilities"
  | "member-bookings"
  | "member-nutrition"
  | "member-mastery"
  | "member-ai"
  | "member-profile"
  | "member-settings";

export const PAGE_NAMES: Record<PageKey, string> = {
  dashboard: "Dashboard",
  ai: "BrodigyAI",
  members: "Accounts Archive",
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
  "member-home": "Home",
  "member-facilities": "Gym Facilities",
  "member-bookings": "Bookings",
  "member-nutrition": "Nutrition",
  "member-mastery": "Muscle Mastery",
  "member-ai": "BrodigyAI",
  "member-profile": "Profile",
  "member-settings": "Settings",
};

export const ADMIN_SUBTITLES: Record<PageKey, string> = {
  dashboard: "Admin pulse check before the gym floor goes full send!",
  ai: "Admin operations desk, let BrodigyAI sharpen the next business move!",
  members: "Keep every account dialed in and the crew moving strong!",
  schedule: "Manage schedules, coaches, appointments, and booking operations.",
  "exercise-lab": "Admin eyes on form, approvals, and every legit rep!",
  gamification: "Keep the leaderboard fair and the win streaks firing!",
  "gym-actions": "Staff crew, keep payments, logs, and floor moves tight!",
  "memberships-promos": "Admin mode, keep plans pumping and promos ready!",
  facilities: "Staff check, keep every training zone ready to rip!",
  inventory: "Admin sweep, stock the essentials before the gains stall!",
  analytics: "Monitor business performance, revenue, attendance, and AI insights.",
  settings: "Admin tune-up, keep the portal running smooth!",
  profile: "Keep your portal profile fit, secure, and locked in!",
  "member-home": "Check out your progress!",
  "member-facilities": "Explore the gym floor!",
  "member-bookings": "Stay on top of your schedule!",
  "member-nutrition": "Fuel your body right!",
  "member-mastery": "Track muscle EXP and rank climbs!",
  "member-ai": "Your AI fitness assistant!",
  "member-profile": "Your member profile hub.",
  "member-settings": "Personalize your experience!",
};
