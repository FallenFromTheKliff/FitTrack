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

test("facilities editing controls remain compact and reachable", async ({ page }) => {
  test.setTimeout(60_000);
  const consoleErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });

  await loginAsAdmin(page);
  await page.goto("/facilities");
  await expect(
    page.getByRole("heading", { name: "Facilities", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Facilities Planner", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Asset Library", { exact: true })).toBeVisible();
  await expect(page.getByText("Available Equipment", { exact: true })).toHaveCount(0);
  await expect(page.getByText(/\d+\/\d+ available/)).toBeVisible();

  const toolNames: Array<string | RegExp> = [
    "Select canvas tool",
    "Pan canvas",
    "Building Paint",
    "Building Erase",
    "Rectangle Fill",
    "Path Paint",
    "Erase",
    "Set Entry",
    "Set Exit",
    "Fit view",
    /^(?:Edit layout|Editing)$/,
    "Apply map cells",
  ];

  for (const width of [1920, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    for (const name of toolNames) {
      const control = page
        .getByRole("button", {
          name,
          exact: typeof name === "string",
        })
        .first();
      await expect(control).toBeVisible();
      const rect = await control.boundingBox();
      expect(rect, `${name} has no visible bounds at ${width}px`).not.toBeNull();
      expect(rect!.x, `${name} starts outside the viewport at ${width}px`).toBeGreaterThanOrEqual(0);
      expect(
        rect!.x + rect!.width,
        `${name} is clipped at ${width}px`,
      ).toBeLessThanOrEqual(width);
    }

    if (width === 1920) {
      const floorControl = page.getByLabel("Facilities floor selector");
      const selectControl = page
        .getByRole("button", { name: "Select canvas tool", exact: true })
        .first();
      const [floorRect, selectRect] = await Promise.all([
        floorControl.boundingBox(),
        selectControl.boundingBox(),
      ]);
      expect(floorRect, "Floor selector has no visible bounds").not.toBeNull();
      expect(selectRect, "Select tool has no visible bounds").not.toBeNull();
      const floorCenterY = floorRect!.y + floorRect!.height / 2;
      const selectCenterY = selectRect!.y + selectRect!.height / 2;
      expect(
        Math.abs(floorCenterY - selectCenterY),
        "Canvas tools are not aligned with the planner controls",
      ).toBeLessThanOrEqual(18);
    }

    const horizontalOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(horizontalOverflow).toBeLessThanOrEqual(1);
  }

  expect(consoleErrors).toEqual([]);
});
