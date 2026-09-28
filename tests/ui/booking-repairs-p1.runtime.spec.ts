import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { expect, test, type Page, type TestInfo } from "@playwright/test";

type Credential = { email: string; password: string; role: string };
const manifestPath = resolve(process.cwd(), ".artifacts", "dynamic-seed-manifest.json");
const mobileBaseUrl = "http://127.0.0.1:8081";

async function account(role: "admin" | "coach" | "member") {
  const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as {
    credentials: Credential[];
  };
  const found = manifest.credentials.find((credential) => credential.role === role);
  if (!found) throw new Error(`Missing ${role} test account.`);
  return found;
}

async function loginMobile(page: Page, role: "coach" | "member") {
  const credential = await account(role);
  await page.goto(`${mobileBaseUrl}/login`);
  await page.getByLabel("Email").fill(credential.email);
  await page.getByRole("textbox", { name: "Password" }).fill(credential.password);
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL(/\/home(?:\?|$)/, { timeout: 30_000 });
}

async function loginAdmin(page: Page) {
  const credential = await account("admin");
  await page.goto("/login");
  await page.getByLabel("Email Address").fill(credential.email);
  await page.getByRole("textbox", { name: "Password" }).fill(credential.password);
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL((url) => url.pathname !== "/login", { timeout: 60_000 });
}

async function screenshot(page: Page, testInfo: TestInfo, name: string) {
  await page.screenshot({ fullPage: true, path: testInfo.outputPath(`${name}.png`) });
}

async function openMemberCoachPicker(page: Page) {
  await page.goto(`${mobileBaseUrl}/bookings`);
  await page.getByRole("button", { name: "Open quick actions menu" }).click();
  await page.getByRole("button", { name: /book a trainer/i }).first().click();
  await page.getByRole("button", { name: "Single Session" }).click();
  await page.getByRole("button", { name: "Choose a coach" }).click();
  return page.getByRole("dialog").filter({ hasText: "Select a Coach" });
}

async function coachListGeometry(dialog: ReturnType<Page["getByRole"]>) {
  const firstRow = dialog.getByRole("button").filter({ hasText: /stars/ }).first();
  await expect(firstRow).toBeVisible();
  const [dialogBox, rowBox] = await Promise.all([
    dialog.boundingBox(),
    firstRow.boundingBox(),
  ]);
  return {
    dialogHeight: dialogBox?.height ?? 0,
    rowHeight: rowBox?.height ?? 0,
  };
}

test.describe.configure({ mode: "serial" });

test("member coach picker owns visible scroll space and composes filter, search, and selection", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile-chrome");
  test.setTimeout(120_000);
  await loginMobile(page, "member");
  await page.setViewportSize({ width: 390, height: 844 });
  let dialog = await openMemberCoachPicker(page);
  const mobileGeometry = await coachListGeometry(dialog);
  expect(mobileGeometry.dialogHeight).toBeGreaterThan(0);
  expect(mobileGeometry.rowHeight).toBeGreaterThan(0);

  await dialog.getByRole("button", { name: "Body Recomposition", exact: true }).click();
  const specialtyRows = dialog.getByRole("button").filter({ hasText: /4\.[0-9] stars/ });
  const specialtyCount = await specialtyRows.count();
  expect(specialtyCount).toBeGreaterThan(0);
  await dialog.getByRole("button", { name: "4+ stars", exact: true }).click();
  expect(await specialtyRows.count()).toBeGreaterThan(0);

  const firstRowText = await specialtyRows.first().innerText();
  const coachName = firstRowText.split("\n")[0]!.trim();
  const search = dialog.getByPlaceholder("Search coaches or specialties");
  await search.fill("no matching coach exists");
  await expect(dialog.getByText("No bookable coaches match the current search and filters.", { exact: true })).toBeVisible();
  await search.fill(coachName);
  const matchingRow = dialog.getByRole("button").filter({ hasText: coachName }).first();
  await expect(matchingRow).toBeVisible();
  await matchingRow.click();
  await expect(dialog).not.toBeVisible();
  await expect(page.getByRole("button", { name: `Selected coach ${coachName}` })).toBeVisible();
  await expect(page.getByText(`Coach review: ${coachName}`, { exact: true })).toBeVisible();
  await screenshot(page, testInfo, "member-picker-mobile-selected");

  await page.setViewportSize({ width: 1280, height: 900 });
  await page.getByRole("button", { name: `Selected coach ${coachName}` }).click();
  dialog = page.getByRole("dialog").filter({ hasText: "Select a Coach" });
  const desktopGeometry = await coachListGeometry(dialog);
  expect(desktopGeometry.rowHeight).toBeGreaterThan(0);
  await screenshot(page, testInfo, "member-picker-desktop-populated");
  await dialog.getByRole("button", { name: /Close Select a Coach/ }).click();

  let releaseCoaches!: () => void;
  const heldCoaches = new Promise<void>((resolve) => { releaseCoaches = resolve; });
  await page.route("**/coaching/coaches?**", async (route) => {
    await heldCoaches;
    await route.continue();
  });
  await page.reload();
  await page.getByRole("button", { name: "Open quick actions menu" }).click();
  await page.getByRole("button", { name: /book a trainer/i }).first().click();
  await page.getByRole("button", { name: "Single Session" }).click();
  await page.getByRole("button", { name: "Choose a coach" }).click();
  await expect(page.getByText("Loading live options...", { exact: true })).toBeVisible();
  releaseCoaches();
  await expect(page.getByRole("dialog").filter({ hasText: "Select a Coach" }).getByRole("button").filter({ hasText: /stars/ }).first()).toBeVisible();
  await page.unroute("**/coaching/coaches?**");
  await page.getByRole("button", { name: /Close Select a Coach/ }).click();

  await page.route("**/coaching/coaches?**", (route) => route.fulfill({
    body: JSON.stringify({ message: "Runtime coach failure" }),
    contentType: "application/json",
    status: 503,
  }));
  await page.reload();
  await page.getByRole("button", { name: "Open quick actions menu" }).click();
  await page.getByRole("button", { name: /book a trainer/i }).first().click();
  await page.getByRole("button", { name: "Single Session" }).click();
  await page.getByRole("button", { name: "Choose a coach" }).click();
  const errorDialog = page.getByRole("dialog").filter({ hasText: "Select a Coach" });
  await expect(errorDialog.getByText("Runtime coach failure", { exact: true })).toBeVisible();
  await expect(errorDialog.getByRole("button", { name: "Retry" })).toBeVisible();
});

test("admin coach booking exposes only the single-session path", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chrome");
  test.setTimeout(120_000);
  await loginAdmin(page);
  await page.goto("/schedule");
  await page.getByRole("tab", { name: "Appointments" }).click();
  await page.getByRole("button", { name: "CREATE COACH BOOKING" }).click();
  const modal = page.getByRole("dialog", { name: "Create coach booking" });
  await expect(modal).toBeVisible();
  await expect(modal.getByRole("radio", { name: "1 Month" })).toHaveCount(0);
  await expect(modal.getByText("Monthly offer", { exact: true })).toHaveCount(0);
});

test("coach workout editor has no render loop and create/update persist with rollback", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile-chrome");
  test.setTimeout(180_000);
  const runtimeErrors: string[] = [];
  page.on("console", (message) => {
    if (/maximum update depth/i.test(message.text())) runtimeErrors.push(message.text());
  });
  await loginMobile(page, "coach");
  await page.goto(`${mobileBaseUrl}/bookings`);
  await page.getByRole("button", { name: "Open booking filters" }).click();
  await page.getByText("Clients", { exact: true }).click();
  await page.getByRole("button", { name: "Close booking filters" }).click();
  await page.getByText("Ava Rivera", { exact: true }).first().click();
  await page.getByText("Workout", { exact: true }).click();
  await expect(page.getByText("CLIENT WORKOUT PROGRAMS", { exact: true })).toBeVisible();
  await page.waitForTimeout(1_500);
  expect(runtimeErrors).toEqual([]);

  const existingEdit = page.getByRole("button", { name: /^Edit / }).first();
  const originalTitle = "Active PPL Rest Split";
  const temporaryTitle = `${originalTitle} Runtime`;
  await existingEdit.click();
  const titleInput = page.getByLabel("Client workout program name");
  await titleInput.click();
  await page.keyboard.press("Control+A");
  await page.keyboard.press("Backspace");
  await expect(titleInput).toHaveValue("");
  await page.getByRole("button", { name: "SAVE PROGRAM" }).click();
  await expect(page.getByText("Give this program a clear name.", { exact: true })).toBeVisible();
  await titleInput.fill(temporaryTitle);
  await page.getByRole("button", { name: "SAVE PROGRAM" }).click();
  await page.getByRole("button", { name: "CANCEL" }).click();
  await expect(titleInput).toHaveValue(temporaryTitle);
  await page.getByRole("button", { name: "SAVE PROGRAM" }).click();
  const updateResponse = page.waitForResponse((response) => response.request().method() === "PUT" && /\/fitness\/plans\/[^/]+$/.test(new URL(response.url()).pathname));
  await page.getByRole("button", { name: "SAVE CHANGES" }).click();
  expect((await updateResponse).ok()).toBe(true);
  await expect(page.getByText("Client program changes saved.", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: `Edit ${temporaryTitle}` }).click();
  await expect(titleInput).toHaveValue(temporaryTitle);
  await screenshot(page, testInfo, "coach-program-update-refetched");
  await titleInput.fill(originalTitle);
  await page.getByRole("button", { name: "SAVE PROGRAM" }).click();
  await page.getByRole("button", { name: "SAVE CHANGES" }).click();
  await expect(page.getByText("Client program changes saved.", { exact: true })).toBeVisible();

  const createAction = page.getByRole("button", { name: "CREATE PROGRAM" });
  if (!(await createAction.isVisible().catch(() => false))) {
    await expect(page.getByText("This one-session entitlement already has its workout program. Open it above to edit.", { exact: true })).toBeVisible();
    expect(runtimeErrors).toEqual([]);
    return;
  }
  await createAction.click();
  const createdTitle = `Runtime Assigned ${Date.now()}`;
  await page.getByLabel("Client workout program name").fill(createdTitle);
  const recurrenceChoices = page.getByRole("radio", { name: /week|paid period/i });
  expect(await recurrenceChoices.count()).toBeGreaterThan(0);
  await page.getByRole("button", { name: /Week 1 .* not selected/ }).first().click();
  await page.getByRole("button", { name: /^Add / }).first().click();
  await page.getByRole("button", { name: "SAVE PROGRAM" }).click();
  await page.getByRole("button", { name: "CANCEL" }).click();
  await expect(page.getByLabel("Client workout program name")).toHaveValue(createdTitle);
  await page.getByRole("button", { name: "SAVE PROGRAM" }).click();
  const createResponsePromise = page.waitForResponse((response) => response.request().method() === "POST" && new URL(response.url()).pathname === "/fitness/plans");
  await page.getByRole("button", { name: "CREATE PROGRAM" }).click();
  const createResponse = await createResponsePromise;
  expect(createResponse.ok()).toBe(true);
  const createBody = await createResponse.json() as { data?: { id?: string }; id?: string };
  const createdPlanId = createBody.data?.id ?? createBody.id;
  expect(createdPlanId).toBeTruthy();
  await expect(page.getByText("Client program saved and assigned.", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: `Edit ${createdTitle}` })).toBeVisible();
  const authorization = createResponse.request().headers()["authorization"];
  const deleteResponse = await page.request.delete(`${new URL(createResponse.url()).origin}/fitness/plans/${createdPlanId}`, {
    headers: authorization ? { authorization } : undefined,
  });
  expect(deleteResponse.ok()).toBe(true);
  await testInfo.attach("created-program-rollback", {
    body: JSON.stringify({ createdPlanId, createdTitle, deleteStatus: deleteResponse.status() }),
    contentType: "application/json",
  });
  expect(runtimeErrors).toEqual([]);
});
