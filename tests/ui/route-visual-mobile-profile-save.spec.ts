import {
  expect,
  test,
  type Locator,
  type Page,
  type Route,
  type TestInfo,
} from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import {
  auditConventionalLayout,
  stabilizeVisualPage,
  type VisualLayoutAudit,
} from "./visual-stabilizer";

const MOBILE_BASE_URL =
  process.env.PLAYWRIGHT_MOBILE_BASE_URL ?? "http://127.0.0.1:8081";
const ACCESS_TOKEN = "profile-save-fixture-access-token";
const REFRESH_TOKEN = "profile-save-fixture-refresh-token";
const MEMBER_ID = "profile-save-fixture-member";
const INITIAL_FIRST_NAME = "Luca";
const INITIAL_LAST_NAME = "Dela Cruz";
const INITIAL_PHONE = "+639171234567";
const INITIAL_DATE_OF_BIRTH = "1994-05-20";
const INITIAL_WEIGHT = 68;
const INITIAL_HEIGHT = 172;

type PatchMode = "success" | "held" | "error-once";
const EXPECTED_SERVER_ERROR_CONSOLE =
  "Failed to load resource: the server responded with a status of 500 (Internal Server Error)";

type ProfileRecord = {
  email: string;
  email_verified: boolean;
  has_accepted_privacy: boolean;
  id: string;
  membership_card: null;
  phone_no: string;
  profile: {
    date_of_birth: string;
    first_name: string;
    gender: "female";
    height_cm: number;
    last_name: string;
    weight_kg: number;
    avatar_url: null;
  };
  role: "USER";
  status: "active";
};

type MutationRecord = {
  body: Record<string, unknown>;
  method: string;
  path: string;
};

type ProfileFixtureState = {
  consoleErrors: string[];
  failedPatchRequests: MutationRecord[];
  fixtureMode: PatchMode;
  patchMode: PatchMode;
  patchRequests: MutationRecord[];
  profile: ProfileRecord;
  releaseHeldPatch?: () => void;
  heldPatchStarted: boolean;
  observedRequests: string[];
  requestFailures: string[];
  unhandled: string[];
};

type Rect = {
  height: number;
  width: number;
  x: number;
  y: number;
};

type SurfaceSample = {
  anchor: Rect | null;
  dialog: Rect | null;
  opacity: number;
};

function newProfile(): ProfileRecord {
  return {
    email: "profile-save-member@fittrack.test",
    email_verified: true,
    has_accepted_privacy: true,
    id: MEMBER_ID,
    membership_card: null,
    phone_no: INITIAL_PHONE,
    profile: {
      date_of_birth: INITIAL_DATE_OF_BIRTH,
      first_name: INITIAL_FIRST_NAME,
      gender: "female",
      height_cm: INITIAL_HEIGHT,
      last_name: INITIAL_LAST_NAME,
      weight_kg: INITIAL_WEIGHT,
      avatar_url: null,
    },
    role: "USER",
    status: "active",
  };
}

function newFixtureState(patchMode: PatchMode): ProfileFixtureState {
  return {
    consoleErrors: [],
    failedPatchRequests: [],
    fixtureMode: patchMode,
    heldPatchStarted: false,
    observedRequests: [],
    patchMode,
    patchRequests: [],
    profile: newProfile(),
    requestFailures: [],
    unhandled: [],
  };
}

function apiResponse(data: unknown) {
  return JSON.stringify({ data });
}

async function fulfill(route: Route, data: unknown, status = 200) {
  await route.fulfill({
    body: apiResponse(data),
    contentType: "application/json",
    status,
  });
}

async function fulfillPaginated(route: Route, data: unknown[]) {
  await route.fulfill({
    body: JSON.stringify({
      data,
      meta: {
        limit: 100,
        page: 1,
        total: data.length,
        total_pages: data.length ? 1 : 0,
      },
    }),
    contentType: "application/json",
    status: 200,
  });
}

function parseBody(route: Route): Record<string, unknown> {
  try {
    const body = route.request().postDataJSON();
    return body && typeof body === "object" && !Array.isArray(body)
      ? (body as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

function applyProfilePatch(state: ProfileFixtureState, body: Record<string, unknown>) {
  if (typeof body.first_name === "string") {
    state.profile.profile.first_name = body.first_name;
  }
  if (typeof body.last_name === "string") {
    state.profile.profile.last_name = body.last_name;
  }
  if (typeof body.date_of_birth === "string") {
    state.profile.profile.date_of_birth = body.date_of_birth;
  }
  if (body.gender === "female") {
    state.profile.profile.gender = body.gender;
  }
  if (typeof body.weight_kg === "number") {
    state.profile.profile.weight_kg = body.weight_kg;
  }
  if (typeof body.height_cm === "number") {
    state.profile.profile.height_cm = body.height_cm;
  }
  if (typeof body.avatar_url === "string") {
    state.profile.profile.avatar_url = null;
  }
}

async function installProfileFixtures(
  page: Page,
  state: ProfileFixtureState,
) {
  page.on("console", (message) => {
    if (message.type() === "error") state.consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => state.consoleErrors.push(error.message));
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.pathname.startsWith("/v1/")) {
      state.observedRequests.push(
        `${request.method()} ${url.pathname}${url.search}`,
      );
    }
  });
  page.on("requestfailed", (request) => {
    const url = new URL(request.url());
    if (url.pathname.startsWith("/v1/")) {
      state.requestFailures.push(
        `${request.method()} ${url.pathname}${url.search}: ${request.failure()?.errorText ?? "unknown"}`,
      );
    }
  });

  await page.addInitScript(
    ({ accessToken, refreshToken }) => {
      window.localStorage.setItem("fittrack_access_token", accessToken);
      window.localStorage.setItem("fittrack_refresh_token", refreshToken);
    },
    { accessToken: ACCESS_TOKEN, refreshToken: REFRESH_TOKEN },
  );

  await page.route("**/v1/**", async (route) => {
    const request = route.request();
    const method = request.method();
    const url = new URL(request.url());
    const path = url.pathname;

    if (method === "OPTIONS" && path === "/v1/users/me") {
      await route.fulfill({
        headers: {
          "access-control-allow-headers": "Authorization, Content-Type",
          "access-control-allow-methods": "GET, PATCH, OPTIONS",
          "access-control-allow-origin": request.headers().origin ?? "*",
        },
        status: 204,
      });
      return;
    }

    if (method === "GET") {
      if (path === "/v1/users/me") {
        await fulfill(route, state.profile);
        return;
      }
      if (path === "/v1/users/deletion-request") {
        await fulfill(route, { status: null });
        return;
      }
      if (path === "/v1/notifications/unread-count") {
        await fulfill(route, { count: 0 });
        return;
      }
      if (path === "/v1/notifications/my") {
        await fulfillPaginated(route, []);
        return;
      }
      if (path === "/v1/membership/catalog-settings") {
        await fulfill(route, {
          membership_card_price: "400",
          updated_at: "2026-09-01T00:00:00.000Z",
        });
        return;
      }
      if (path === "/v1/membership/plans") {
        await fulfillPaginated(route, []);
        return;
      }
      if (path === "/v1/membership/my-subscription") {
        await fulfill(route, null);
        return;
      }
      if (path === "/v1/membership/free-day-pass-eligibility") {
        await fulfill(route, {
          eligible: false,
          expires_at: null,
          granted_at: null,
          reason: "No active membership card.",
          redeemed_at: null,
          revoked_at: null,
        });
        return;
      }
      if (path === "/v1/users/me/attendance-qr") {
        await fulfill(route, {
          expiresAt: null,
          qrValue: null,
          ready: false,
          reason: "Attendance QR is unavailable in this fixture.",
          refreshAvailableAt: null,
        });
        return;
      }
    }

    if (method === "PATCH" && path === "/v1/users/me") {
      const body = parseBody(route);
      state.patchRequests.push({ body, method, path });

      if (
        state.patchMode === "error-once" &&
        state.patchRequests.length === 1
      ) {
        state.failedPatchRequests.push({ body, method, path });
        await route.fulfill({
          body: JSON.stringify({ message: "Profile update failed." }),
          contentType: "application/json",
          status: 500,
        });
        return;
      }

      if (state.patchMode === "held" && !state.heldPatchStarted) {
        state.heldPatchStarted = true;
        await new Promise<void>((resolvePromise) => {
          let released = false;
          state.releaseHeldPatch = () => {
            if (released) return;
            released = true;
            resolvePromise();
          };
        });
      }

      applyProfilePatch(state, body);
      await route.fulfill({ status: 204, body: "" });
      return;
    }

    state.unhandled.push(`${method} ${path}${url.search}`);
    await route.abort("blockedbyclient");
  });
}

function editorDialog(page: Page) {
  return page
    .getByRole("dialog")
    .filter({
      has: page.getByRole("tab", {
        name: "Personal profile tab",
        exact: true,
      }),
    })
    .last();
}

function confirmationDialog(page: Page) {
  return page
    .getByRole("dialog")
    .filter({ hasText: /Save profile changes\?/i })
    .last();
}

function field(dialog: Locator, name: string) {
  return dialog.getByLabel(name, { exact: true });
}

function editorSaveButton(dialog: Locator) {
  return dialog.getByRole("button", { name: /^Save$/i }).last();
}

async function assertHitTarget(
  page: Page,
  target: Locator,
  label: string,
) {
  await expect
    .poll(
      async () => {
        const box = await target.boundingBox();
        const viewport = page.viewportSize();
        if (!box || !viewport || box.width <= 0 || box.height <= 0) {
          return false;
        }
        if (
          box.x < 0 ||
          box.y < 0 ||
          box.x + box.width > viewport.width ||
          box.y + box.height > viewport.height
        ) {
          return false;
        }
        return target.evaluate((element) => {
          const rect = element.getBoundingClientRect();
          const topmost = document.elementFromPoint(
            rect.left + rect.width / 2,
            rect.top + rect.height / 2,
          );
          return Boolean(
            topmost && (topmost === element || element.contains(topmost)),
          );
        });
      },
      {
        intervals: [50, 100, 250, 500],
        message: `${label} should settle as the hit target`,
        timeout: 8_000,
      },
    )
    .toBe(true);

  const box = await target.boundingBox();
  const viewport = page.viewportSize();
  expect(box, `${label} bounds`).not.toBeNull();
  expect(viewport, `${label} viewport`).not.toBeNull();
  if (!box || !viewport) return;
  expect(box.width, `${label} width`).toBeGreaterThan(0);
  expect(box.height, `${label} height`).toBeGreaterThan(0);
  expect(box.x, `${label} left`).toBeGreaterThanOrEqual(0);
  expect(box.y, `${label} top`).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width, `${label} right`).toBeLessThanOrEqual(
    viewport.width,
  );
  expect(box.y + box.height, `${label} bottom`).toBeLessThanOrEqual(
    viewport.height,
  );
}

function roundedRect(box: Rect | null): Rect | null {
  if (!box) return null;
  return {
    height: Math.round(box.height),
    width: Math.round(box.width),
    x: Math.round(box.x),
    y: Math.round(box.y),
  };
}

async function readSurfaceSample(
  dialog: Locator,
  anchor: Locator,
): Promise<SurfaceSample> {
  const [dialogBox, anchorBox, opacity] = await Promise.all([
    dialog.boundingBox(),
    anchor.boundingBox(),
    dialog.evaluate((element) => Number(getComputedStyle(element).opacity)),
  ]);
  return {
    anchor: roundedRect(anchorBox),
    dialog: roundedRect(dialogBox),
    opacity: Number.isFinite(opacity) ? Number(opacity.toFixed(3)) : 0,
  };
}

function sameSurfaceSample(
  previous: SurfaceSample | null,
  current: SurfaceSample,
) {
  return (
    previous !== null &&
    JSON.stringify(previous) === JSON.stringify(current)
  );
}

async function settleSurface(
  dialog: Locator,
  anchor: Locator,
  label: string,
) {
  let previous: SurfaceSample | null = null;
  let latest: SurfaceSample | null = null;

  await expect
    .poll(
      async () => {
        latest = await readSurfaceSample(dialog, anchor);
        const stable = sameSurfaceSample(previous, latest);
        previous = latest;
        return Boolean(
          latest.dialog &&
            latest.anchor &&
            latest.opacity > 0.98 &&
            stable,
        );
      },
      {
        intervals: [50, 100, 200, 400],
        message: `${label} opacity and geometry should settle`,
        timeout: 8_000,
      },
    )
    .toBe(true);

  if (!latest) throw new Error(`${label} produced no surface sample.`);
  return latest;
}

function assertCleanLayout(audit: VisualLayoutAudit) {
  expect(audit.horizontalOverflow, "horizontal overflow").toBe(false);
  expect(audit.clipping, "clipped text or controls").toEqual([]);
  expect(audit.overlaps, "overlapping interactive controls").toEqual([]);
  expect(audit.nestedScrollbars, "nested scrollbars").toEqual([]);
}

async function captureEvidence(
  page: Page,
  testInfo: TestInfo,
  state: ProfileFixtureState,
  name: string,
  surface: SurfaceSample,
) {
  const evidenceRoot = resolve(
    process.cwd(),
    ".artifacts",
    "playwright",
    "profile-save",
  );
  await mkdir(evidenceRoot, { recursive: true });
  const safeName = `${testInfo.project.name}-${testInfo.testId}-${name}`.replace(
    /[^a-zA-Z0-9._-]+/g,
    "_",
  );
  const audit = await auditConventionalLayout(page);
  const evidence = {
    audit,
    consoleErrors: state.consoleErrors,
    failedPatchRequests: state.failedPatchRequests,
    patchRequests: state.patchRequests,
    requestFailures: state.requestFailures,
    route: await page.url(),
    surface,
    unhandled: state.unhandled,
    observedRequests: state.observedRequests,
  };
  const json = JSON.stringify(evidence, null, 2);
  const evidencePath = resolve(evidenceRoot, `${safeName}.json`);
  await writeFile(evidencePath, json);
  await testInfo.attach(`${name}.json`, {
    body: json,
    contentType: "application/json",
  });
  const screenshotPath = resolve(evidenceRoot, `${safeName}.png`);
  await page.screenshot({ fullPage: true, path: screenshotPath });
  await testInfo.attach(`${name}.png`, {
    contentType: "image/png",
    path: screenshotPath,
  });
  return audit;
}

async function openProfileEditor(page: Page) {
  await page.goto(`${MOBILE_BASE_URL}/profile`, {
    waitUntil: "domcontentloaded",
  });
  await expect(page).toHaveURL(/\/profile(?:\?|$)/);
  await expect(page.getByTestId("profile-screen")).toBeVisible({
    timeout: 20_000,
  });
  const editProfile = page.getByRole("button", {
    name: /^Edit Profile\b/i,
  });
  await expect(editProfile).toBeVisible({ timeout: 20_000 });
  await editProfile.scrollIntoViewIfNeeded();
  await assertHitTarget(page, editProfile, "Edit Profile card");
  await editProfile.tap();

  const editor = editorDialog(page);
  await expect(editor).toBeVisible({ timeout: 10_000 });
  await stabilizeVisualPage(page);
  return editor;
}

function assertFixtureClosed(state: ProfileFixtureState) {
  expect(state.unhandled, "unexpected API requests").toEqual([]);
  expect(state.requestFailures, "failed API requests").toEqual([]);
  const failedPatch = state.failedPatchRequests[0];
  const hasMatchingFailedPatch =
    state.fixtureMode === "error-once" &&
    state.failedPatchRequests.length === 1 &&
    failedPatch?.method === "PATCH" &&
    failedPatch.path === "/v1/users/me" &&
    state.patchRequests[0]?.method === failedPatch.method &&
    state.patchRequests[0]?.path === failedPatch.path;
  const unexpectedConsoleErrors = [...state.consoleErrors];
  if (hasMatchingFailedPatch) {
    const expectedErrorIndex = unexpectedConsoleErrors.indexOf(
      EXPECTED_SERVER_ERROR_CONSOLE,
    );
    if (expectedErrorIndex >= 0) unexpectedConsoleErrors.splice(expectedErrorIndex, 1);
  }
  expect(unexpectedConsoleErrors, "unexpected console or page errors").toEqual(
    [],
  );
}

test.describe("mobile profile save · modal ownership and persistence", () => {
  test.setTimeout(90_000);

  test("keeps the footer reachable through confirmation and held saving", async ({
    page,
  }, testInfo) => {
    const state = newFixtureState("held");
    await installProfileFixtures(page, state);
    const editor = await openProfileEditor(page);
    const save = editorSaveButton(editor);
    const initialSurface = await settleSurface(editor, save, "profile editor");
    const initialAudit = await captureEvidence(
      page,
      testInfo,
      state,
      "editor-clean",
      initialSurface,
    );
    assertCleanLayout(initialAudit);
    await expect(save).toBeDisabled();
    await expect(field(editor, "First Name")).toHaveValue(INITIAL_FIRST_NAME);

    await field(editor, "First Name").fill("Lucia");
    await expect(save).toBeEnabled();
    await assertHitTarget(page, save, "profile Save button");
    await save.tap();

    const confirmation = confirmationDialog(page);
    await expect(confirmation).toBeVisible({ timeout: 8_000 });
    await expect(
      page.getByText("Save profile changes?", { exact: true }),
    ).toHaveCount(1);
    await expect(editor).not.toBeVisible();
    const keepEditing = confirmation.getByRole("button", {
      name: /Keep Editing/i,
    });
    const confirmSave = confirmation.getByRole("button", {
      name: /Confirm Save/i,
    });
    await expect(keepEditing).toBeVisible();
    await expect(confirmSave).toBeVisible();
    await assertHitTarget(page, keepEditing, "Keep Editing button");
    await assertHitTarget(page, confirmSave, "Confirm Save button");
    const confirmationSurface = await settleSurface(
      confirmation,
      confirmSave,
      "save confirmation",
    );
    const confirmationAudit = await captureEvidence(
      page,
      testInfo,
      state,
      "confirmation",
      confirmationSurface,
    );
    assertCleanLayout(confirmationAudit);

    await keepEditing.tap();
    await expect(confirmation).not.toBeVisible();
    await expect(editor).toBeVisible();
    await expect(field(editor, "First Name")).toHaveValue("Lucia");
    expect(state.patchRequests).toEqual([]);

    await save.tap();
    const heldConfirmation = confirmationDialog(page);
    await expect(heldConfirmation).toBeVisible();
    await heldConfirmation
      .getByRole("button", { name: /Confirm Save/i })
      .tap();
    await expect.poll(() => state.heldPatchStarted, {
      intervals: [50, 100, 200, 400],
      timeout: 8_000,
    }).toBe(true);
    await expect(editor).toBeVisible();
    const saving = editor.getByRole("button", { name: /Saving/i }).last();
    await expect(saving).toBeVisible();
    await expect(field(editor, "First Name")).not.toBeEditable();
    await assertHitTarget(page, saving, "Saving button");
    const savingSurface = await settleSurface(editor, saving, "saving editor");
    const savingAudit = await captureEvidence(
      page,
      testInfo,
      state,
      "saving-held",
      savingSurface,
    );
    assertCleanLayout(savingAudit);

    try {
      state.releaseHeldPatch?.();
      await expect(editor).not.toBeVisible({ timeout: 10_000 });
    } finally {
      state.releaseHeldPatch?.();
    }

    expect(state.patchRequests).toHaveLength(1);
    expect(state.patchRequests[0]).toMatchObject({
      body: { first_name: "Lucia" },
      method: "PATCH",
      path: "/v1/users/me",
    });
    expect(Object.keys(state.patchRequests[0]?.body ?? {})).toEqual([
      "first_name",
    ]);

    const reopened = await openProfileEditor(page);
    await expect(field(reopened, "First Name")).toHaveValue("Lucia");
    expect(state.profile.profile.first_name).toBe("Lucia");
    const reopenedSave = editorSaveButton(reopened);
    const reopenedSurface = await settleSurface(
      reopened,
      reopenedSave,
      "reopened profile editor",
    );
    const reopenedAudit = await captureEvidence(
      page,
      testInfo,
      state,
      "reopened-persisted",
      reopenedSurface,
    );
    assertCleanLayout(reopenedAudit);
    assertFixtureClosed(state);
  });

  test("retains edited input after a server error and retries successfully", async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== "mobile-390x844",
      "Error recovery is scoped to the canonical 390x844 case.",
    );
    const state = newFixtureState("error-once");
    await installProfileFixtures(page, state);
    const editor = await openProfileEditor(page);
    const firstName = field(editor, "First Name");
    await firstName.fill("Mina");
    const save = editorSaveButton(editor);
    await expect(save).toBeEnabled();
    await save.tap();
    const confirmation = confirmationDialog(page);
    await expect(confirmation).toBeVisible();
    await confirmation.getByRole("button", { name: /Confirm Save/i }).tap();

    await expect(editor).toBeVisible();
    await expect(firstName).toHaveValue("Mina");
    await expect(page.getByText("Profile update failed.", { exact: true })).toBeVisible();
    expect(state.patchRequests).toHaveLength(1);
    const errorSave = editorSaveButton(editor);
    const errorSurface = await settleSurface(editor, errorSave, "error editor");
    const errorAudit = await captureEvidence(
      page,
      testInfo,
      state,
      "error-retains-input",
      errorSurface,
    );
    assertCleanLayout(errorAudit);

    state.patchMode = "success";
    await errorSave.tap();
    const retryConfirmation = confirmationDialog(page);
    await expect(retryConfirmation).toBeVisible();
    await retryConfirmation
      .getByRole("button", { name: /Confirm Save/i })
      .tap();
    await expect(editor).not.toBeVisible({ timeout: 10_000 });
    expect(state.patchRequests).toHaveLength(2);
    expect(state.patchRequests[0]?.body).toEqual({ first_name: "Mina" });
    expect(state.patchRequests[1]?.body).toEqual({ first_name: "Mina" });
    expect(state.profile.profile.first_name).toBe("Mina");

    const reopened = await openProfileEditor(page);
    await expect(field(reopened, "First Name")).toHaveValue("Mina");
    assertFixtureClosed(state);
  });

  test("confirms a fitness-only edit with a weight-only payload", async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== "mobile-390x844",
      "Fitness payload coverage is scoped to the canonical 390x844 case.",
    );
    const state = newFixtureState("success");
    await installProfileFixtures(page, state);
    const editor = await openProfileEditor(page);
    await editor
      .getByRole("tab", { name: /Fitness/i, exact: true })
      .tap();
    await expect(field(editor, "Weight (kg)")).toBeVisible();
    await expect(field(editor, "Height (cm)")).toBeVisible();
    await expect(editor.getByText("BMI", { exact: true })).toBeVisible();
    await expect(field(editor, "First Name")).toHaveCount(0);
    await expect(field(editor, "Last Name")).toHaveCount(0);
    await expect(field(editor, "Email")).toHaveCount(0);
    await expect(field(editor, "Phone")).toHaveCount(0);
    await expect(field(editor, "Date of Birth")).toHaveCount(0);
    await field(editor, "Weight (kg)").fill("72");
    const save = editorSaveButton(editor);
    await expect(save).toBeEnabled();
    await assertHitTarget(page, save, "fitness Save button");
    await save.tap();

    const confirmation = confirmationDialog(page);
    await expect(confirmation).toBeVisible();
    await expect(editor).not.toBeVisible();
    const confirmSave = confirmation.getByRole("button", {
      name: /Confirm Save/i,
    });
    const confirmationSurface = await settleSurface(
      confirmation,
      confirmSave,
      "fitness save confirmation",
    );
    const confirmationAudit = await captureEvidence(
      page,
      testInfo,
      state,
      "fitness-confirmation",
      confirmationSurface,
    );
    assertCleanLayout(confirmationAudit);
    await confirmSave.tap();
    await expect(editor).not.toBeVisible({ timeout: 10_000 });

    expect(state.patchRequests).toHaveLength(1);
    expect(state.patchRequests[0]?.body).toEqual({ weight_kg: 72 });
    expect(state.profile.profile.weight_kg).toBe(72);
    const reopened = await openProfileEditor(page);
    await reopened.getByRole("tab", { name: /Fitness/i, exact: true }).tap();
    await expect(field(reopened, "Weight (kg)")).toHaveValue("72");
    assertFixtureClosed(state);
  });

  test("keeps invalid personal input disabled, then allows confirmation without mutation", async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== "mobile-390x844",
      "Validation coverage is scoped to the canonical 390x844 case.",
    );
    const state = newFixtureState("success");
    await installProfileFixtures(page, state);
    const editor = await openProfileEditor(page);
    const firstName = field(editor, "First Name");
    const save = editorSaveButton(editor);
    await expect(save).toBeDisabled();
    await firstName.fill("1");
    await firstName.blur();
    await expect(
      page.getByText("First name must be at least 2 characters", {
        exact: true,
      }),
    ).toBeVisible();
    await expect(save).toBeDisabled();
    expect(state.patchRequests).toEqual([]);

    await firstName.fill("Mina");
    await expect(save).toBeEnabled();
    await save.tap();
    const confirmation = confirmationDialog(page);
    await expect(confirmation).toBeVisible();
    await confirmation.getByRole("button", { name: /Keep Editing/i }).tap();
    await expect(confirmation).not.toBeVisible();
    await expect(editor).toBeVisible();
    await expect(firstName).toHaveValue("Mina");
    expect(state.patchRequests).toEqual([]);
    const keptSurface = await settleSurface(editor, save, "kept editor");
    const keptAudit = await captureEvidence(
      page,
      testInfo,
      state,
      "invalid-corrected-kept",
      keptSurface,
    );
    assertCleanLayout(keptAudit);
    assertFixtureClosed(state);
  });

  test("termination confirmation responsive actions", async ({ page }, testInfo) => {
    const state = newFixtureState("success");
    await installProfileFixtures(page, state);
    await page.goto(`${MOBILE_BASE_URL}/profile`, {
      waitUntil: "domcontentloaded",
    });
    await expect(page).toHaveURL(/\/profile(?:\?|$)/);
    await expect(page.getByTestId("profile-screen")).toBeVisible({
      timeout: 20_000,
    });

    const terminationOpener = page.getByRole("button", {
      name: /^REQUEST ACCOUNT TERMINATION$/i,
    });
    const terminationTitle = "Request Account Termination?";
    const getTerminationConfirmation = () =>
      page
        .getByRole("dialog")
        .filter({
          has: page.getByText(terminationTitle, { exact: true }),
        })
        .last();

    const openTerminationConfirmation = async () => {
      await expect(terminationOpener).toBeVisible({ timeout: 20_000 });
      await terminationOpener.scrollIntoViewIfNeeded();
      await assertHitTarget(
        page,
        terminationOpener,
        "Request Account Termination action",
      );
      await terminationOpener.tap();
      const confirmation = getTerminationConfirmation();
      await expect(confirmation).toBeVisible({ timeout: 10_000 });
      await expect(
        confirmation.getByText(terminationTitle, { exact: true }),
      ).toBeVisible();
      return confirmation;
    };

    const inspectActions = async (confirmation: Locator, label: string) => {
      const cancel = confirmation.getByRole("button", {
        name: /^Cancel$/i,
      });
      const request = confirmation.getByRole("button", {
        name: /^Request Termination$/i,
      });
      // FitButton's Pressable now owns the complete visible frame.
      const cancelFrame = cancel;
      const actions = [
        {
          frame: cancelFrame,
          label: confirmation.getByText("Cancel", { exact: true }),
          name: "Cancel",
        },
        {
          frame: request,
          label: confirmation.getByText("Request Termination", { exact: true }),
          name: "Request Termination",
        },
      ];

      for (const action of actions) {
        await expect(action.frame, `${label} ${action.name} frame`).toBeVisible();
        await expect(action.label, `${label} ${action.name} label`).toBeVisible();
        await expect(action.label).toHaveCSS("text-align", "center");
        const [frameBox, labelBox, padding] = await Promise.all([
          action.frame.boundingBox(),
          action.label.boundingBox(),
          action.frame.evaluate((element) => {
            const styles = getComputedStyle(element);
            return {
              left: Number.parseFloat(styles.paddingLeft),
              right: Number.parseFloat(styles.paddingRight),
            };
          }),
        ]);
        expect(frameBox, `${label} ${action.name} frame bounds`).not.toBeNull();
        expect(labelBox, `${label} ${action.name} label bounds`).not.toBeNull();
        if (!frameBox || !labelBox) continue;
        expect(frameBox.width, `${label} ${action.name} width`).toBeGreaterThan(0);
        expect(frameBox.height, `${label} ${action.name} height`).toBeGreaterThan(0);
        expect(labelBox.x + labelBox.width / 2).toBeCloseTo(
          frameBox.x + frameBox.width / 2,
          0,
        );
        expect(padding.left, `${label} ${action.name} left inset`).toBeGreaterThanOrEqual(12);
        expect(padding.right, `${label} ${action.name} right inset`).toBeGreaterThanOrEqual(12);
      }

      await assertHitTarget(page, cancel, `${label} Cancel button`);
      await assertHitTarget(page, request, `${label} Request Termination button`);
      const [cancelFrameBox, requestBox] = await Promise.all([
        cancelFrame.boundingBox(),
        request.boundingBox(),
      ]);
      expect(cancelFrameBox, `${label} Cancel frame bounds`).not.toBeNull();
      expect(requestBox, `${label} Request Termination bounds`).not.toBeNull();
      if (!cancelFrameBox || !requestBox) {
        throw new Error(`${label} action bounds were unavailable.`);
      }
      expect(cancelFrameBox.height, `${label} Cancel frame height`).toBeGreaterThanOrEqual(48);
      expect(requestBox.height, `${label} Request Termination height`).toBeGreaterThanOrEqual(48);
      return { cancel, cancelFrame, cancelFrameBox, request, requestBox };
    };

    const confirmation = await openTerminationConfirmation();
    const initialRequest = confirmation.getByRole("button", {
      name: /^Request Termination$/i,
    });
    const initialSurface = await settleSurface(
      confirmation,
      initialRequest,
      "termination confirmation",
    );
    const initialActions = await inspectActions(
      confirmation,
      "termination confirmation",
    );
    const initialAudit = await captureEvidence(
      page,
      testInfo,
      state,
      `termination-${page.viewportSize()?.width ?? "unknown"}`,
      initialSurface,
    );
    assertCleanLayout(initialAudit);

    expect(
      Math.abs(initialActions.cancelFrameBox.y - initialActions.requestBox.y),
      "narrow termination actions should stack",
    ).toBeGreaterThan(20);

    await page.mouse.click(
      initialActions.cancelFrameBox.x + 4,
      initialActions.cancelFrameBox.y + initialActions.cancelFrameBox.height / 2,
    );
    await expect(confirmation).not.toBeVisible({ timeout: 10_000 });
    expect(state.patchRequests).toEqual([]);

    const reopened = await openTerminationConfirmation();
    await expect(
      reopened.getByText(terminationTitle, { exact: true }),
    ).toBeVisible();
    const reopenedCancel = reopened.getByRole("button", {
      name: /^Cancel$/i,
    });
    await assertHitTarget(page, reopenedCancel, "reopened Cancel button");
    await reopenedCancel.tap();
    await expect(reopened).not.toBeVisible({ timeout: 10_000 });
    expect(state.patchRequests).toEqual([]);

    if (testInfo.project.name === "mobile-390x844") {
      await page.setViewportSize({ width: 600, height: 844 });
      const wideConfirmation = await openTerminationConfirmation();
      const wideRequest = wideConfirmation.getByRole("button", {
        name: /^Request Termination$/i,
      });
      const wideSurface = await settleSurface(
        wideConfirmation,
        wideRequest,
        "wide termination confirmation",
      );
      const wideActions = await inspectActions(
        wideConfirmation,
        "wide termination confirmation",
      );
      const wideAudit = await captureEvidence(
        page,
        testInfo,
        state,
        "termination-600",
        wideSurface,
      );
      assertCleanLayout(wideAudit);
      expect(
        Math.abs(wideActions.cancelFrameBox.y - wideActions.requestBox.y),
        "wide termination actions should share a row",
      ).toBeLessThanOrEqual(2);
      expect(wideActions.requestBox.x).toBeGreaterThan(
        wideActions.cancelFrameBox.x + wideActions.cancelFrameBox.width,
      );

      await wideActions.cancel.tap();
      await expect(wideConfirmation).not.toBeVisible({ timeout: 10_000 });
      expect(state.patchRequests).toEqual([]);
    }

    assertFixtureClosed(state);
  });
});
