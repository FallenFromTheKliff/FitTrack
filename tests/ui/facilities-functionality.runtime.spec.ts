import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { expect, test, type Page } from "@playwright/test";

type SeedManifest = {
  credentials: Array<{ email: string; password: string; role: string }>;
};

async function loginAsAdmin(page: Page) {
  const manifest = JSON.parse(
    await readFile(
      resolve(process.cwd(), ".artifacts", "test-data-manifest.json"),
      "utf8",
    ),
  ) as SeedManifest;
  const credential = manifest.credentials.find(
    (candidate) => candidate.role.toLowerCase() === "admin",
  );
  if (!credential) throw new Error("Seeded admin credential is unavailable");

  await page.goto("/login");
  await page.getByLabel("Email Address").fill(credential.email);
  await page.getByRole("textbox", { name: "Password" }).fill(credential.password);
  await page.getByRole("button", { name: /sign in/i }).click();
  await expect(page).toHaveURL(/\/(?:dashboard|analytics|schedule)(?:\?|$)/, {
    timeout: 20_000,
  });
}

async function archiveVenue(page: Page, venueName: string) {
  await page.getByRole("button", { name: `More actions for ${venueName}` }).click();
  await page.getByRole("button", { name: "Archive", exact: true }).last().click();
  await expect(page.getByText(`Archive ${venueName}?`, { exact: true })).toBeVisible();
  const archiveResponsePromise = page.waitForResponse(
    (response) =>
      response.url().includes("/bookings/amenities/") &&
      response.request().method() === "DELETE",
  );
  await page.getByRole("button", { name: "ARCHIVE VENUE", exact: true }).click();
  const archiveResponse = await archiveResponsePromise;
  expect(archiveResponse.ok(), await archiveResponse.text()).toBeTruthy();
  await expect(page.getByText(venueName, { exact: true })).toHaveCount(0);
}

test("venue creation starts valid, persists, and can be cleaned up", async ({ page }) => {
  test.setTimeout(60_000);
  const consoleErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });

  await loginAsAdmin(page);
  await page.goto("/facilities");
  await expect(page.getByText("Facilities Planner", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Venues", exact: true }).first().click();
  await expect(page.getByText("Reception", { exact: true })).toBeVisible();
  const staleQaVenue = page.getByText(/^QA Functional Venue \d+$/).first();
  if (await staleQaVenue.count()) {
    await archiveVenue(page, (await staleQaVenue.textContent())!);
  }

  await page.getByRole("button", { name: /add venue/i }).click();
  await expect(page.getByRole("heading", { name: "Add Venue", exact: true })).toBeVisible();
  const testVenueName = `QA Functional Venue ${Date.now()}`;
  await page.getByLabel("Name*").fill(testVenueName);
  await page.getByLabel("Capacity*").fill("4");
  await page.getByRole("button", { name: "Facility Only", exact: true }).click();
  await page.getByRole("button", { name: "NEXT: PLACEMENT", exact: true }).click();

  await page.getByLabel("Column*").fill("1");
  await page.getByLabel("Row*").fill("1");

  const createResponsePromise = page.waitForResponse(
    (response) =>
      response.url().includes("/bookings/amenities") &&
      response.request().method() === "POST",
  );
  await page.getByRole("button", { name: "SAVE VENUE", exact: true }).click();
  const createResponse = await createResponsePromise;
  expect(createResponse.ok(), await createResponse.text()).toBeTruthy();
  const createPayload = createResponse.request().postDataJSON() as {
    grid_column: number;
    grid_row: number;
  };
  expect([createPayload.grid_column, createPayload.grid_row]).not.toEqual([1, 1]);

  await expect(page.getByText(testVenueName, { exact: true })).toBeVisible();
  await archiveVenue(page, testVenueName);
  expect(consoleErrors).toEqual([]);
});

async function firstVenueNodePoint(page: Page) {
  return page.evaluate(() => {
    const stages = (window as typeof window & {
      Konva?: {
        stages?: Array<{
          container: () => HTMLElement;
          find: (predicate: (node: { getAttr: (key: string) => unknown }) => boolean) => Array<{
            draggable: () => boolean;
            getClientRect: () => { height: number; width: number; x: number; y: number };
          }>;
        }>;
      };
    }).Konva?.stages;
    const stage = stages?.[0];
    if (!stage) throw new Error("Facilities Konva stage is unavailable");
    const node = stage
      .find((candidate) => Boolean(candidate.getAttr("venueMapId")))
      .sort((left, right) => left.getClientRect().x - right.getClientRect().x)[0];
    if (!node) throw new Error("No venue node is rendered");
    const rect = node.getClientRect();
    const container = stage.container().getBoundingClientRect();
    return {
      cellHeight: (rect.height + 12) / 2,
      draggable: node.draggable(),
      x: container.x + rect.x + rect.width / 2,
      y: container.y + rect.y + rect.height / 2,
    };
  });
}

test("reception drag persists through a fresh facilities reload", async ({ page }) => {
  test.setTimeout(60_000);
  await loginAsAdmin(page);
  await page.goto("/facilities");
  await expect(page.getByText("Facilities Planner", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Edit layout", exact: true }).click();

  await expect(page.locator(".konvajs-content").first()).toBeVisible();
  const reception = await firstVenueNodePoint(page);
  expect(reception.draggable).toBeTruthy();
  const moveResponsePromise = page.waitForResponse(
    (response) =>
      response.url().includes("/bookings/amenities/") &&
      response.request().method() === "PUT",
  );
  await page.mouse.move(reception.x, reception.y);
  await page.mouse.down();
  await page.mouse.move(reception.x, reception.y + reception.cellHeight * 2, {
    steps: 12,
  });
  await page.mouse.up();
  const moveResponse = await Promise.race([
    moveResponsePromise,
    page.waitForTimeout(2_000).then(async () => {
      const messages = (await page.locator("body").innerText())
        .split("\n")
        .filter((line) =>
          /placement|overlap|layout updated|building footprint|navigation cell/i.test(line),
        );
      throw new Error(`No venue save request after drag. UI messages: ${messages.join(" | ")}`);
    }),
  ]);
  expect(moveResponse.ok(), await moveResponse.text()).toBeTruthy();

  const reloadVenuesPromise = page.waitForResponse(
    (response) =>
      response.url().includes("/bookings/amenities/operations") &&
      response.request().method() === "GET",
  );
  await page.reload();
  const reloadVenues = await reloadVenuesPromise;
  const reloadPayload = (await reloadVenues.json()) as {
    data: Array<{ name: string; grid_column: number; grid_row: number }>;
  };
  const movedReception = reloadPayload.data.find((venue) => venue.name === "Reception");
  expect(movedReception).toMatchObject({ grid_column: 1, grid_row: 3 });

  await page.getByRole("button", { name: "Edit layout", exact: true }).click();
  const movedPoint = await firstVenueNodePoint(page);
  const restoreResponsePromise = page.waitForResponse(
    (response) =>
      response.url().includes("/bookings/amenities/") &&
      response.request().method() === "PUT",
  );
  await page.mouse.move(movedPoint.x, movedPoint.y);
  await page.mouse.down();
  await page.mouse.move(movedPoint.x, movedPoint.y - movedPoint.cellHeight * 2, {
    steps: 12,
  });
  await page.mouse.up();
  const restoreResponse = await restoreResponsePromise;
  expect(restoreResponse.ok(), await restoreResponse.text()).toBeTruthy();
});
