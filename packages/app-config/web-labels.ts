export type PageKey =
  | "dashboard"
  | "ai"
  | "accounts"
  | "schedule"
  | "exercise-lab"
  | "gamification"
  | "milestones"
  | "gym-actions"
  | "memberships-promos"
  | "facilities"
  | "inventory"
  | "analytics"
  | "settings"
  | "profile"
  | "coach-dashboard"
  | "coach-clients"
  | "coach-sessions"
  | "coach-earnings"
  | "coach-gamification"
  | "coach-exercise-lab"
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
  gamification: "Ranking Governance",
  milestones: "Milestones",
  "gym-actions": "Gym Actions",
  "memberships-promos": "Memberships",
  facilities: "Facilities",
  inventory: "Inventory Management",
  analytics: "Data Analytics",
  settings: "Settings",
  profile: "Profile Settings",
  "coach-dashboard": "Dashboard",
  "coach-clients": "Clients",
  "coach-sessions": "Sessions",
  "coach-earnings": "Earnings",
  "coach-gamification": "Gamification",
  "coach-exercise-lab": "Exercise Lab",
  "member-home": "Home",
  "member-facilities": "Gym Facilities",
  "member-bookings": "Bookings",
  "member-nutrition": "Nutrition",
  "member-mastery": "Muscle Mastery",
  "member-workout": "Workout",
  "member-profile": "Profile",
};

export const PAGE_SUBTITLES: Record<PageKey, string> = {
  dashboard: "Today at a glance.",
  ai: "Ask BrodigyAI.",
  accounts: "Manage gym accounts.",
  schedule: "Run bookings and schedules.",
  "exercise-lab": "Manage exercises, muscles, and form reviews.",
  gamification: "Review standings and ranking integrity.",
  milestones: "Govern milestone rules.",
  "gym-actions": "Review operational activity and transaction history.",
  "memberships-promos": "Manage plans and promos.",
  facilities: "Keep zones ready.",
  inventory: "Track gym stock.",
  analytics: "",
  settings: "Tune your portal.",
  profile: "Manage your profile.",
  "coach-dashboard": "Coach work at a glance.",
  "coach-clients": "Review client progress.",
  "coach-sessions": "Manage coaching sessions.",
  "coach-earnings": "Track session revenue.",
  "coach-gamification": "Follow member progress.",
  "coach-exercise-lab": "Review coaching cues.",
  "member-home": "Check out your progress!",
  "member-facilities": "Explore the gym floor!",
  "member-bookings": "Stay on top of your schedule!",
  "member-nutrition": "Fuel your body right!",
  "member-mastery": "Track muscle EXP and rank climbs!",
  "member-workout": "Time to crush it!",
  "member-profile": "Your member profile hub.",
};
