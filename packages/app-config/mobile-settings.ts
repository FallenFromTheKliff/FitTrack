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
    body: "By using FitTrack, you agree to the SertFit Gym Terms of Service. Membership fees are non-refundable. Bookings must be cancelled at least 2 hours in advance to avoid penalties."
  },
  {
    title: "Privacy Policy",
    body: "We collect only the data necessary to provide your gym experience. Your data will only be used for account security, membership access, booking records, coaching support, payments, service notifications, and legally required gym operations. Your information is never sold to third parties. You may request deletion of your account at any time."
  },
  {
    title: "Version",
    body: "FitTrack v1.0.0 \u00B7 \u00A9 2026 SertFit Gym. All rights reserved."
  }
] as const;
