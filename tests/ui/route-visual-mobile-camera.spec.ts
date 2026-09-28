import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { Locator, Page } from "@playwright/test";
import { expect, test } from "./visual-fixtures";
import {
  auditConventionalLayout,
  stabilizeVisualPage,
} from "./visual-stabilizer";

const cameraViewports = [
  "mobile-320x844",
  "mobile-390x844",
  "mobile-430x932",
] as const;

const cameraFacingOrSubjectControl = (page: Page) =>
  page.getByRole("button", {
    name: /^(?:Front|Back)$/,
  });

async function expectNoOverlap(
  first: Locator,
  second: Locator,
  description: string,
) {
  const [firstBox, secondBox] = await Promise.all([
    first.boundingBox(),
    second.boundingBox(),
  ]);
  expect(firstBox, `${description}: first bounds`).not.toBeNull();
  expect(secondBox, `${description}: second bounds`).not.toBeNull();
  if (!firstBox || !secondBox) return;

  const overlapWidth =
    Math.min(firstBox.x + firstBox.width, secondBox.x + secondBox.width) -
    Math.max(firstBox.x, secondBox.x);
  const overlapHeight =
    Math.min(firstBox.y + firstBox.height, secondBox.y + secondBox.height) -
    Math.max(firstBox.y, secondBox.y);
  expect(
    overlapWidth <= 0 || overlapHeight <= 0,
    `${description}: bounding boxes overlap`,
  ).toBe(true);
}

for (const viewport of cameraViewports) {
  test.describe(`route visual smoke · mobile camera · ${viewport}`, () => {
    test.use({
      visualRole: "member",
      visualSurface: "mobile",
      visualViewport: viewport,
    });

    test("keeps the camera target flow usable without a visual baseline", async ({ authenticatedPage }, testInfo) => {
      test.skip(
        testInfo.project.name !== viewport,
        `This case is scoped to ${viewport}; no ODiff baseline is defined.`,
      );

      const page = authenticatedPage;
      testInfo.annotations.push({
        type: "odiff",
        description:
          "N/A: Figma Make is directional and this camera state has no approved browser baseline.",
      });
      await page.goto(new URL("/workout", page.url()).toString());
      await expect(page).toHaveURL(/\/workout(?:\?|$)/);

      const startWorkout = page.getByRole("button", {
        name: "Start Today's Workout",
      });
      const cameraButton = page.getByRole("button", {
        name: "Track This Set With Camera",
      });

      if (await startWorkout.isVisible().catch(() => false)) {
        await startWorkout.click();
        try {
          await expect(startWorkout).toHaveCount(0, { timeout: 20_000 });
        } catch {
          throw new Error(
            "Camera entry blocked: Start Today's Workout remained visible after activation. " +
              "The current seeded member state did not create an active camera-capable session.",
          );
        }
      }
      try {
        await expect(cameraButton).toBeVisible({ timeout: 20_000 });
      } catch {
        throw new Error(
          "Camera entry blocked: the current seeded workout did not expose " +
            "Track This Set With Camera for its next set. Use a deterministic camera-capable " +
            "workout fixture; do not change production seed data in this visual lane.",
        );
      }
      await cameraButton.click();

      // The target header and manual escape are the stable cross-platform
      // contract. Generated camera pixels and pose movement are intentionally
      // outside this browser-only deterministic lane.
      await expect(page.getByText("CAMERA TARGET", { exact: true })).toBeVisible();
      await expect(
        page.getByText(/Set \d+ of \d+ · (?:\d+ reps|\d+s hold)/).first(),
      ).toBeVisible();
      await expect(
        page.getByRole("button", { name: "Return to manual workout entry" }),
      ).toBeVisible();
      await stabilizeVisualPage(page);

      await expect(page.getByText("Live Tracking", { exact: true })).toBeVisible();

      const cameraStatus = page.locator('[aria-label^="Camera "]').first();
      await expect(cameraStatus).toBeVisible();
      await expect(cameraStatus).toHaveAttribute(
        "aria-label",
        /Camera (?:ready|tracking|rest|saving) .*\d+(?:\.\d+)? of \d+(?:\.\d+)? (?:reps|seconds)/,
      );

      const counterValue = page
        .getByText(/^\d+(?:\.\d+)?\s*\/\s*\d+(?:\.\d+)?$/)
        .first();
      await expect(counterValue).toBeVisible();
      const counterLabel = page.getByText(/^(?:REPS|SECONDS)$/).first();
      await expect(counterLabel).toBeVisible();

      const repGatesOverlay = page.getByTestId("rep-gates-overlay");
      await expect(repGatesOverlay).toBeVisible();
      await expect(page.getByTestId("rep-gates-guidance-card")).toBeVisible();

      const romLane = page.getByTestId("rep-gates-rom-lane");
      const holdLane = page.getByTestId("rep-gates-static-hold");
      if (await romLane.count()) {
        await expect(romLane).toBeVisible();
        await expect(romLane.getByText("TARGET", { exact: true })).toBeVisible();
        await expect(romLane.getByText("START", { exact: true })).toBeVisible();
      } else {
        await expect(holdLane).toBeVisible();
        await expect(holdLane.getByText("HOLD ZONE", { exact: true })).toBeVisible();
      }

      const cameraPermissionOrStart = page.getByRole("button", {
        name: /^(?:Allow Camera Access|Start Camera|Start Set)$/,
      });
      await expect(cameraPermissionOrStart.first()).toBeVisible();

      // Camera-facing and subject-lock controls only exist after a browser or
      // native camera permission is available. Assert them whenever that state
      // is reachable, while still covering the permission-gated web state.
      const cameraControl = cameraFacingOrSubjectControl(page).first();
      if (await cameraControl.count()) {
        await expect(cameraControl).toBeVisible();
      } else {
        testInfo.annotations.push({
          type: "camera-permission",
          description:
            "Camera-facing and subject-lock controls are unavailable until browser camera permission is granted.",
        });
      }

      await expectNoOverlap(
        page.getByText("TIMER", { exact: true }).first(),
        counterValue,
        "top TIMER metric vs centered counter",
      );
      await expectNoOverlap(
        page.getByText("KCAL", { exact: true }).first(),
        counterValue,
        "top KCAL metric vs centered counter",
      );
      const loadMetric = page.getByText("LOAD", { exact: true }).first();
      await expect(loadMetric).toBeVisible();
      await expectNoOverlap(
        loadMetric,
        counterValue,
        "top LOAD metric vs centered counter",
      );
      if (await cameraControl.count()) {
        await expectNoOverlap(
          page.getByText("TIMER", { exact: true }).first(),
          cameraControl,
          "top TIMER metric vs camera-facing control",
        );
        await expectNoOverlap(
          page.getByText("KCAL", { exact: true }).first(),
          cameraControl,
          "top KCAL metric vs camera-facing control",
        );
        await expectNoOverlap(
          loadMetric,
          cameraControl,
          "top LOAD metric vs camera-facing control",
        );
      }

      const subjectStatus = page
        .getByText(/^(?:GET IN FRAME|BODY TRACKED)$/)
        .first();
      if (await subjectStatus.count()) {
        await expect(subjectStatus).toBeVisible();
        const startGate = page.getByText("START", { exact: true }).first();
        if (await startGate.count()) {
          await expect(startGate).toBeVisible();
          await expectNoOverlap(
            subjectStatus,
            startGate,
            "subject status vs START lane",
          );
        }
      } else {
        testInfo.annotations.push({
          type: "camera-permission",
          description:
            "Subject status is unavailable until browser camera permission is granted.",
        });
      }

      const startSet = page.getByRole("button", { name: "Start Set" });
      if (await startSet.count()) {
        await expect(startSet).toBeVisible();
      } else {
        await expect(
          page.getByRole("button", {
            name: /^(?:Allow Camera Access|Start Camera)$/,
          }),
        ).toBeVisible();
      }
      if (await startSet.count() && await startSet.isEnabled().catch(() => false)) {
        await startSet.click();
        await expect(
          page.getByRole("button", { name: /^(?:Pause|Pause recording)$/ }),
        ).toBeVisible();

        const pause = page.getByRole("button", {
          name: /^(?:Pause|Pause recording)$/,
        });
        await pause.click();
        await expect(
          page.getByRole("button", { name: /^(?:Resume|Resume recording)$/ }),
        ).toBeVisible();
      }

      const finishSet = page.getByRole("button", { name: "Finish Set" });
      if (await finishSet.count() && await finishSet.isEnabled().catch(() => false)) {
        await finishSet.click();
        await expect(page.getByText("Save This Set?", { exact: true })).toBeVisible();
        await page.getByRole("button", { name: "Keep Going" }).click();
        await expect(page.getByText("Save This Set?", { exact: true })).toHaveCount(0);
      }

      const audit = await auditConventionalLayout(page);
      expect(audit.horizontalOverflow, "horizontal overflow").toBe(false);
      expect(audit.squishedText, "squished text").toEqual([]);
      expect(audit.clipping, "clipped text or controls").toEqual([]);
      expect(audit.overlaps, "overlapping interactive controls").toEqual([]);
      expect(audit.nestedScrollbars, "nested scrollbars").toEqual([]);
      expect(audit.awkwardProportions, "awkward interactive proportions").toEqual([]);

      await page.getByRole("button", { name: "Return to manual workout entry" }).click();
      await expect(page.getByText("Today's workout", { exact: true })).toBeVisible();
    });
  });
}

test.describe("mobile camera overlay source contract", () => {
  test("retains the required Rep Gates anchors without a visual baseline", async ({ page: _page }, testInfo) => {
    test.skip(
      testInfo.project.name !== "mobile-390x844",
      "Run the static source contract once; browser viewport coverage is handled above.",
    );
    testInfo.annotations.push({
      type: "odiff",
      description:
        "N/A: static source contract only; Figma Make remains directional.",
    });

    const [liveScreen, trackingSection, overlay, nativeCamera] = await Promise.all([
      readFile(
        resolve(process.cwd(), "apps/mobile/components/workout/WorkoutLiveScreen.tsx"),
        "utf8",
      ),
      readFile(
        resolve(process.cwd(), "apps/mobile/components/workout/WorkoutTrackingSection.tsx"),
        "utf8",
      ),
      readFile(
        resolve(process.cwd(), "apps/mobile/components/workout/RepGatesOverlay.tsx"),
        "utf8",
      ),
      readFile(
        resolve(process.cwd(), "apps/mobile/components/workout/NativeVisionPoseCamera.native.tsx"),
        "utf8",
      ),
    ]);

    expect(liveScreen).toContain("Live Tracking");
    expect(liveScreen).toContain("CAMERA TARGET");
    expect(liveScreen).toContain('accessibilityLabel="Return to manual workout entry"');
    expect(liveScreen).not.toContain("onToggleSubjectLock=");

    expect(trackingSection).toContain("${reps} / ${targetReps}");
    expect(trackingSection).toContain('"REPS"');
    expect(trackingSection).toContain('"SECONDS"');
    expect(trackingSection).toContain("LOAD");
    expect(trackingSection).toContain('"Start Set"');
    expect(trackingSection).toContain('label="Finish Set"');
    expect(trackingSection).toContain('isRecording ? "Pause" : "Resume"');
    expect(trackingSection).not.toContain('testID="workout-subject-lock-controls"');
    expect(trackingSection).not.toContain('"Lock on me"');
    expect(trackingSection).not.toContain('"Unlock target"');

    for (const anchor of [
      'testID="rep-gates-overlay"',
      'testID="rep-gates-guidance-card"',
      'testID="rep-gates-rom-lane"',
      'testID="rep-gates-rom-glow"',
      'testID="rep-gates-rep-complete"',
      'testID="rep-gates-static-hold"',
      "TARGET",
      "HOLD ZONE",
    ]) {
      expect(overlay, `missing Rep Gates anchor: ${anchor}`).toContain(anchor);
    }
    expect(overlay).toContain("statusText");
    expect(overlay).toContain('top: "43%"');
    expect(overlay).toContain("getCompactStatusCopy");
    expect(overlay).not.toContain("{statusText ?? guidance.label}");
    expect(nativeCamera).toContain("frame.orientation");
    expect(nativeCamera).toContain("frame.isMirrored");
    expect(nativeCamera).toContain("cameraRotationFromOrientation");
    expect(nativeCamera).not.toContain("takeSnapshot");
    expect(nativeCamera).not.toContain("equipmentSnapshot");

    // Registration stays monotonic and independent of transient rig state;
    // lifecycle cleanup remains centralized.
    expect(overlay).toContain("isStaticHold");
    expect(overlay).toContain("const clearCompletionFeedback = useCallback");
    expect(overlay).toContain("cancelAnimation(completionPulse)");
    expect(overlay).toContain("completionPulse.value = 0");
    expect(overlay).toContain("clearTimeout(reducedMotionConfirmationTimerRef.current)");
    expect(overlay).toContain("setReducedMotionConfirmationVisible(false)");
    expect(overlay).toContain("return clearCompletionFeedback;");
    expect(overlay.match(/clearCompletionFeedback\(\);/g)?.length ?? 0).toBeGreaterThanOrEqual(3);

    const registeredRepStart = overlay.indexOf("const registeredRep =");
    const registeredRepEnd = overlay.indexOf("if (!registeredRep)", registeredRepStart);
    const registeredRepBlock = overlay.slice(registeredRepStart, registeredRepEnd);
    expect(registeredRepBlock).toContain("previousReps !== null");
    expect(registeredRepBlock).toContain("safeReps > previousReps");
    expect(registeredRepBlock).toContain("!isStaticHold");
    expect(registeredRepBlock).not.toContain("lowConfidence");
    expect(registeredRepBlock).not.toContain("hasLiveKeypoints");

    for (const removedLayer of [
      "railContrast",
      "gateBackplate",
      "orbContrast",
      'testID="rep-gates-rom-contrast"',
      'testID="rep-gates-target-contrast"',
      'testID="rep-gates-start-contrast"',
      'testID="rep-gates-orb-contrast"',
    ]) {
      expect(overlay, `removed Rep Gates layer remains: ${removedLayer}`).not.toContain(
        removedLayer,
      );
    }

    const targetGateStart = overlay.indexOf('<View style={styles.gateTarget}>');
    const startGateStart = overlay.indexOf('<View style={styles.gateStart}>');
    const targetGateBlock = overlay.slice(targetGateStart, startGateStart);
    const startGateBlock = overlay.slice(
      startGateStart,
      overlay.indexOf("\n        </View>\n      )}", startGateStart),
    );
    expect(targetGateBlock).toContain("styles.gateHaloInner");
    expect(targetGateBlock).toContain("styles.gateHaloOuter");
    expect(startGateBlock).toContain("styles.gateHaloInner");
    expect(startGateBlock).toContain("styles.gateHaloOuter");
    expect(targetGateBlock).not.toContain("{isTargetActive ? (");
    expect(startGateBlock).not.toContain("{isStartActive ? (");
    expect(overlay).toContain("railFalloffInner");
    expect(overlay).toContain("railFalloffOuter");
    expect(overlay).toContain("styles.railTrack, { backgroundColor: colors.brand, opacity: 1 }");
    expect(overlay).toContain("activeGateHaloInnerOpacity = 0.3");
    expect(overlay).toContain("inactiveGateHaloInnerOpacity = 0.16");
    expect(overlay).toContain("activeGateHaloOuterOpacity = 0.14");
    expect(overlay).toContain("inactiveGateHaloOuterOpacity = 0.07");
    expect(overlay).toContain("scale: 1 + orbPulse.value * 0.12");
    expect(overlay).toContain("duration: 900");
    expect(overlay).toContain('"RETURN ↓"');
    expect(overlay).toContain('"ARMED ✓"');
    expect(overlay).toContain('"TARGET ↑"');
    expect(overlay).toContain('"HIT ✓"');
    const startGateLabelStart = overlay.indexOf("const startGateLabel =");
    const startGateLabelEnd = overlay.indexOf("const orbDirection =", startGateLabelStart);
    const startGateLabelMapping = overlay
      .slice(startGateLabelStart, startGateLabelEnd)
      .replace(/\s+/g, " ");
    expect(startGateLabelMapping).toMatch(
      /const startGateLabel = \{ armed: "ARMED ✓", waiting: "RETURN ↓", unreliable: "RETURN ↓", returning: "RETURN ↓", moving: "START", target: "START", \}\[gateState\];/,
    );
    expect(startGateLabelMapping.match(/"RETURN ↓"/g)?.length ?? 0).toBe(3);
    expect(startGateLabelMapping).not.toContain("isStartActive ?");

    const railInnerStyleStart = overlay.indexOf("railFalloffInner:");
    const railOuterStyleStart = overlay.indexOf("railFalloffOuter:", railInnerStyleStart);
    const railInnerStyle = overlay.slice(railInnerStyleStart, railOuterStyleStart);
    const railOuterStyle = overlay.slice(
      railOuterStyleStart,
      overlay.indexOf("railProgress:", railOuterStyleStart),
    );
    expect(railInnerStyle).toContain("width: 4");
    expect(railOuterStyle).toContain("width: 8");
    expect(overlay).toContain("{ backgroundColor: colors.brand, opacity: 0.18 }");
    expect(overlay).toContain("{ backgroundColor: colors.brand, opacity: 0.07 }");

    const gateRingStyleStart = overlay.indexOf("gateRing:");
    const gateHaloInnerStyleStart = overlay.indexOf(
      "gateHaloInner:",
      gateRingStyleStart,
    );
    const gateHaloOuterStyleStart = overlay.indexOf(
      "gateHaloOuter:",
      gateHaloInnerStyleStart,
    );
    const gateRingStyle = overlay.slice(gateRingStyleStart, gateHaloInnerStyleStart);
    const gateHaloInnerStyle = overlay.slice(
      gateHaloInnerStyleStart,
      gateHaloOuterStyleStart,
    );
    const gateHaloOuterStyle = overlay.slice(
      gateHaloOuterStyleStart,
      overlay.indexOf("gateLabel:", gateHaloOuterStyleStart),
    );
    expect(gateRingStyle).toContain("height: 25");
    expect(gateRingStyle).toContain("width: 25");
    expect(gateRingStyle).toContain("borderWidth: 3");
    expect(gateHaloInnerStyle).toContain("height: 31");
    expect(gateHaloInnerStyle).toContain("width: 31");
    expect(gateHaloInnerStyle).toContain("borderWidth: 3");
    expect(gateHaloOuterStyle).toContain("height: 37");
    expect(gateHaloOuterStyle).toContain("width: 37");
    expect(gateHaloOuterStyle).toContain("borderWidth: 4");

    const orbStyleStart = overlay.indexOf("progressOrb:");
    const orbInnerStyleStart = overlay.indexOf("orbFalloffInner:", orbStyleStart);
    const orbOuterStyleStart = overlay.indexOf("orbFalloffOuter:", orbInnerStyleStart);
    const orbDirectionStyleStart = overlay.indexOf("orbDirection:", orbOuterStyleStart);
    const orbStyle = overlay.slice(orbStyleStart, orbInnerStyleStart);
    const orbInnerStyle = overlay.slice(orbInnerStyleStart, orbOuterStyleStart);
    const orbOuterStyle = overlay.slice(orbOuterStyleStart, orbDirectionStyleStart);
    expect(orbStyle).toContain("height: 24");
    expect(orbStyle).toContain("width: 24");
    expect(orbInnerStyle).toContain("height: 32");
    expect(orbInnerStyle).toContain("width: 32");
    expect(orbOuterStyle).toContain("height: 42");
    expect(orbOuterStyle).toContain("width: 42");
    expect(overlay).toContain("lastLiveKeypointsRef");
    expect(overlay).toContain("pulseSnapshot");
    expect(overlay).toContain("completionKeypoints");
    expect(overlay).toContain("duration: 80");
    expect(overlay).toContain("duration: 90");
    expect(overlay).toContain("duration: 330");
    expect(overlay).toContain("}, 470);");
    expect(overlay).toContain("opacity={0.28}");
    expect(overlay).toContain("opacity={0.22}");
    const completionRenderStart = overlay.indexOf("{!isStaticHold && completionKeypoints");
    expect(completionRenderStart).toBeGreaterThan(-1);
    const completionRenderEnd = overlay.indexOf(
      'testID="rep-gates-rep-complete"',
      completionRenderStart,
    );
    const completionRenderBlock = overlay.slice(completionRenderStart, completionRenderEnd);
    expect(completionRenderBlock).not.toContain("lowConfidence");
  });
});
