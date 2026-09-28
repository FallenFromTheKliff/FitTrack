import { Bell, Moon, Lock, ShieldCheck, HelpCircle, FileText, type LucideIcon } from "lucide-react-native";
import {
  HELP_FAQS,
  LEGAL_INFO_CARDS,
  MOBILE_PREF_META,
  PASSWORD_REQUIREMENTS,
  type MobileSettingsIconKey,
  type PasswordRequirementKey
} from "@fittrack/app-config";
import type { PrefKey } from "@/components/modals/settings/SettingsModal";

export type { PasswordRequirementKey };

const MOBILE_ICON_MAP: Record<MobileSettingsIconKey, LucideIcon> = {
  notifications: Bell,
  appearance: Moon,
  password: Lock,
  privacy: ShieldCheck,
  help: HelpCircle,
  terms: FileText
};

export const PREF_META: Record<PrefKey, { title: string; icon: LucideIcon }> = Object.fromEntries(
  Object.entries(MOBILE_PREF_META).map(([key, value]) => [
    key,
    { title: value.title, icon: MOBILE_ICON_MAP[value.iconKey] }
  ])
) as Record<PrefKey, { title: string; icon: LucideIcon }>;

export { HELP_FAQS, LEGAL_INFO_CARDS, PASSWORD_REQUIREMENTS };
