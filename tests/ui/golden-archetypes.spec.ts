import { expect, test } from "@playwright/test";

const GOLDEN_STORIES = [
  {
    id: "fittrack-golden-archetypes--resource-list-table",
    snapshot: "resource-list-table.png",
  },
  {
    id: "fittrack-golden-archetypes--entity-detail",
    snapshot: "entity-detail.png",
  },
  {
    id: "fittrack-golden-archetypes--create-edit-transaction",
    snapshot: "create-edit-transaction.png",
  },
] as const;

for (const story of GOLDEN_STORIES) {
  test(`matches ${story.id}`, async ({ page }) => {
    await page.goto(`/iframe.html?id=${story.id}&viewMode=story`);

    const capture = page.locator('[data-fittrack-capture="true"]');
    await expect(capture).toBeVisible({ timeout: 30_000 });
    await expect(capture).toHaveScreenshot(story.snapshot);
  });
}
