export type TabKey =
  | "home"
  | "facilities"
  | "bookings"
  | "nutrition"
  | "workout"
  | "chathistory"
  | "chatbot"
  | "profile"
  | "settings";

export const SCREEN_NAMES: Record<TabKey, string> = {
  home: "Home",
  facilities: "Gym Facilities",
  bookings: "Bookings",
  nutrition: "Nutrition",
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
  nutrition: "Fuel your body right!",
  workout: "Time to crush it!",
  chathistory: "Your AI fitness assistant!",
  chatbot: "Your AI fitness assistant!",
  profile: "",
  settings: "Personalize your experience!"
};
