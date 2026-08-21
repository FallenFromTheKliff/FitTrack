export type TabKey =
  | "home"
  | "facilities"
  | "bookings"
  | "assessments"
  | "nutrition"
  | "mastery"
  | "workout"
  | "chathistory"
  | "chatbot"
  | "profile"
  | "settings";

export const SCREEN_NAMES: Record<TabKey, string> = {
  home: "Home",
  facilities: "Gym Facilities",
  bookings: "Bookings",
  assessments: "Assessments",
  nutrition: "Nutrition",
  mastery: "Muscle Mastery",
  workout: "Workout",
  chathistory: "BrodigyAI",
  chatbot: "BrodigyAI",
  profile: "Profile",
  settings: "Settings"
};

export const TAB_SUBTITLES: Record<TabKey, string> = {
  home: "Check out your progress!",
  facilities: "Explore the gym floor!",
  bookings: "Stay on top of your schedule!",
  assessments: "Review coach notes and feedback!",
  nutrition: "Fuel your body right!",
  mastery: "Track muscle EXP and rank climbs!",
  workout: "Time to crush it!",
  chathistory: "Your AI fitness assistant!",
  chatbot: "Your AI fitness assistant!",
  profile: "",
  settings: "Personalize your experience!"
};
