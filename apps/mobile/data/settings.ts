import { Bell, Moon, Lock, ShieldCheck, HelpCircle, FileText, type LucideIcon } from "lucide-react-native";
import type { PrefKey } from "@/components/modals/settings/SettingsModal";

export type PasswordRequirementKey =
  | "minLength"
  | "hasUppercase"
  | "hasLowercase"
  | "hasNumber"
  | "hasSpecial";

export const PREF_META: Record<PrefKey, { title: string; icon: LucideIcon }> = {
  notifications: { title: "Notifications", icon: Bell },
  appearance: { title: "Appearance", icon: Moon },
  password: { title: "Change Password", icon: Lock },
  privacy: { title: "Privacy Settings", icon: ShieldCheck },
  help: { title: "Help Center", icon: HelpCircle },
  terms: { title: "Terms & Conditions", icon: FileText }
};

export const PASSWORD_REQUIREMENTS: Array<{ key: PasswordRequirementKey; label: string }> = [
  { key: "minLength", label: "Minimum 8 characters" },
  { key: "hasUppercase", label: "At least one uppercase letter" },
  { key: "hasLowercase", label: "At least one lowercase letter" },
  { key: "hasNumber", label: "At least one number" },
  { key: "hasSpecial", label: "At least one special character" }
];

export const HELP_FAQS = [
  { q: "How do I book a class?", a: "Go to the Bookings tab and select an available class or trainer slot." },
  { q: "How do I cancel a booking?", a: "Find the booking in your Bookings list and tap Cancel. Cancellations must be made 2 hours in advance." },
  { q: "How do I track my nutrition?", a: "Use the Nutrition tab to log your daily meals and monitor your macros." },
  { q: "How do I reset my password?", a: "Go to Settings -> Change Password and follow the prompts." }
];

export const LEGAL_INFO_CARDS = [
  {
    title: "Terms of Service",
    body: "By using FitTrack, you agree to the SertFit Gym Terms of Service. Membership fees are non-refundable. Bookings must be cancelled at least 2 hours in advance to avoid penalties."
  },
  {
    title: "Privacy Policy",
    body: "We collect only the data necessary to provide your gym experience. Your information is never sold to third parties. You may request deletion of your account at any time."
  },
  {
    title: "Version",
    body: "FitTrack v1.0.0 · © 2026 SertFit Gym. All rights reserved."
  }
];
