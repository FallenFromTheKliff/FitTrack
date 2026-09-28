export const DEFAULT_MINIMUM_SIMILARITY = 0.95;
export const DEFAULT_MAX_DIFF_PIXEL_RATIO = 0.05;

export type VisualBounds = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type VisualCaptureEnvironment = {
  captureUrl: string;
  viewport: {
    id: string;
    width: number;
    height: number;
  };
  devicePixelRatio: number;
  locale: string;
  timezone: string;
  colorScheme: "light" | "dark" | "no-preference";
  reducedMotion: "reduce" | "no-preference";
  fontsFingerprint: string;
  seedScenario: string;
  state: string;
  scrollPosition: { x: number; y: number };
  browser: {
    name: string;
    version: string;
    channel?: string;
  };
};

type VisualReferenceSourceBase = {
  sourceId: string;
  sourceHash: string;
  capture: VisualCaptureEnvironment;
  /**
   * Legacy baselines remain readable, but ODiff will report N/A until a human
   * verifies their original capture environment rather than guessing it.
   */
  verification: "verified" | "migration-required";
  migrationReason?: string;
};

export type BrowserBaselineReferenceSource = VisualReferenceSourceBase & {
  kind: "browser-baseline";
};

export type NormalizedFigmaMakeReactReferenceSource =
  VisualReferenceSourceBase & {
    kind: "normalized-figma-make-react";
    humanApproval: {
      approvalId: string;
      approvedBy: string;
      approvedAt: string;
    };
  };

export type VisualReferenceSource =
  | BrowserBaselineReferenceSource
  | NormalizedFigmaMakeReactReferenceSource;

export type VisualCriticalRegion = {
  /** Stable manifest identifier; never derive this from array position. */
  id: string;
  criticality: "critical" | "supporting";
  /** Fixed CSS-pixel crop bounds for a reviewed browser reference. */
  bounds?: VisualBounds;
  /** Existing stable selector; its current bounds are used for both crops. */
  locator?: string;
  /** Defaults to the case-level minimumSimilarity. */
  minimumSimilarity?: number;
  componentAudit?: string;
};

export type VisualDiffPolicy = {
  /** 0.95 means at least 95% of comparable pixels must agree. */
  minimumSimilarity?: number;
  /** Playwright's independent screenshot tolerance, kept aligned at 5%. */
  maxDiffPixelRatio?: number;
  /** ODiff color-distance threshold; this is not a similarity threshold. */
  threshold: number;
  maskVolatile: boolean;
};

const legacyBrowserCapture = (
  sourceId: string,
  sourceHash: string,
  capture: VisualCaptureEnvironment,
): BrowserBaselineReferenceSource => ({
  kind: "browser-baseline",
  sourceId,
  sourceHash,
  capture,
  verification: "migration-required",
  migrationReason:
    "This approved browser snapshot predates capture provenance. A human must " +
    "verify the original browser version, device scale factor, and fonts before " +
    "ODiff can treat it as a comparable baseline.",
});

export const visualReferenceManifest = {
  version: 2,
  baselinePolicy: "explicit-approved-browser-capture-with-provenance",
  defaults: {
    minimumSimilarity: DEFAULT_MINIMUM_SIMILARITY,
    maxDiffPixelRatio: DEFAULT_MAX_DIFF_PIXEL_RATIO,
  },
  cases: [
    {
      id: "admin-schedule-desktop",
      role: "admin",
      surface: "web",
      route: "/schedule",
      modal: null,
      seedScenario: "realistic-seed-admin-gym-operations",
      viewport: "desktop-1920x1080",
      expectedState: "Authenticated admin Gym Operations schedule landing",
      snapshot: "admin-schedule-desktop.png",
      baselineStatus: "approved",
      referenceSource: legacyBrowserCapture(
        "fittrack:visual:admin-schedule-desktop:browser-baseline:v1",
        "sha256:8047214931edec4daab089722bb7f79c5b814ba7c463ce5e4fd60e0793a2185e",
        {
          captureUrl: "/schedule",
          viewport: { id: "desktop-1920x1080", width: 1920, height: 1080 },
          devicePixelRatio: 1,
          locale: "en-PH",
          timezone: "Asia/Manila",
          colorScheme: "light",
          reducedMotion: "reduce",
          fontsFingerprint: "migration-required",
          seedScenario: "realistic-seed-admin-gym-operations",
          state: "Authenticated admin Gym Operations schedule landing",
          scrollPosition: { x: 0, y: 0 },
          browser: {
            name: "chromium",
            channel: "chrome",
            version: "migration-required",
          },
        },
      ),
      diffPolicy: {
        minimumSimilarity: DEFAULT_MINIMUM_SIMILARITY,
        maxDiffPixelRatio: DEFAULT_MAX_DIFF_PIXEL_RATIO,
        threshold: 0,
        maskVolatile: true,
      },
      criticalRegions: [
        {
          id: "month-calendar-header",
          criticality: "critical",
          locator: "[data-ui='gym-operations-month-calendar-header']",
          componentAudit: "Calendar legend and navigation remain independently visible.",
        },
      ],
      maskSelectors: [
        "[data-testid='notification-count']",
        "[data-testid='notifications-badge']",
      ],
      maskTextPatterns: [],
    },
    {
      id: "member-home-mobile",
      role: "member",
      surface: "mobile",
      route: "/home",
      modal: null,
      seedScenario: "realistic-seed-member-home",
      viewport: "mobile-390x844",
      expectedState: "Authenticated member home shell at mobile viewport",
      snapshot: "member-home-mobile.png",
      baselineStatus: "approved",
      referenceSource: legacyBrowserCapture(
        "fittrack:visual:member-home-mobile:browser-baseline:v1",
        "sha256:f42f22ddc438809277066b6cfc160389185ce96a278510848e1d5e36c95759d7",
        {
          captureUrl: "/home",
          viewport: { id: "mobile-390x844", width: 390, height: 844 },
          devicePixelRatio: 1,
          locale: "en-PH",
          timezone: "Asia/Manila",
          colorScheme: "light",
          reducedMotion: "reduce",
          fontsFingerprint: "migration-required",
          seedScenario: "realistic-seed-member-home",
          state: "Authenticated member home shell at mobile viewport",
          scrollPosition: { x: 0, y: 0 },
          browser: {
            name: "chromium",
            channel: "chrome",
            version: "migration-required",
          },
        },
      ),
      diffPolicy: {
        minimumSimilarity: DEFAULT_MINIMUM_SIMILARITY,
        maxDiffPixelRatio: DEFAULT_MAX_DIFF_PIXEL_RATIO,
        threshold: 0,
        maskVolatile: true,
      },
      criticalRegions: [
        {
          id: "member-home-viewport",
          criticality: "critical",
          bounds: { x: 0, y: 0, width: 390, height: 844 },
          componentAudit: "The approved mobile home composition remains visible in its declared viewport.",
        },
      ],
      maskSelectors: [
        "[data-testid='notification-count']",
        "[data-testid='notifications-badge']",
        "[data-volatile]",
      ],
      maskTextPatterns: ["clock", "exp"],
    },
  ],
} as const;

export function getVisualReference(id: string) {
  const reference = visualReferenceManifest.cases.find((candidate) => candidate.id === id);
  if (!reference) throw new Error(`Unknown visual reference case: ${id}`);
  return reference;
}

export function getMinimumSimilarity(policy: { minimumSimilarity?: number }) {
  return policy.minimumSimilarity ?? DEFAULT_MINIMUM_SIMILARITY;
}

export function getMaxDiffPixelRatio(policy: { maxDiffPixelRatio?: number }) {
  return policy.maxDiffPixelRatio ?? DEFAULT_MAX_DIFF_PIXEL_RATIO;
}
