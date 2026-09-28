import { expect, test } from "@playwright/test";

test.describe("public shell", () => {
  test("renders the admin login without page-level overflow", async ({ page }) => {
    await page.goto("/login");

    await expect(page.locator("body")).toBeVisible();
    await expect(page.getByPlaceholder("team@fittrack.com")).toBeVisible();
    await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();

    const viewportFits = await page.evaluate(() => {
      const root = document.documentElement;
      return root.scrollWidth <= root.clientWidth + 1;
    });

    expect(viewportFits).toBe(true);
  });
});
