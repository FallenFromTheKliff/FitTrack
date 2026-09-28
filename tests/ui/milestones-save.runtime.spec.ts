import { expect, test, type Locator, type Page, type Route } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";

const FIXED_NOW = "2026-09-08T04:00:00.000Z";
const ADMIN_ID = "88888888-8888-4888-8888-888888888888";
const RULE_ID = "99999999-9999-4999-8999-999999999999";
const EMPTY_RULE_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const CREATED_RULE_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const LONG_TITLE = "Fractional max weight milestone with a deliberately long admin title";

type RawDefinition = {
  archived_at: string | null;
  archived_by_user_id: string | null;
  category: string;
  condition_payload: Record<string, unknown>;
  created_at: string;
  created_by_user_id: string | null;
  description: string | null;
  ends_at: string | null;
  evidence_requirement: "none";
  id: string;
  icon_asset_key: string | null;
  icon_key: string | null;
  icon_kind: "library" | "custom";
  is_active: boolean;
  is_hidden: boolean;
  key: string;
  pending_review_count: number;
  progress_count: number;
  reward_payload: Record<string, unknown> | null;
  sort_order: number;
  starts_at: string | null;
  status: "active" | "draft" | "archived";
  title: string;
  trigger_type: "source_event" | "summary_threshold" | "streak" | "manual" | "composite";
  unlocked_count: number;
  updated_at: string;
  updated_by_user_id: string | null;
  verification_policy: "auto";
};

type FixtureState = {
  definitions: RawDefinition[];
  failNextSave: boolean;
  failNextUpload: boolean;
  mutations: Array<{ method: string; path: string; body: unknown }>;
  observedRequests: string[];
  pageErrors: string[];
  consoleErrors: string[];
  expectedHttp500ConsoleErrors: number;
  unhandled: string[];
  pendingSave: boolean;
  releaseSave: (() => void) | null;
};

function state(): FixtureState {
  return {
    consoleErrors: [],
    expectedHttp500ConsoleErrors: 0,
    definitions: [seedDefinition(), emptyDefinition(), ...additionalDefinitions()],
    failNextSave: false,
    failNextUpload: false,
    mutations: [],
    observedRequests: [],
    pageErrors: [],
    pendingSave: false,
    releaseSave: null,
    unhandled: [],
  };
}

function seedDefinition(): RawDefinition {
  return {
    archived_at: null,
    archived_by_user_id: null,
    category: "weighted_lifting",
    condition_payload: { metric: "max_weight_kg", operator: "gte", target: 50.5 },
    created_at: "2026-08-01T02:00:00.000Z",
    created_by_user_id: ADMIN_ID,
    description: "A long weighted rule used to exercise the populated admin table.",
    ends_at: null,
    evidence_requirement: "none",
    id: RULE_ID,
    icon_asset_key: null,
    icon_key: "dumbbell",
    icon_kind: "library",
    is_active: true,
    is_hidden: false,
    key: "fractional-max-weight",
    pending_review_count: 0,
    progress_count: 76,
    reward_payload: { badge_tone: "gold", icon: "dumbbell", xp_bonus: 25 },
    sort_order: 1,
    starts_at: null,
    status: "active",
    title: LONG_TITLE,
    trigger_type: "summary_threshold",
    unlocked_count: 24,
    updated_at: "2026-09-08T02:00:00.000Z",
    updated_by_user_id: ADMIN_ID,
    verification_policy: "auto",
  };
}

function emptyDefinition(): RawDefinition {
  return {
    ...seedDefinition(),
    category: "training",
    condition_payload: { metric: "completed_workout_sessions", target: 10 },
    description: null,
    id: EMPTY_RULE_ID,
    icon_key: "trophy",
    key: "no-recorded-progress",
    progress_count: 0,
    reward_payload: { badge_tone: "ember", icon: "trophy", xp_bonus: 0 },
    sort_order: 2,
    title: "No recorded progress yet",
    unlocked_count: 0,
  };
}

function additionalDefinitions(): RawDefinition[] {
  return Array.from({ length: 10 }, (_, index) => ({
    ...seedDefinition(),
    description: `Additional populated row ${index + 1} for the table scroll fixture.`,
    id: `10000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
    key: `additional-library-row-${index + 1}`,
    sort_order: index + 3,
    title: `Additional populated milestone ${index + 1}`,
  }));
}

function userProfile() {
  return {
    email: "admin-responsive@fittrack.test",
    email_verified: true,
    has_accepted_privacy: true,
    id: ADMIN_ID,
    membership_card: null,
    profile: {
      activity_level: "active",
      first_name: "Ada",
      last_name: "Responsive Admin",
      fitness_goal: "maintenance",
    },
    role: "ADMIN",
    status: "active",
  };
}

function notificationRecords() {
  return [
    {
      body: "A milestone fixture is ready for review.",
      channel: "in_app",
      created_at: "2026-09-08T03:00:00.000Z",
      data: { kind: "milestone" },
      error: null,
      id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      read_at: null,
      sent_at: "2026-09-08T03:00:00.000Z",
      status: "sent",
      title: "Milestone audit fixture",
      type: "system",
      updated_at: "2026-09-08T03:00:00.000Z",
    },
  ];
}

function pageResponse(data: unknown[], url: URL) {
  const page = Math.max(1, Number(url.searchParams.get("page") ?? "1"));
  const limit = Math.max(1, Number(url.searchParams.get("limit") ?? "10"));
  const start = (page - 1) * limit;
  return {
    data: data.slice(start, start + limit),
    meta: {
      page,
      limit,
      total: data.length,
      total_pages: Math.max(1, Math.ceil(data.length / limit)),
    },
  };
}

async function fulfill(route: Route, data: unknown, status = 200) {
  await route.fulfill({
    body: JSON.stringify(status >= 400 ? data : { data }),
    contentType: "application/json",
    headers: {
      "access-control-allow-credentials": "true",
      "access-control-allow-origin": "http://127.0.0.1:8080",
    },
    status,
  });
}

async function fulfillPage(route: Route, data: unknown[], url: URL) {
  await route.fulfill({
    body: JSON.stringify(pageResponse(data, url)),
    contentType: "application/json",
    headers: {
      "access-control-allow-credentials": "true",
      "access-control-allow-origin": "http://127.0.0.1:8080",
    },
    status: 200,
  });
}

function parseBody(request: ReturnType<Route["request"]>) {
  try {
    return request.postDataJSON() as Record<string, unknown>;
  } catch {
    return {};
  }
}

function savePath(path: string) {
  return path === "/v1/admin/gamification/milestones" ||
    /^\/v1\/admin\/gamification\/milestones\/[^/]+$/.test(path);
}

async function installAdminFixture(page: Page, fixture: FixtureState) {
  page.on("console", (message) => {
    if (message.type() !== "error") return;
    const text = message.text();
    const expectedResourceError = "Failed to load resource: the server responded with a status of 500 (Internal Server Error)";
    if (text === expectedResourceError && fixture.expectedHttp500ConsoleErrors > 0) {
      fixture.expectedHttp500ConsoleErrors -= 1;
      return;
    }
    fixture.consoleErrors.push(text);
  });
  page.on("pageerror", (error) => fixture.pageErrors.push(error.message));
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.pathname.startsWith("/v1/")) {
      fixture.observedRequests.push(`${request.method()} ${url.pathname}${url.search}`);
    }
  });

  await page.clock.install();
  await page.clock.setFixedTime(Date.parse(FIXED_NOW));
  await page.addInitScript(({ adminId }) => {
    window.localStorage.setItem("fittrack_access_token", "admin-save-fixture-token");
    window.localStorage.setItem("fittrack_refresh_token", "admin-save-fixture-refresh");
    window.localStorage.setItem(`fittrack_prefs_${adminId}`, JSON.stringify({
      themeKey: "night",
      fontKey: "standard",
      animationLevel: "none",
    }));
  }, { adminId: ADMIN_ID });

  await page.route("**/v1/**", async (route) => {
    const request = route.request();
    const method = request.method();
    const url = new URL(request.url());
    const path = url.pathname;
    if (method === "OPTIONS") {
      await route.fulfill({ status: 204 });
      return;
    }
    if (method !== "GET") {
      fixture.mutations.push({ method, path, body: parseBody(request) });
    }

    if (method === "GET" && path === "/v1/users/me") {
      await fulfill(route, userProfile());
      return;
    }
    if (method === "GET" && path === "/v1/notifications/my") {
      await fulfillPage(route, notificationRecords(), url);
      return;
    }
    if (method === "GET" && path === "/v1/notifications/unread-count") {
      await fulfill(route, { count: 1 });
      return;
    }
    if (method === "GET" && path === "/v1/admin/gamification/milestones") {
      const search = url.searchParams.get("search")?.trim().toLowerCase() ?? "";
      const status = url.searchParams.get("status") ?? "active";
      const rows = fixture.definitions.filter((row) =>
        (status === "all" || row.status === status) &&
        (!search || `${row.title} ${row.key}`.toLowerCase().includes(search)),
      );
      await fulfillPage(route, rows, url);
      return;
    }
    if (method === "GET" && /^\/v1\/admin\/gamification\/milestones\/[^/]+$/.test(path)) {
      const row = fixture.definitions.find((item) => item.id === path.split("/").at(-1));
      if (row) {
        await fulfill(route, row);
        return;
      }
      await fulfill(route, { message: "Not found" }, 404);
      return;
    }
    if (method === "POST" && path === "/v1/files/upload") {
      if (fixture.failNextUpload) {
        fixture.failNextUpload = false;
        fixture.expectedHttp500ConsoleErrors += 1;
        await fulfill(route, { detail: "Synthetic icon upload failure" }, 500);
        return;
      }
      await fulfill(route, {
        file_key: "milestone-icons/fixture.png",
        mime_type: "image/png",
        original_filename: "fixture.png",
        size_bytes: 68,
        url: "http://127.0.0.1:8080/fixture.png",
      });
      return;
    }
    if ((method === "POST" || method === "PATCH") && savePath(path)) {
      if (fixture.pendingSave) {
        await new Promise<void>((resolvePromise) => {
          fixture.releaseSave = resolvePromise;
        });
        fixture.releaseSave = null;
        fixture.pendingSave = false;
      }
      if (fixture.failNextSave) {
        fixture.failNextSave = false;
        fixture.expectedHttp500ConsoleErrors += 1;
        await fulfill(route, { detail: "Synthetic milestone save failure" }, 500);
        return;
      }
      const body = parseBody(request);
      const input = body as Record<string, unknown>;
      const id = method === "PATCH" ? path.split("/").at(-1) ?? RULE_ID : CREATED_RULE_ID;
      const existing = fixture.definitions.find((row) => row.id === id) ?? seedDefinition();
      const next: RawDefinition = {
        ...existing,
        category: String(input.category ?? existing.category),
        condition_payload: (input.condition_payload as Record<string, unknown> | undefined) ?? existing.condition_payload,
        description: (input.description as string | null | undefined) ?? existing.description,
        ends_at: (input.ends_at as string | null | undefined) ?? existing.ends_at,
        icon_asset_key: (input.icon_asset_key as string | null | undefined) ?? existing.icon_asset_key,
        icon_key: (input.icon_key as string | null | undefined) ?? existing.icon_key,
        icon_kind: (input.icon_kind as RawDefinition["icon_kind"] | undefined) ?? existing.icon_kind,
        is_hidden: Boolean(input.is_hidden ?? existing.is_hidden),
        id,
        key: String(input.key ?? existing.key),
        reward_payload: (input.reward_payload as Record<string, unknown> | null | undefined) ?? existing.reward_payload,
        sort_order: Number(input.sort_order ?? existing.sort_order),
        starts_at: (input.starts_at as string | null | undefined) ?? existing.starts_at,
        status: (input.status as RawDefinition["status"] | undefined) ?? existing.status,
        title: String(input.title ?? existing.title),
        trigger_type: (input.trigger_type as RawDefinition["trigger_type"] | undefined) ?? existing.trigger_type,
        updated_at: FIXED_NOW,
      };
      fixture.definitions = fixture.definitions.filter((row) => row.id !== id);
      fixture.definitions.unshift(next);
      await fulfill(route, next);
      return;
    }

    fixture.unhandled.push(`${method} ${path}${url.search}`);
    await fulfill(route, { message: `Unhandled fixture request: ${method} ${path}` }, 599);
  });
}

async function waitForSettledModal(page: Page, dialog: Locator) {
  await page.evaluate(async () => {
    await document.fonts?.ready;
  });
  await expect(dialog).toBeVisible();
  // FitModal and ConfirmModal queue visibility in requestAnimationFrame; flush that
  // frame through the installed deterministic clock before inspecting the frame.
  await page.clock.runFor(0);
  await expect
    .poll(
      async () => {
        await page.clock.runFor(16);
        return dialog.evaluate((element) => {
          const overlay =
            element.closest<HTMLElement>('[data-fit-modal-overlay="true"]') ??
            element.parentElement;
          if (!overlay) return false;
          const overlayStyle = getComputedStyle(overlay);
          const isModalOverlay =
            overlay.getAttribute('data-fit-modal-overlay') === 'true' ||
            overlayStyle.position === 'fixed';
          if (!isModalOverlay) return false;
          const overlayOpacity = Number.parseFloat(overlayStyle.opacity);
          const dialogOpacity = Number.parseFloat(getComputedStyle(element).opacity);
          const nodes = [overlay, element];
          const hasFiniteRunningAnimation = nodes.some((node) =>
            node.getAnimations().some((animation) => {
              const iterations = animation.effect?.getTiming().iterations;
              return animation.playState === 'running' && iterations !== Infinity;
            }),
          );
          return overlayOpacity >= 0.99 && dialogOpacity >= 0.99 && !hasFiniteRunningAnimation;
        });
      },
      { intervals: [50, 100, 200], timeout: 5000 },
    )
    .toBe(true);
  await expect
    .poll(
      async () => {
        const first = await dialog.boundingBox();
        await page.clock.runFor(16);
        const second = await dialog.boundingBox();
        if (!first || !second) return false;
        const firstBounds = [first.x, first.y, first.width, first.height];
        const secondBounds = [second.x, second.y, second.width, second.height];
        return firstBounds.every((value, index) =>
          Math.round(value) === Math.round(secondBounds[index]),
        );
      },
      { intervals: [50, 100, 200], timeout: 5000 },
    )
    .toBe(true);
}
async function saveShot(page: Page, name: string, dialog?: Locator) {
  if (dialog) {
    await waitForSettledModal(page, dialog);
  } else {
    await page.evaluate(async () => {
      await document.fonts?.ready;
    });
  }
  const root = resolve(process.cwd(), ".artifacts", "playwright", "admin-milestones-save");
  await mkdir(root, { recursive: true });
  await page.screenshot({ path: resolve(root, `${name}.png`), fullPage: false });
}

async function assertDesktopToolbar(main: Locator) {
  const toolbar = main.locator(".milestones-toolbar");
  const controls = [
    toolbar.getByPlaceholder("Search milestones..."),
    toolbar.getByRole("button", { name: "Select: Active", exact: true }),
    toolbar.getByRole("button", { name: "Select: All categories", exact: true }),
    toolbar.getByRole("button", { name: "Select: All triggers", exact: true }),
    toolbar.getByRole("button", { name: "Clear filters", exact: true }),
  ];
  await expect(toolbar).toBeVisible();
  const boxes = await Promise.all(controls.map((control) => control.boundingBox()));
  expect(boxes.every((box) => box !== null)).toBe(true);
  const toolbarBox = await toolbar.boundingBox();
  expect(toolbarBox).not.toBeNull();
  if (toolbarBox && boxes.every((box) => box !== null)) {
    const resolvedBoxes = boxes as Array<{ x: number; y: number; width: number; height: number }>;
    const centers = resolvedBoxes.map((box) => box.y + box.height / 2);
    expect(Math.max(...centers) - Math.min(...centers)).toBeLessThanOrEqual(1);
    expect(resolvedBoxes[0].x - toolbarBox.x).toBeGreaterThanOrEqual(7);
    const clearBox = resolvedBoxes.at(-1);
    expect(clearBox).toBeDefined();
    if (clearBox) {
      expect(toolbarBox.x + toolbarBox.width - (clearBox.x + clearBox.width)).toBeGreaterThanOrEqual(7);
    }
    expect(resolvedBoxes[0].y - toolbarBox.y).toBeGreaterThanOrEqual(7);
  }
  await expect(main.getByText(/\d+ definitions/i)).toHaveCount(0);
}

async function assertConfirmationActionsFit(page: Page, confirmation: Locator) {
  const dialogBox = await confirmation.boundingBox();
  expect(dialogBox).not.toBeNull();
  const buttons = [
    confirmation.getByRole("button", { name: "Back", exact: true }),
    confirmation.getByRole("button", { name: /^(Create|Save)$/, exact: true }),
  ];
  const boxes = await Promise.all(buttons.map((button) => button.boundingBox()));
  expect(boxes.every((box) => box !== null)).toBe(true);
  if (!dialogBox || boxes.some((box) => box === null)) return;
  for (const box of boxes as Array<{ x: number; y: number; width: number; height: number }>) {
    expect(box.x).toBeGreaterThanOrEqual(dialogBox.x + 7);
    expect(box.x + box.width).toBeLessThanOrEqual(dialogBox.x + dialogBox.width - 7);
    expect(box.y).toBeGreaterThanOrEqual(dialogBox.y);
    expect(box.y + box.height).toBeLessThanOrEqual(dialogBox.y + dialogBox.height);
  }
}

async function openCreate(page: Page, title: string) {
  await page.getByRole("button", { name: "Create milestone", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Create milestone", exact: true });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("textbox", { name: "Title", exact: true }).fill(title);
  return dialog;
}

async function advanceToReview(dialog: Locator) {
  await dialog.getByRole("button", { name: "Next", exact: true }).click();
  await expect(dialog.getByText("Reward configuration", { exact: true })).toBeVisible();
  await dialog.getByRole("button", { name: "Next", exact: true }).click();
  await expect(dialog.getByText("Summary", { exact: true })).toBeVisible();
}

async function confirmSave(page: Page, label: "Create" | "Save") {
  const confirmation = page.getByRole("dialog", { name: /Confirm milestone/ });
  await expect(confirmation).toBeVisible();
  await assertConfirmationActionsFit(page, confirmation);
  await confirmation.getByRole("button", { name: label, exact: true }).click();
}

async function expectNoHorizontalOverflow(page: Page) {
  const metrics = await page.evaluate(() => ({
    documentWidth: document.documentElement.scrollWidth,
    viewportWidth: window.innerWidth,
  }));
  expect(metrics.documentWidth - metrics.viewportWidth).toBeLessThanOrEqual(1);
}

test("admin milestone save flow is confirmed, single-flight, validated, and reachable", async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  const fixture = state();
  await installAdminFixture(page, fixture);
  await page.goto("/milestones", { waitUntil: "domcontentloaded" });
  const main = page.getByRole("main");
  await expect(main.getByRole("heading", { name: "Milestones", exact: true, level: 1 })).toBeVisible();
  await expect(main.getByText("Member unlocks", { exact: true })).toHaveCount(0);
  await expect(main.getByText(LONG_TITLE, { exact: true })).toBeVisible();
  await expectNoHorizontalOverflow(page);
  if (testInfo.project.name === "desktop-1440x900") await assertDesktopToolbar(main);
  await saveShot(page, `${testInfo.project.name}-library-top`);

  const beforeWrites = fixture.mutations.filter((item) => savePath(item.path)).length;
  let dialog = await openCreate(page, "Confirmable mobile milestone");
  await advanceToReview(dialog);
  await dialog.getByRole("button", { name: "Create milestone", exact: true }).click();
  const confirmation = page.getByRole("dialog", { name: "Confirm milestone creation", exact: true });
  await expect(confirmation).toBeVisible();
  expect(fixture.mutations.filter((item) => savePath(item.path)).length).toBe(beforeWrites);
  await assertConfirmationActionsFit(page, confirmation);
  await saveShot(page, `${testInfo.project.name}-confirmation`, confirmation);
  await confirmation.getByRole("button", { name: "Back", exact: true }).click();
  dialog = page.getByRole("dialog", { name: "Create milestone", exact: true });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(dialog).toBeHidden();

  dialog = await openCreate(page, "Created milestone with a long title");
  await advanceToReview(dialog);
  await dialog.getByRole("button", { name: "Create milestone", exact: true }).click();
  await confirmSave(page, "Create");
  const createdSuccess = page.getByRole("dialog", { name: "Milestone created", exact: true });
  await expect(createdSuccess).toBeVisible();
  await expect(createdSuccess.getByText("Created milestone with a long title", { exact: true })).toBeVisible();
  await expect(createdSuccess.locator(".milestone-save-success-body")).toBeVisible();
  await expect(createdSuccess.locator(".milestone-confirm-body")).toHaveCount(0);
  await saveShot(page, `${testInfo.project.name}-success`, createdSuccess);
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Milestone created", exact: true })).toBeHidden();

  await expect(page.getByRole("button", { name: "Edit Created milestone with a long title", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Edit Created milestone with a long title", exact: true }).click();
  dialog = page.getByRole("dialog", { name: "Edit milestone", exact: true });
  await dialog.getByRole("textbox", { name: "Title", exact: true }).fill("Updated milestone title");
  await advanceToReview(dialog);
  await dialog.getByRole("button", { name: "Save milestone", exact: true }).click();
  await confirmSave(page, "Save");
  await expect(page.getByRole("dialog", { name: "Milestone updated", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await expect(page.getByRole("button", { name: "Duplicate Updated milestone title", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Duplicate Updated milestone title", exact: true }).click();
  const duplicateDialog = page.getByRole("dialog", { name: "Create milestone", exact: true });
  await expect(duplicateDialog.getByRole("textbox", { name: "Title", exact: true })).toHaveValue("Updated milestone title Copy");
  await duplicateDialog.getByRole("button", { name: "Cancel", exact: true }).click();

  dialog = await openCreate(page, "Retryable milestone");
  await advanceToReview(dialog);
  await dialog.getByRole("button", { name: "Create milestone", exact: true }).click();
  fixture.failNextSave = true;
  await confirmSave(page, "Create");
  await expect(page.getByRole("dialog", { name: "Create milestone", exact: true })).toBeVisible();
  await expect(page.getByText("Synthetic milestone save failure", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Create milestone", exact: true }).click();
  await confirmSave(page, "Create");
  await expect(page.getByRole("dialog", { name: "Milestone created", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Done", exact: true }).click();

  fixture.pendingSave = true;
  dialog = await openCreate(page, "Held pending milestone");
  await advanceToReview(dialog);
  await dialog.getByRole("button", { name: "Create milestone", exact: true }).click();
  const pendingConfirmation = page.getByRole("dialog", { name: "Confirm milestone creation", exact: true });
  const writesBeforePending = fixture.mutations.filter((item) => savePath(item.path)).length;
  const pendingConfirmButton = pendingConfirmation.getByRole("button", { name: "Create", exact: true });
  const pendingConfirmBox = await pendingConfirmButton.boundingBox();
  expect(pendingConfirmBox).not.toBeNull();
  const pendingClick = pendingConfirmButton.click();
  await expect.poll(() => fixture.pendingSave).toBe(true);
  const savingDialog = page.getByRole("dialog", { name: "Saving milestone", exact: true });
  await expect(savingDialog).toBeVisible();
  if (pendingConfirmBox) await page.mouse.click(pendingConfirmBox.x + pendingConfirmBox.width / 2, pendingConfirmBox.y + pendingConfirmBox.height / 2);
  await expect.poll(() => fixture.mutations.filter((item) => savePath(item.path)).length).toBe(writesBeforePending + 1);
  expect(await page.getByRole("dialog", { name: "Milestone created", exact: true }).count()).toBe(0);
  fixture.releaseSave?.();
  await pendingClick;
  await expect(page.getByRole("dialog", { name: "Milestone created", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Done", exact: true }).click();

  fixture.failNextUpload = true;
  dialog = await openCreate(page, "Upload failure milestone");
  await advanceToReview(dialog);
  await dialog.getByRole("button", { name: "Back", exact: true }).click();
  const uploadInput = dialog.locator('input[type="file"]');
  await uploadInput.setInputFiles({ name: "fixture.png", mimeType: "image/png", buffer: Buffer.from([137, 80, 78, 71]) });
  await dialog.getByRole("button", { name: "Next", exact: true }).click();
  await dialog.getByRole("button", { name: "Create milestone", exact: true }).click();
  const writesBeforeUpload = fixture.mutations.filter((item) => savePath(item.path)).length;
  await confirmSave(page, "Create");
  await expect(page.getByRole("dialog", { name: "Create milestone", exact: true })).toBeVisible();
  await expect(page.getByText("Synthetic icon upload failure", { exact: true })).toBeVisible();
  expect(fixture.mutations.filter((item) => savePath(item.path)).length).toBe(writesBeforeUpload);

  dialog = page.getByRole("dialog", { name: "Create milestone", exact: true });
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  await expectNoHorizontalOverflow(page);
  expect(fixture.unhandled, fixture.unhandled.join("\n")).toEqual([]);
  expect(fixture.pageErrors, fixture.pageErrors.join("\n")).toEqual([]);
  expect(fixture.expectedHttp500ConsoleErrors).toBe(0);
  expect(fixture.consoleErrors, fixture.consoleErrors.join("\n")).toEqual([]);
  await saveShot(page, `${testInfo.project.name}-library-bottom`);
});

test("milestone library keeps its default height, scrolls rows, and pages", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-1440x900", "desktop library regression");
  const fixture = state();
  await installAdminFixture(page, fixture);
  await page.goto("/milestones", { waitUntil: "domcontentloaded" });
  const main = page.getByRole("main");
  await expect(main.getByText("Additional populated milestone 1", { exact: true })).toBeVisible();

  const frame = main.locator(".milestones-rules-table-frame");
  const frameBox = await frame.boundingBox();
  expect(frameBox).not.toBeNull();
  if (frameBox) {
    expect(frameBox.height).toBeGreaterThan(0);
    expect(frameBox.height).toBeLessThanOrEqual(511);
  }

  const shortViewportNextPage = main.getByRole("button", { name: "Go to next page", exact: true });
  const shortViewportNextBox = await shortViewportNextPage.boundingBox();
  expect(shortViewportNextBox).not.toBeNull();
  if (shortViewportNextBox) {
    expect(shortViewportNextBox.y + shortViewportNextBox.height).toBeLessThanOrEqual(900);
  }

  await page.setViewportSize({ width: 1440, height: 1200 });
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(main.getByText("Additional populated milestone 1", { exact: true })).toBeVisible();
  const ampleFrameBox = await frame.boundingBox();
  expect(ampleFrameBox).not.toBeNull();
  if (ampleFrameBox) expect(Math.abs(ampleFrameBox.height - 510)).toBeLessThanOrEqual(1);

  const body = frame.locator(".milestone-rule-body");
  const rows = body.locator(".milestone-rule-row");
  await expect(rows).toHaveCount(10);
  const bodyBox = await body.boundingBox();
  expect(bodyBox).not.toBeNull();
  const initialScrollTop = await body.evaluate((element) => element.scrollTop);
  if (bodyBox) {
    await page.mouse.move(bodyBox.x + bodyBox.width / 2, bodyBox.y + bodyBox.height / 2);
    await page.mouse.wheel(0, 900);
  }
  await expect
    .poll(() => body.evaluate((element) => element.scrollTop), { timeout: 5000 })
    .toBeGreaterThan(initialScrollTop);

  const lastRow = rows.last();
  await expect
    .poll(
      async () => {
        const rowBox = await lastRow.boundingBox();
        const settledBodyBox = await body.boundingBox();
        return Boolean(
          rowBox &&
            settledBodyBox &&
            rowBox.y >= settledBodyBox.y - 1 &&
            rowBox.y + rowBox.height <= settledBodyBox.y + settledBodyBox.height + 1,
        );
      },
      { timeout: 5000 },
    )
    .toBe(true);

  const nextPage = main.getByRole("button", { name: "Go to next page", exact: true });
  const nextBox = await nextPage.boundingBox();
  expect(nextBox).not.toBeNull();
  if (nextBox) {
    expect(nextBox.x).toBeGreaterThanOrEqual(0);
    expect(nextBox.y).toBeGreaterThanOrEqual(0);
    expect(nextBox.x + nextBox.width).toBeLessThanOrEqual(1440);
    expect(nextBox.y + nextBox.height).toBeLessThanOrEqual(1200);
  }
  await nextPage.click();
  await expect(main.getByText("Additional populated milestone 10", { exact: true })).toBeVisible();
  await expect(main.getByText("Additional populated milestone 1", { exact: true })).toHaveCount(0);
  await expect(main.getByText(/\d+ definitions/i)).toHaveCount(0);
  await saveShot(page, `${testInfo.project.name}-library-paged`);
});

test("milestone confirmation actions fit at the 320px boundary", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "narrow-390x844", "320px boundary regression");
  await page.setViewportSize({ width: 320, height: 568 });
  const fixture = state();
  await installAdminFixture(page, fixture);
  await page.goto("/milestones", { waitUntil: "domcontentloaded" });
  const dialog = await openCreate(page, "320px confirmation milestone");
  await advanceToReview(dialog);
  await dialog.getByRole("button", { name: "Create milestone", exact: true }).click();
  const confirmation = page.getByRole("dialog", { name: "Confirm milestone creation", exact: true });
  await expect(confirmation).toBeVisible();
  await assertConfirmationActionsFit(page, confirmation);
  await saveShot(page, "narrow-320x568-confirmation", confirmation);
  await confirmation.getByRole("button", { name: "Back", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Create milestone", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  expect(fixture.mutations.filter((item) => savePath(item.path))).toEqual([]);
});

test("invalid milestone targets are blocked before confirmation or writes", async ({ page }) => {
  const fixture = state();
  await installAdminFixture(page, fixture);
  await page.goto("/milestones", { waitUntil: "domcontentloaded" });
  const dialog = await openCreate(page, "Invalid target milestone");
  await dialog.getByLabel("Target number", { exact: true }).fill("0");
  const next = dialog.getByRole("button", { name: "Next", exact: true });
  await expect(next).toBeDisabled();
  expect(fixture.mutations.filter((item) => savePath(item.path))).toEqual([]);
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  expect(fixture.unhandled, fixture.unhandled.join("\n")).toEqual([]);
});
