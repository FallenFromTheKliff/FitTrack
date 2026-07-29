import AsyncStorage from "@react-native-async-storage/async-storage";
import type { TabKey } from "@fittrack/app-config";

export const AUTO_HELP_TABS: TabKey[] = [
  "nutrition",
  "mastery",
  "chatbot",
];

const AUTO_HELP_STORAGE_PREFIX = "fittrack:auto-help-dismissed:";
const AUTO_HELP_ALL_SCOPE = "all";

export function getAutoHelpDismissedKey(userId: string, tab: TabKey) {
  return `${AUTO_HELP_STORAGE_PREFIX}${userId}:${tab}`;
}

export function getAutoHelpDismissedAllKey(userId: string) {
  return `${AUTO_HELP_STORAGE_PREFIX}${userId}:${AUTO_HELP_ALL_SCOPE}`;
}

export async function isAutoHelpDismissed(userId: string, tab: TabKey) {
  const [allDismissed, tabDismissed] = await Promise.all([
    AsyncStorage.getItem(getAutoHelpDismissedAllKey(userId)),
    AsyncStorage.getItem(getAutoHelpDismissedKey(userId, tab)),
  ]);

  return allDismissed === "1" || tabDismissed === "1";
}

export function dismissAutoHelpForTab(userId: string, tab: TabKey) {
  return AsyncStorage.setItem(getAutoHelpDismissedKey(userId, tab), "1");
}

export function dismissAutoHelpForAll(userId: string) {
  return AsyncStorage.setItem(getAutoHelpDismissedAllKey(userId), "1");
}

export async function isAutomaticHelpEnabled(userId: string) {
  const dismissedValues = await Promise.all([
    AsyncStorage.getItem(getAutoHelpDismissedAllKey(userId)),
    ...AUTO_HELP_TABS.map((tab) =>
      AsyncStorage.getItem(getAutoHelpDismissedKey(userId, tab)),
    ),
  ]);

  return dismissedValues.every((value) => value !== "1");
}

export async function setAutomaticHelpEnabled(userId: string, enabled: boolean) {
  if (!enabled) {
    await dismissAutoHelpForAll(userId);
    return;
  }

  await Promise.all([
    AsyncStorage.removeItem(getAutoHelpDismissedAllKey(userId)),
    ...AUTO_HELP_TABS.map((tab) =>
      AsyncStorage.removeItem(getAutoHelpDismissedKey(userId, tab)),
    ),
  ]);
}
