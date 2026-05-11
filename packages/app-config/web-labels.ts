export type PageKey =
  | "dashboard"
  | "ai"
  | "accounts"
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
  | "coach-clients"
  | "coach-sessions"
  | "member-home"
  | "member-facilities"
  | "member-bookings"
  | "member-nutrition"
  | "member-mastery"
  | "member-workout"
  | "member-profile";

export const PAGE_NAMES: Record<PageKey, string> = {
  dashboard: "Dashboard",
  ai: "BrodigyAI",
  accounts: "Accounts",
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
  "coach-clients": "Clients",
  "coach-sessions": "Sessions",
  "member-home": "Home",
  "member-facilities": "Gym Facilities",
  "member-bookings": "Bookings",
  "member-nutrition": "Nutrition",
  "member-mastery": "Muscle Mastery",
  "member-workout": "Workout",
  "member-profile": "Profile",
};

export const PAGE_SUBTITLES: Record<PageKey, string> = {
  dashboard: "Admin pulse check before the gym floor goes full send!",
  ai: "Ask BrodigyAI for focused guidance without leaving the web portal.",
  accounts: "Keep every account dialed in and the crew moving strong!",
  schedule: "Manage schedules, coaches, appointments, and booking operations.",
  "exercise-lab": "Admin eyes on form, approvals, and every legit rep!",
  gamification: "Keep the leaderboard fair and the win streaks firing!",
  "gym-actions": "Staff crew, keep payments, logs, and floor moves tight!",
  "memberships-promos": "Admin mode, keep plans pumping and promos ready!",
  facilities: "Staff check, keep every training zone ready to rip!",
  inventory: "Admin sweep, stock the essentials before the gains stall!",
  analytics: "Monitor business performance, revenue, attendance, and AI insights.",
  settings: "Tune your portal preferences, notifications, and security.",
  profile: "Keep your portal profile fit, secure, and locked in!",
  "coach-clients": "Keep every lifter's goals, check-ins, and next push locked in.",
  "coach-sessions": "Track the coaching blocks where cues, reps, and effort turn into progress.",
  "member-home": "Check out your progress!",
  "member-facilities": "Explore the gym floor!",
  "member-bookings": "Stay on top of your schedule!",
  "member-nutrition": "Fuel your body right!",
  "member-mastery": "Track muscle EXP and rank climbs!",
  "member-workout": "Time to crush it!",
  "member-profile": "Your member profile hub.",
};
