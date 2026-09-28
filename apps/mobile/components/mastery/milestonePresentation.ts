import type { FitnessMilestoneProgressRecord } from "@fittrack/types";

export const MILESTONE_SCROLL_OWNER = "mastery-page" as const;
export const MILESTONE_SCROLL_COMPOSITION = [
  "header",
  "streak-summary",
  "search-filters",
  "milestone-grid",
  "load-more-footer",
] as const;

export const MILESTONE_NARROW_GEOMETRY = {
  claimTargetMinHeight: 44,
  titleLineCount: 2,
  titleMinHeight: 40,
} as const;

export const MILESTONE_MODAL_FOCUS_POLICY = {
  initialFocus: "close-control",
  lockUnderlyingScroll: true,
  returnFocus: "originating-card",
} as const;

export function shouldDismissMilestoneModal(
  source: "backdrop" | "close" | "content" | "escape" | "native-request",
) {
  return source !== "content";
}

export function resolveReducedMotionPreference(
  nativePreference: boolean,
  webMediaPreference: boolean,
) {
  return nativePreference || webMediaPreference;
}

export type MilestoneFooterState = {
  disabled: boolean;
  label: string;
  summary: string;
};

export function resolveMilestoneFooterState({
  hasMore,
  isLoading = false,
  total,
  visible,
}: {
  hasMore: boolean;
  isLoading?: boolean;
  total: number;
  visible: number;
}): MilestoneFooterState {
  if (isLoading) {
    return {
      disabled: true,
      label: "Loading milestones...",
      summary: `Showing ${visible} of ${total}`,
    };
  }

  return {
    disabled: !hasMore,
    label: hasMore ? "Load more milestones" : "All milestones loaded",
    summary: `Showing ${visible} of ${total}`,
  };
}

export function resolveMilestoneCardDisclosure(
  milestone: FitnessMilestoneProgressRecord,
) {
  return {
    iconAssetKey: milestone.iconAssetKey ?? null,
    iconKey: milestone.iconKey ?? null,
    iconKind: milestone.iconKind ?? "library",
    milestoneDefinitionId: milestone.milestoneDefinitionId,
    progressPercent: Math.min(Math.max(milestone.progressPercent, 0), 100),
    progressValue: milestone.progressValue,
    status: milestone.status,
    targetValue: milestone.targetValue,
    title: milestone.title,
  };
}

export function resolveMilestoneBurstAnchor(
  celebratedMilestoneId: string | null,
  milestoneDefinitionId: string,
  celebrationKey: number,
  reduceMotion = false,
) {
  if (celebrationKey <= 0 || celebratedMilestoneId !== milestoneDefinitionId) {
    return null;
  }

  if (reduceMotion) return null;

  return {
    celebrationKey,
    milestoneDefinitionId,
    scope: "card" as const,
  };
}

export function shouldOpenMilestoneDetails(source: "card" | "claim"): boolean {
  return source === "card";
}
