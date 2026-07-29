import { PASSWORD_REQUIREMENTS } from "./shared-settings";

export type MobileSettingsIconKey =
  | "notifications"
  | "appearance"
  | "password"
  | "privacy"
  | "help"
  | "terms";

export const MOBILE_PREF_META = {
  notifications: { title: "Notifications", iconKey: "notifications" },
  appearance: { title: "Appearance", iconKey: "appearance" },
  password: { title: "Change Password", iconKey: "password" },
  privacy: { title: "Privacy Settings", iconKey: "privacy" },
  help: { title: "Help Center", iconKey: "help" },
  terms: { title: "Terms & Conditions", iconKey: "terms" }
} as const;

export { PASSWORD_REQUIREMENTS };

export const HELP_FAQS = [
  { q: "How do I book a class?", a: "Go to the Bookings tab and select an available class or trainer slot." },
  { q: "How do I cancel a booking?", a: "Find the booking in your Bookings list and tap Cancel. Cancellations must be made 2 hours in advance." },
  { q: "How do I track my nutrition?", a: "Use the Nutrition tab to log your daily meals and monitor your macros." },
  { q: "How do I reset my password?", a: "Go to Settings -> Change Password and follow the prompts." }
] as const;

export const LEGAL_INFO_CARDS = [
  {
    title: "Terms of Service",
    body: "Review account responsibilities, gym access, workouts and AI guidance, payments, cancellations, intellectual property, and account termination."
  },
  {
    title: "Data Privacy Notice",
    body: "Review what SertFit Gym processes, why it is needed, who receives it, how long it is retained, and your rights under the Philippine Data Privacy Act."
  },
  {
    title: "Version",
    body: "Legal policy version 2026-07-28 \u00B7 FitTrack v1.0.0 \u00B7 \u00A9 2026 SertFit Gym."
  }
] as const;
