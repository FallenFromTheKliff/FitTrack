import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { Page } from "@playwright/test";
import { expect, test as base } from "./visual-fixtures";

// Read-only DTO snapshot plus synthetic authentication: no real credentials,
// database mutations, or physical camera are needed for this route check.
const test = base.extend({
  authenticatedPage: async ({ page }, use) => {
    await page.addInitScript(() => {
      localStorage.setItem("fittrack_access_token", "exercise-preview-fixture");
      localStorage.setItem("fittrack_refresh_token", "exercise-preview-fixture-refresh");
    });
    await use(page);
  },
});

test.use({ visualRole: "admin", visualViewport: "desktop-1920x1080" });
const fixture = JSON.parse(readFileSync(resolve("packages/utils/pose-camera-fixtures.json"), "utf8"));
const saved = JSON.parse(readFileSync(resolve(".artifacts/bench-close-view-saved.json"), "utf8"));
const start = fixture.benchRanges.full;
const extended = fixture.benchRanges.start;
function press(progress: number) {
  return start.map((p: number[], index: number) => ({
    x: p[0] + (extended[index][0] - p[0]) * progress,
    y: p[1] + (extended[index][1] - p[1]) * progress,
    z: p[2] + (extended[index][2] - p[2]) * progress,
    visibility: [11, 12, 13, 15].includes(index) ? .95 : .05,
  }));
}

const curlFixture = fixture.families.bicep_curl;
const curlContract = {
  ...curlFixture.contract,
  countAt: "return",
  spatialRequirements: { ...curlFixture.contract.spatialRequirements, bodyLineScope: "torso" },
};
const curlProfile = {
  schemaVersion: "exercise_movement_profile_v1",
  movementContract: curlContract,
  rig: null,
  warnings: [],
};
const curlExercise = {
  ...saved,
  id: "curl-preview-fixture",
  name: "Dumbbell Biceps Curl",
  aliases: [],
  movement_family: null,
  movement_profile: curlProfile,
  movement_profile_override: curlProfile,
  movement_contract_identity: {
    exerciseId: "curl-preview-fixture", familyKey: "bicep_curl", revision: 1,
    source: "exercise_override", trackingMode: "override",
  },
  hand_shape_profile: null,
};
function curl(progress: number, wristVisible = true) {
  return curlFixture.start.map((point: number[], index: number) => ({
    x: point[0] + (curlFixture.peak[index][0] - point[0]) * progress,
    y: point[1] + (curlFixture.peak[index][1] - point[1]) * progress,
    z: point[2] + (curlFixture.peak[index][2] - point[2]) * progress,
    visibility: !wristVisible && index === 15 ? .05 : point[3],
  }));
}

async function sendPose(page: Page, points: ReturnType<typeof curl> | null) {
  const calls = await page.evaluate(points => {
    (window as any).__poseResult = { landmarks: points ? [points] : [] };
    return (window as any).__detectorCalls;
  }, points);
  await expect.poll(() => page.evaluate(() => (window as any).__detectorCalls)).toBeGreaterThan(calls + 2);
}

async function prepareSyntheticPreview(page: Page, exercise = saved) {
  // Fail closed: this test cannot write catalog definitions or call a physical
  // camera. The stream below is a generated canvas, with a stubbed detector.
  const unexpectedWrites: string[] = [];
  await page.route(/\/v1\//, async route => {
    const headers = {"access-control-allow-origin": new URL(page.url() === "about:blank" ? "http://localhost:8080" : page.url()).origin,
      "access-control-allow-credentials": "true", "access-control-allow-headers": "Authorization,Content-Type"};
    if (route.request().method() === "OPTIONS") { await route.fulfill({status:204,headers}); return; }
    if (["POST", "PATCH", "PUT", "DELETE"].includes(route.request().method())) {
      unexpectedWrites.push(route.request().url());
      await route.abort("blockedbyclient");
      return;
    }
    const path = new URL(route.request().url()).pathname;
    let data: unknown = [];
    if (path === "/v1/users/me") data = {id:"preview-admin",email:"preview@fittrack.test",role:"ADMIN",status:"active",email_verified:true,
      has_accepted_privacy:true,profile:{first_name:"Preview",last_name:"Admin",activity_level:"active",fitness_goal:"maintenance"}};
    else if (path === "/v1/fitness/exercises") data = [exercise];
    else if (path.startsWith("/v1/fitness/exercises/")) data = exercise;
    else if (path === "/v1/notifications/unread-count") data = {count:0,unread_count:0};
    await route.fulfill({headers,contentType:"application/json",body:JSON.stringify({data,meta:{total:1,page:1,limit:8,totalPages:1}})});
  });
  await page.addInitScript(() => {
    const host = window as any;
    host.__syntheticCameraRequests = 0;
    host.__detectorCalls = 0;
    host.__poseResult = { landmarks: [] };
    navigator.mediaDevices.getUserMedia = async () => {
      host.__syntheticCameraRequests++;
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = 640;
      const context = canvas.getContext("2d")!;
      let frame = 0;
      const paint = () => {
        context.fillStyle = frame++ % 2 ? "#222" : "#333";
        context.fillRect(0, 0, 640, 640);
      };
      paint();
      const interval = setInterval(paint, 30);
      const stream = canvas.captureStream(30);
      for (const track of stream.getTracks()) {
        const stop = track.stop.bind(track);
        track.stop = () => { clearInterval(interval); stop(); };
      }
      return stream;
    };
  });
  await page.route("**/vendor/mediapipe/tasks-vision/vision_bundle.mjs*", route => route.fulfill({
    contentType: "application/javascript",
    body: `export const FilesetResolver={forVisionTasks:async()=>({})};
      export const PoseLandmarker={createFromOptions:async(_,options)=>{
        window.__poseOptions=options;
        return {close(){},detectForVideo(){window.__detectorCalls++;return window.__poseResult;}};
      }};`,
  }));
  return unexpectedWrites;
}

test("standalone settings save and reopen; shared tracking without a family is caught before Save", async ({ authenticatedPage: page }) => {
  const exercise = { ...curlExercise, tracking_mode: "inherit", movement_family_id: null,
    movement_contract_identity: { exerciseId: curlExercise.id, familyKey: null, revision: null,
      source: "family", trackingMode: "inherit" } };
  const unexpectedWrites = await prepareSyntheticPreview(page, exercise);
  const saves: any[] = [];
  // Only this fixture endpoint accepts writes, entirely in memory. All other
  // mutations remain blocked by prepareSyntheticPreview.
  await page.route(`**/v1/fitness/exercises/${exercise.id}`, async route => {
    if (route.request().method() !== "PATCH") { await route.fallback(); return; }
    const payload = route.request().postDataJSON();
    saves.push(payload);
    Object.assign(exercise, payload, { movement_profile: payload.movement_profile_override,
      movement_contract_identity: { exerciseId: exercise.id, familyKey: null, revision: null,
        source: "exercise_override", trackingMode: payload.tracking_mode } });
    await route.fulfill({ contentType: "application/json",
      headers: { "access-control-allow-origin": new URL(page.url()).origin, "access-control-allow-credentials": "true" },
      body: JSON.stringify({data: exercise}) });
  });
  await page.goto("/exercise-lab?tab=library");
  await page.getByRole("button", {name: "Edit Dumbbell Biceps Curl", exact: true}).click();
  const editor = page.getByTestId("exercise-lab-workbench");
  const go = (name: string) => editor.getByRole("button", {name, exact: true}).click();
  await go("Review & Publish");
  await expect(editor).toContainText("3/4 ready");
  await expect(editor).toContainText("This exercise has no shared movement settings");
  await expect(editor.getByRole("button", {name: "Save global exercise", exact: true})).toBeDisabled();
  expect(saves).toHaveLength(0);
  await editor.getByRole("button", {name: /^Fix This exercise has no shared movement settings/}).click();
  await expect(editor.getByRole("button", {name: "Inherit shared tracking", exact: true})).toBeDisabled();
  await go("Override this exercise");
  await go("Review & Publish");
  await expect(editor).toContainText("4/4 ready");
  await go("Save global exercise");
  await expect(page.getByText("Dumbbell Biceps Curl was updated.", {exact: true})).toBeVisible();
  expect(saves).toHaveLength(1);
  expect(saves[0]).toMatchObject({tracking_mode: "override", movement_family_id: null,
    movement_profile_override: { movementContract: {exercise: "bicep_curl", countAt: "return"} } });
  expect(saves[0].movement_profile_override.rig.keyframes).toHaveLength(3);
  await page.getByRole("button", {name: "OK", exact: true}).click();
  await page.getByRole("button", {name: "Edit Dumbbell Biceps Curl", exact: true}).click();
  await go("Tracking Choice");
  await expect(editor.getByRole("button", {name: "Override this exercise", exact: true})).toHaveAttribute("aria-pressed", "true");
  await go("Review & Publish");
  await expect(editor).toContainText("4/4 ready");
  expect(unexpectedWrites).toEqual([]);
  expect(await page.evaluate(() => (window as any).__syntheticCameraRequests)).toBe(0);
});

test("manual lat pulldown can be authored, edited and counted from an unsaved draft; blank drawings can measure other joints", async ({ authenticatedPage: page }, testInfo) => {
  test.setTimeout(150_000);
  const lat = { ...curlExercise, id: "lat-preview-fixture", name: "Lat Pulldown",
    tracking_mode: "manual", movement_profile: null, movement_profile_override: null,
    movement_family: null, movement_contract_identity: null };
  const unexpectedWrites = await prepareSyntheticPreview(page, lat);
  await page.goto("/exercise-lab?tab=library");
  await page.getByRole("button", { name: "Edit Lat Pulldown", exact: true }).click();
  const editor = page.getByTestId("exercise-lab-workbench");
  const go = (name: string) => editor.getByRole("button", { name, exact: true }).click();
  const step = (name: string) => editor.getByRole("button", { name: new RegExp(`\\d\\.\\s*${name}`) }).click();
  const select = async (name: string, value: string) => {
    await editor.locator(`input[name="${name}"]`).locator("..").getByRole("button").click();
    await page.getByRole("menuitem", { name: value, exact: true }).click();
  };
  const goal = editor.locator('input[data-exercise-field="movementProfile.movementContract.repThresholds.down.angle"]');
  const startAngle = editor.locator('input[data-exercise-field="movementProfile.movementContract.repThresholds.up.angle"]');
  await go("Tracking Choice");
  await editor.getByRole("button", { name: /Override this exercise/ }).click();
  await go("Movement Builder");
  await step("Template");
  await go("Lat pulldown");
  await go("Rebuild drawing");
  await page.getByRole("button", { name: "RESET RIG", exact: true }).click();
  await step("Counting rules");
  await expect(editor.locator('input[name="exercise-measured-joint"]')).toHaveValue("upper_arm");
  await expect(goal).toHaveValue("90");
  await expect(startAngle).toHaveValue("155");
  // An existing hip-based shoulder draft can switch references without being
  // recreated. The corrected definition must also work with an edited goal.
  await select("exercise-measured-joint", "Shoulder — arm angle using hips");
  await select("exercise-measured-joint", "Upper arm — shoulders and elbows only");
  await goal.fill("88");
  await expect(editor).toContainText("Allowed difference from goal");
  await select("exercise-count-at", "At the movement goal (Peak)");
  await step("Form checks");
  await expect(editor.locator('input[name="exercise-spatial-preset"]')).toHaveValue("lat_pulldown");
  await expect(editor).toContainText("Only both shoulders and the moving elbows need to be visible. Hips are not used.");
  await step("Movement positions");
  await go("Movement goal");
  await expect(editor).toContainText("Measuring: Upper arm — shoulders and elbows only");
  await page.screenshot({ path: testInfo.outputPath("pulldown-goal-drawing.png") });

  const armPose = (angle: number, elbowAngle = 90 + (angle - 90) * 75 / 65) => {
    const points = Array.from({ length: 33 }, () => ({ x: .5, y: .5, z: 0, visibility: .05 }));
    for (const offset of [0, 1]) {
      const sign = offset ? 1 : -1;
      const shoulder = { x: .5 + sign * .14, y: .42, z: 0, visibility: .98 };
      const elbow = { ...shoulder, x: shoulder.x + sign * .16 * Math.sin(angle * Math.PI / 180), y: shoulder.y + .16 * Math.cos(angle * Math.PI / 180) };
      const direction = Math.atan2(shoulder.y - elbow.y, shoulder.x - elbow.x) + sign * elbowAngle * Math.PI / 180;
      points[11 + offset] = shoulder;
      points[13 + offset] = elbow;
      points[15 + offset] = { ...elbow, x: elbow.x + .18 * Math.cos(direction), y: elbow.y + .18 * Math.sin(direction), visibility: .05 };
      points[23 + offset] = { ...shoulder, y: .71, visibility: .05 };
    }
    return points;
  };
  const send = (angle: number, elbowAngle?: number) => sendPose(page, armPose(angle, elbowAngle));
  const count = editor.locator('[data-camera-counter="valid"]');
  await go("Review & Publish");
  await expect(editor).toContainText("Definition check passed");
  await go("Start camera");
  for (const elbow of [165, 145, 125, 100, 80, 165]) await send(155, elbow);
  await expect(count).toHaveText(/0\s*Valid/);
  for (const angle of [155, 145, 130, 115, 90, 60]) await send(angle);
  await expect(count).toHaveText(/1\s*Valid/);
  await send(60);
  await expect(count).toHaveText(/1\s*Valid/);
  await go("Stop camera");

  await go("Movement Builder");
  await step("Counting rules");
  await goal.fill("60");
  await expect(startAngle).toHaveValue("155");
  await go("Review & Publish");
  await go("Start camera");
  for (const angle of [155, 145, 130, 115, 90]) await send(angle);
  await expect(count).toHaveText(/0\s*Valid/);
  for (const angle of [80, 70, 60]) await send(angle);
  await expect(count).toHaveText(/1\s*Valid/);
  await go("Stop camera");

  await go("Movement Builder");
  await step("Template");
  await go("Blank drawing");
  await go("Rebuild drawing");
  await page.getByRole("button", { name: "RESET RIG", exact: true }).click();
  await go("Review & Publish");
  await expect(editor).toContainText("Definition check passed");
  await go("Movement Builder");
  await step("Counting rules");
  await select("exercise-measured-joint", "Knee — leg bend");
  await goal.fill("90");
  await startAngle.fill("155");
  await expect(editor.locator('input[name="exercise-measured-joint"]')).toHaveValue("knee");
  await go("Review & Publish");
  await expect(editor).toContainText("Definition check passed");
  expect(unexpectedWrites).toEqual([]);
});

test("editor preview counts cropped movement through the web adapter and applies draft edits", async ({ authenticatedPage: page }, testInfo) => {
  test.setTimeout(120_000);
  const unexpectedWrites = await prepareSyntheticPreview(page);
  await page.goto("/exercise-lab?tab=library");
  await page.getByRole("textbox", { name: "Search global exercises" }).fill("Barbell Bench");
  await page.getByRole("button", { name: /^Edit Barbell Bench Press/ }).click();
  const editor = page.getByTestId("exercise-lab-workbench");
  const go = (name: string) => editor.getByRole("button", { name, exact: true }).click();
  await go("Review & Publish");
  const count = editor.locator('[data-camera-counter="valid"]');
  await expect(count).toContainText("0");
  await expect.poll(() => page.evaluate(() => (window as any).__syntheticCameraRequests)).toBe(0);
  await editor.getByRole("button", { name: "Start camera", exact: true }).click();
  await expect.poll(() => page.evaluate(() => (window as any).__poseOptions?.numPoses)).toBe(1);
  const send = async (progress: number) => {
    const calls = await page.evaluate(points => {
      (window as any).__poseResult = { landmarks: [points] };
      return (window as any).__detectorCalls;
    }, press(progress));
    await expect.poll(() => page.evaluate(() => (window as any).__detectorCalls)).toBeGreaterThan(calls + 2);
  };
  for (const progress of [0, .2, .4, .6, 1]) await send(progress);
  await expect(count).toHaveText(/1\s*Valid/);
  await editor.getByRole("button", { name: "Pause tracking", exact: true }).click();
  await expect(count).toHaveText(/1\s*Valid/);
  await editor.getByRole("button", { name: "Resume tracking", exact: true }).click();
  await send(1);
  await expect(count).toHaveText(/1\s*Valid/);
  for (const progress of [0, .2, .4, .6, 1]) await send(progress);
  await expect(count).toHaveText(/2\s*Valid/);
  await editor.getByRole("button", { name: "Reset test", exact: true }).click();
  await expect(count).toHaveText(/0\s*Valid/);
  await editor.getByRole("button", { name: "Stop camera", exact: true }).click();

  await go("Movement Builder");
  await editor.getByRole("button", { name: /5\.\s*Form checks/ }).click();
  const posture = editor.getByRole("button", {name: "Select: Any position", exact:true});
  await expect(posture).toBeVisible();
  await posture.click();
  await page.getByRole("menuitem", {name: "Lying down", exact:true}).click();
  await go("Review & Publish");
  await editor.getByRole("button", { name: "Start camera", exact: true }).click();
  for (const progress of [0, .6, 1]) await send(progress);
  await expect(count).toHaveText(/0\s*Valid/);
  await expect(editor).toContainText(/Check.*hip/i);
  await editor.getByRole("button", { name: "Stop camera", exact: true }).click();

  await go("Movement Builder");
  await editor.getByRole("button", { name: /5\.\s*Form checks/ }).click();
  await editor.getByRole("button", {name: "Select: Lying down", exact:true}).click();
  await page.getByRole("menuitem", {name: "Any position", exact:true}).click();
  await editor.getByRole("button", { name: /4\.\s*Counting rules/ }).click();
  const target = editor.locator('input[data-exercise-field="movementProfile.movementContract.repThresholds.down.angle"]');
  const initialTarget = await target.inputValue();
  await target.fill("135");
  await expect(editor.locator('input[data-exercise-field="movementProfile.movementContract.repThresholds.up.angle"]')).toHaveValue("90");
  await go("Review & Publish");
  await expect(count).toHaveText(/0\s*Valid/);
  await editor.getByRole("button", { name: "Start camera", exact: true }).click();
  for (const progress of [0, .2, .4]) await send(progress);
  await expect(count).toHaveText(/0\s*Valid/);
  for (const progress of [.8, 1]) await send(progress);
  await expect(count).toHaveText(/1\s*Valid/);
  await editor.getByRole("button", { name: "Stop camera", exact: true }).click();
  await go("Movement Builder");
  await editor.getByRole("button", { name: /4\.\s*Counting rules/ }).click();
  await expect(target).toHaveValue("135");
  await target.fill(initialTarget);
  // The count phase changes timing, without changing either angle or allowing
  // a target hold to produce repeated reps. Exercise data is never saved here.
  await editor.getByRole("button", { name: "Select: At the movement goal (Peak)", exact: true }).click();
  await page.getByRole("menuitem", { name: "After returning to start", exact: true }).click();
  await expect(editor.locator('input[name="exercise-count-at"]')).toHaveValue("return");
  await expect(target).toHaveValue(initialTarget);
  await expect(editor.locator('input[data-exercise-field="movementProfile.movementContract.repThresholds.up.angle"]')).toHaveValue("90");
  await go("Review & Publish");
  await editor.getByRole("button", { name: "Start camera", exact: true }).click();
  for (const progress of [0, .2, .4, .6, 1]) await send(progress);
  await expect(count).toHaveText(/0\s*Valid/);
  await send(1);
  await expect(count).toHaveText(/0\s*Valid/);
  for (const progress of [.8, .6, .4, .2, 0]) await send(progress);
  await expect(count).toHaveText(/1\s*Valid/);
  await editor.getByRole("button", { name: "Stop camera", exact: true }).click();
  await go("Movement Builder");
  await editor.getByRole("button", { name: /4\.\s*Counting rules/ }).click();
  await editor.getByRole("button", { name: "Select: After returning to start", exact: true }).click();
  await page.getByRole("menuitem", { name: "At the movement goal (Peak)", exact: true }).click();
  await go("Review & Publish");
  await editor.getByRole("button", { name: "Start camera", exact: true }).click();
  for (const progress of [0, .2, .4, .6, 1]) await send(progress);
  await expect(count).toHaveText(/1\s*Valid/);
  await send(1);
  await expect(count).toHaveText(/1\s*Valid/);
  await editor.getByRole("button", { name: "Stop camera", exact: true }).click();
  await go("Movement Builder");
  await editor.getByRole("button", { name: /4\.\s*Counting rules/ }).click();
  await page.evaluate(() => document.fonts.ready);
  await editor.screenshot({ path: testInfo.outputPath("start-target-editor.png") });
  expect(unexpectedWrites).toEqual([]);
  // Close the page without saving: existing exercise and family data stay intact.
});

test("a low-confidence wrist keeps the detected curl visible but invalidates the unfinished rep", async ({ authenticatedPage: page }) => {
  test.setTimeout(120_000);
  const unexpectedWrites = await prepareSyntheticPreview(page, curlExercise);
  const decisions: any[] = [];
  page.on("console", message => {
    if (!message.text().startsWith("[FitTrack pose:exercise-lab]")) return;
    const payload = message.text().slice(message.text().indexOf("{"));
    try { decisions.push(JSON.parse(payload)); } catch { /* Other console output is not pose evidence. */ }
  });
  await page.goto("/exercise-lab?tab=library");
  await page.getByRole("button", { name: "Edit Dumbbell Biceps Curl", exact: true }).click();
  const editor = page.getByTestId("exercise-lab-workbench");
  await editor.getByRole("button", { name: "Review & Publish", exact: true }).click();
  await editor.getByRole("button", { name: "Start camera", exact: true }).click();
  const overlay = editor.getByTestId("exercise-lab-camera-rig-overlay");
  const count = editor.locator('[data-camera-counter="valid"]');
  const send = (progress: number, wristVisible = true) => sendPose(page, curl(progress, wristVisible));
  for (const progress of [0, .25, .5, .75, 1]) await send(progress);
  await expect(count).toHaveText(/0\s*Valid/);
  await expect(overlay).toBeVisible();
  for (const progress of [.75, .5, .25, 0]) await send(progress);
  await expect(count).toHaveText(/1\s*Valid/);

  for (const progress of [.25, .5, .75, 1]) await send(progress);
  await send(1, false);
  await expect(overlay).toBeVisible();
  await expect(overlay.locator("line")).not.toHaveCount(0);
  await expect(count).toHaveText(/1\s*Valid/);
  await expect.poll(() => decisions.some(decision =>
    decision.reason === "required_landmarks_unreliable" &&
    decision.visibility?.lowConfidenceLandmarks?.includes("left_wrist") &&
    decision.angles !== null,
  )).toBe(true);
  // Recovering at the goal cannot complete the rep whose evidence was lost.
  for (const progress of [1, .75, .5, .25, 0]) await send(progress);
  await expect(count).toHaveText(/1\s*Valid/);
  for (const progress of [.25, .5, .75, 1, .75, .5, .25, 0]) await send(progress);
  await expect(count).toHaveText(/2\s*Valid/);
  // A true loss of the pose still removes the overlay; we never display old evidence.
  await sendPose(page, null);
  await expect(overlay).toHaveCount(0);
  await expect(count).toHaveText(/2\s*Valid/);
  await editor.getByRole("button", { name: "Stop camera", exact: true }).click();
  expect(unexpectedWrites).toEqual([]);
});

test("movement help works on hover, keyboard and tap without changing settings or closing the editor", async ({ authenticatedPage: page }, testInfo) => {
  test.setTimeout(120_000);
  const unexpectedWrites = await prepareSyntheticPreview(page, curlExercise);
  await page.goto("/exercise-lab?tab=library");
  await page.getByRole("button", { name: "Edit Dumbbell Biceps Curl", exact: true }).click();
  const editor = page.getByTestId("exercise-lab-workbench");
  await editor.getByRole("button", { name: "Movement Builder", exact: true }).click();
  const tooltip = page.getByRole("tooltip");
  const checkAllHelp = async () => {
    const helpButtons = editor.getByRole("button", { name: / help$/ });
    expect(await helpButtons.count()).toBeGreaterThan(0);
    for (const help of await helpButtons.all()) {
      await help.hover();
      await expect(tooltip).toBeVisible();
      expect((await tooltip.innerText()).length).toBeGreaterThan(30);
      await page.keyboard.press("Escape");
      await expect(tooltip).toHaveCount(0);
      await expect(editor).toBeVisible();
    }
  };
  await editor.getByRole("button", { name: /3\.\s*Movement positions/ }).click();
  await editor.locator("summary", { hasText: "Joint details" }).click();
  await checkAllHelp();
  await editor.getByRole("button", { name: /4\.\s*Counting rules/ }).click();
  const angle = editor.locator('input[data-exercise-field="movementProfile.movementContract.repThresholds.down.angle"]');
  await expect(angle).toHaveValue("90");
  await checkAllHelp();
  const goalHelp = editor.getByRole("button", { name: "Goal angle help", exact: true });
  await goalHelp.focus();
  await expect(tooltip).toContainText("Going farther in the movement direction still qualifies");
  await page.keyboard.press("Escape");
  await expect(goalHelp).toBeFocused();
  await expect(editor).toBeVisible();
  const timingHelp = editor.getByRole("button", { name: "When to add a rep help", exact: true });
  await timingHelp.click();
  await expect(tooltip).toContainText("Holding at the goal will not add extra reps");
  await page.mouse.move(0, 0);
  await expect(tooltip).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(angle).toHaveValue("90");
  await expect(editor.locator('input[name="exercise-count-at"]')).toHaveValue("return");

  await editor.getByRole("button", { name: /5\.\s*Form checks/ }).click();
  await editor.locator("summary", { hasText: "Fine-tune form checks" }).click();
  await checkAllHelp();
  await page.setViewportSize({ width: 390, height: 844 });
  const bodyHelp = editor.getByRole("button", { name: "Body parts to check help", exact: true });
  await bodyHelp.click();
  await expect(tooltip).toBeVisible();
  const bounds = await tooltip.boundingBox();
  expect(bounds).not.toBeNull();
  expect(bounds!.x).toBeGreaterThanOrEqual(0);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(390);
  expect(bounds!.y).toBeGreaterThanOrEqual(0);
  expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(844);
  await page.screenshot({ path: testInfo.outputPath("movement-help-narrow.png") });
  await page.keyboard.press("Escape");
  await page.setViewportSize({ width: 1920, height: 1080 });
  await editor.getByRole("button", { name: /4\.\s*Counting rules/ }).click();
  await goalHelp.hover();
  await page.screenshot({ path: testInfo.outputPath("movement-help-wide.png") });
  await expect.poll(() => page.evaluate(() => (window as any).__syntheticCameraRequests)).toBe(0);
  expect(unexpectedWrites).toEqual([]);
});

test("canonical curl angle fields change the unsaved camera rules and need only configured joints", async ({ authenticatedPage: page }, testInfo) => {
  test.setTimeout(120_000);
  const canonicalCurl = {
    ...curlExercise,
    tracking_mode: "inherit",
    movement_profile_override: null,
    movement_family: {
      id: "curl-family-fixture", key: "bicep_curl", display_name: "Biceps Curl",
      canonical_exercise_id: curlExercise.id, contract_revision: 1,
      inheriting_exercise_ids: [],
    },
    movement_contract_identity: {
      ...curlExercise.movement_contract_identity,
      source: "movement_family", trackingMode: "inherit",
    },
  };
  const unexpectedWrites = await prepareSyntheticPreview(page, canonicalCurl);
  const decisions: any[] = [];
  page.on("console", message => {
    if (!message.text().startsWith("[FitTrack pose:exercise-lab]")) return;
    try { decisions.push(JSON.parse(message.text().slice(message.text().indexOf("{")))); }
    catch { /* Ignore unrelated console messages. */ }
  });
  await page.goto("/exercise-lab?tab=library");
  await page.getByRole("button", { name: "Edit Dumbbell Biceps Curl", exact: true }).click();
  const editor = page.getByTestId("exercise-lab-workbench");
  const go = (name: string) => editor.getByRole("button", { name, exact: true }).click();
  const goal = editor.locator('input[data-exercise-field="movementProfile.movementContract.repThresholds.down.angle"]');
  const starting = editor.locator('input[data-exercise-field="movementProfile.movementContract.repThresholds.up.angle"]');
  await go("Movement Builder");
  await expect(editor.getByTestId("exercise-lab-movement-editor")).toHaveAttribute("data-movement-editor-readonly", "false");
  await editor.getByRole("button", { name: /3\.\s*Movement positions/ }).click();
  await expect(goal).toHaveValue("90");
  await expect(starting).toHaveValue("155");
  await goal.fill("120");
  await starting.fill("160");
  await editor.getByRole("button", { name: "Goal angle increase", exact: true }).click();
  await expect(goal).toHaveValue("121");
  await editor.getByRole("button", { name: "Goal angle decrease", exact: true }).click();
  await editor.getByRole("button", { name: /4\.\s*Counting rules/ }).click();
  await expect(goal).toHaveValue("120");
  await expect(starting).toHaveValue("160");
  await editor.getByRole("button", { name: "Select: After returning to start", exact: true }).click();
  await page.getByRole("menuitem", { name: "At the movement goal (Peak)", exact: true }).click();

  const send = (progress: number, includeHips = true) => sendPose(page, curl(progress).map((point: any, index: number) => ({
    ...point, visibility: [11, 12, 13, 14, 15, 16, ...(includeHips ? [23, 24] : [])].includes(index) ? .95 : .05,
  })));
  const count = editor.locator('[data-camera-counter="valid"]');
  await go("Review & Publish");
  await go("Start camera");
  // This movement stops around 123 degrees: enough for the edited goal of
  // 120 + 15 degrees leeway, but not the original 90 + 15 degree goal.
  for (const progress of [0, .1, .2, .3, .4, .5]) await send(progress);
  await expect(count).toHaveText(/1\s*Valid/);
  await expect.poll(() => decisions.some(decision =>
    decision.configuredTargets?.down.angle === 120 &&
    decision.configuredTargets?.up.angle === 160 &&
    decision.rules?.countAt === "peak" &&
    decision.visibility?.isReliable === true &&
    decision.visibility?.reliableLandmarkCount === 8,
  )).toBe(true);
  await go("Stop camera");

  await go("Movement Builder");
  await editor.getByRole("button", { name: /3\.\s*Movement positions/ }).click();
  await goal.fill("90");
  await expect(starting).toHaveValue("160");
  await go("Review & Publish");
  await go("Start camera");
  for (const progress of [0, .1, .2, .3, .4, .5]) await send(progress);
  await expect(count).toHaveText(/0\s*Valid/);
  await expect.poll(() => decisions.some(decision =>
    decision.configuredTargets?.down.angle === 90 &&
    decision.configuredTargets?.up.angle === 160 &&
    decision.rules?.countAt === "peak",
  )).toBe(true);
  for (const progress of [.75, 1]) await send(progress);
  await expect(count).toHaveText(/1\s*Valid/);
  await go("Stop camera");

  await go("Movement Builder");
  await editor.getByRole("button", { name: /5\.\s*Form checks/ }).click();
  await editor.getByRole("button", { name: "Select: Upper body — shoulders and hips", exact: true }).click();
  await page.getByRole("menuitem", { name: "Movement joints only", exact: true }).click();
  await expect(editor.getByRole("button", { name: "Select: Any position", exact: true })).toBeVisible();
  await expect(editor.getByRole("button", { name: "Select: None", exact: true })).toBeVisible();
  await editor.getByRole("button", { name: "Body parts to check help", exact: true }).hover();
  await expect(page.getByRole("tooltip")).toContainText("A curl needs shoulders, elbows and wrists");
  await page.keyboard.press("Escape");
  await editor.screenshot({ path: testInfo.outputPath("movement-joints-only.png") });
  await go("Review & Publish");
  await go("Start camera");
  for (const progress of [0, .2, .4, .6, 1]) await send(progress, false);
  await expect(count).toHaveText(/1\s*Valid/);
  await expect.poll(() => decisions.some(decision =>
    decision.configuredTargets?.down.angle === 90 &&
    decision.configuredTargets?.up.angle === 160 &&
    decision.rules?.countAt === "peak" &&
    decision.visibility?.isReliable === true &&
    decision.visibility?.reliableLandmarkCount === 6 &&
    decision.posture?.orientation === "any",
  )).toBe(true);
  await go("Stop camera");
  await go("Movement Builder");
  await editor.getByRole("button", { name: /5\.\s*Form checks/ }).click();
  await expect(editor.getByRole("button", { name: "Select: Movement joints only", exact: true })).toBeVisible();
  await expect(editor.getByRole("button", { name: "Select: None", exact: true })).toBeVisible();
  await editor.getByRole("button", { name: "Select: Movement joints only", exact: true }).click();
  await page.getByRole("menuitem", { name: "Full body — shoulders, hips and ankles", exact: true }).click();
  await go("Review & Publish");
  await go("Start camera");
  for (const progress of [0, .5, 1]) await send(progress, false);
  await expect(count).toHaveText(/0\s*Valid/);
  await expect.poll(() => decisions.some(decision =>
    decision.visibility?.lowConfidenceLandmarks?.includes("left_hip") &&
    decision.visibility?.lowConfidenceLandmarks?.includes("left_ankle"),
  )).toBe(true);
  await go("Stop camera");
  expect(unexpectedWrites).toEqual([]);
});
