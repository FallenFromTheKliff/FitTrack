export const visualReferenceManifest = {
  version: 1,
  cases: [
    {
      id: "admin-schedule-desktop",
      role: "admin",
      route: "/schedule",
      modal: null,
      seedScenario: "realistic-seed-admin-gym-operations",
      viewport: "desktop-1920x1080",
      expectedState: "Authenticated admin Gym Operations schedule landing",
      snapshot: "admin-schedule-desktop.png",
      diffPolicy: { maxDiffPixels: 0, threshold: 0, maskVolatile: true },
      maskSelectors: [
        "[data-testid='notification-count']",
        "[data-testid='notifications-badge']",
      ],
      maskTextPatterns: [],
    },
    {
      id: "member-home-mobile",
      role: "member",
      route: "/home",
      modal: null,
      seedScenario: "realistic-seed-member-home",
      viewport: "mobile-390x844",
      expectedState: "Authenticated member home shell at mobile viewport",
      snapshot: "member-home-mobile.png",
      diffPolicy: { maxDiffPixels: 0, threshold: 0, maskVolatile: true },
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
