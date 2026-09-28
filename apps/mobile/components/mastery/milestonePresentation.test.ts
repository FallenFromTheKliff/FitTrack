import type { FitnessMilestoneProgressRecord } from "@fittrack/types";

const presentationModulePath = "./milestonePresentation.ts";
const claimGuardModulePath = "../../hooks/mastery/milestoneClaimGuard.ts";

function assertEqual(actual: unknown, expected: unknown, message: string) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(
      `${message}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
    );
  }
}

const milestone: FitnessMilestoneProgressRecord = {
  category: "consistency",
  claimedAt: null,
  description: "Complete three workouts in one week.",
  isHidden: false,
  key: "weekly-three",
  milestoneDefinitionId: "milestone-weekly-three",
  progressPercent: 67,
  progressValue: 2,
  rewardPayload: { xp: 100 },
  status: "unlocked",
  targetValue: 3,
  title: "Weekly Warrior",
  triggerType: "source_event",
  unlockedAt: "2026-08-14T00:00:00.000Z",
  updatedAt: "2026-08-14T00:00:00.000Z",
};

async function runMilestonePresentationRegression() {
  const {
    MILESTONE_MODAL_FOCUS_POLICY,
    MILESTONE_NARROW_GEOMETRY,
    MILESTONE_SCROLL_COMPOSITION,
    MILESTONE_SCROLL_OWNER,
    resolveMilestoneBurstAnchor,
    resolveMilestoneCardDisclosure,
    resolveMilestoneFooterState,
    resolveReducedMotionPreference,
    shouldDismissMilestoneModal,
    shouldOpenMilestoneDetails,
  } = await import(presentationModulePath);
  const { createMilestoneClaimGuard } = await import(claimGuardModulePath);

  assertEqual(
    MILESTONE_SCROLL_OWNER,
    "mastery-page",
    "the mastery page remains the only vertical scroll owner",
  );
  assertEqual(
    MILESTONE_SCROLL_COMPOSITION,
    [
      "header",
      "streak-summary",
      "search-filters",
      "milestone-grid",
      "load-more-footer",
    ],
    "header through footer share the same continuous page scroll composition",
  );
assertEqual(
  Object.keys(resolveMilestoneCardDisclosure(milestone)).sort(),
  [
    "iconAssetKey",
    "iconKey",
    "iconKind",
    "milestoneDefinitionId",
    "progressPercent",
    "progressValue",
    "status",
    "targetValue",
    "title",
  ],
  "cards disclose only identity, icon, progress, and claim status data",
);
assertEqual(
  "description" in resolveMilestoneCardDisclosure(milestone),
  false,
  "description stays out of the card disclosure model",
);
assertEqual(
  shouldOpenMilestoneDetails("card"),
  true,
  "card presses open details",
);
assertEqual(
  shouldOpenMilestoneDetails("claim"),
  false,
  "claim presses stay isolated from card details",
);
assertEqual(
  resolveMilestoneFooterState({ hasMore: true, total: 12, visible: 6 }),
  {
    disabled: false,
    label: "Load more milestones",
    summary: "Showing 6 of 12",
  },
  "the footer exposes an intentional load-more action",
);
assertEqual(
  resolveMilestoneFooterState({ hasMore: false, total: 12, visible: 12 }),
  {
    disabled: true,
    label: "All milestones loaded",
    summary: "Showing 12 of 12",
  },
  "the footer exposes a clear terminal state",
);
assertEqual(
  resolveMilestoneBurstAnchor(
    "milestone-weekly-three",
    "milestone-weekly-three",
    2,
  ),
  {
    celebrationKey: 2,
    milestoneDefinitionId: "milestone-weekly-three",
    scope: "card",
  },
  "the particle burst anchors to the successfully claimed stable card id",
);
assertEqual(
  resolveMilestoneBurstAnchor("milestone-weekly-three", "another-card", 2),
  null,
  "the burst never falls back to a global or unrelated card origin",
);
  assertEqual(
    resolveMilestoneBurstAnchor(
      "milestone-weekly-three",
      "milestone-weekly-three",
      2,
      true,
    ),
    null,
    "reduced motion suppresses the particle layer entirely",
  );
  assertEqual(
    resolveReducedMotionPreference(false, true),
    true,
    "the Expo web media preference enables reduced motion",
  );
  assertEqual(
    resolveReducedMotionPreference(true, false),
    true,
    "the native accessibility preference enables reduced motion",
  );
  assertEqual(
    [
      shouldDismissMilestoneModal("backdrop"),
      shouldDismissMilestoneModal("escape"),
      shouldDismissMilestoneModal("native-request"),
      shouldDismissMilestoneModal("close"),
      shouldDismissMilestoneModal("content"),
    ],
    [true, true, true, true, false],
    "modal dismissal is owned by backdrop, Escape, native request, and close only",
  );
  assertEqual(
    MILESTONE_MODAL_FOCUS_POLICY,
    {
      initialFocus: "close-control",
      lockUnderlyingScroll: true,
      returnFocus: "originating-card",
    },
    "modal focus enters the dialog and returns to its originating card",
  );
  assertEqual(
    MILESTONE_NARROW_GEOMETRY,
    {
      claimTargetMinHeight: 44,
      titleLineCount: 2,
      titleMinHeight: 40,
    },
    "narrow cards preserve two title lines and a 44px claim target",
  );

  const guard = createMilestoneClaimGuard();
  let releaseClaim!: () => void;
  let postCount = 0;
  const pendingClaim = new Promise<void>((resolve) => {
    releaseClaim = resolve;
  });
  const firstClaim = guard.run("milestone-weekly-three", async () => {
    postCount += 1;
    await pendingClaim;
  });
  const duplicateClaimAccepted = await guard.run(
    "milestone-weekly-three",
    async () => {
      postCount += 1;
    },
  );
  assertEqual(
    [duplicateClaimAccepted, postCount],
    [false, 1],
    "a rapid same-milestone submit is synchronously rejected before a second POST",
  );
  releaseClaim();
  await firstClaim;
  const retryAccepted = await guard.run(
    "milestone-weekly-three",
    async () => {
      postCount += 1;
    },
  );
  assertEqual(
    [retryAccepted, postCount],
    [true, 2],
    "the guard clears in finally so a later retry remains available",
  );
}

void runMilestonePresentationRegression();
