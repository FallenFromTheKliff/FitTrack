import { expect, test, type Locator, type Page } from "@playwright/test";

const MEMBER_ID = "11111111-1111-4111-8111-111111111111";
const MEMBER_EMAIL = "member-profile-edit@fittrack.test";
const MEMBER_PHONE = "+639171234567";
const MEMBER_DOB = "1998-04-12";

type RequestCapture = {
  profile: Array<Record<string, unknown>>;
  phone: Array<Record<string, unknown>>;
};

function profileResponse() {
  return {
    data: {
      id: MEMBER_ID,
      email: MEMBER_EMAIL,
      role: "USER",
      emailVerified: true,
      hasAcceptedPrivacy: true,
      phone_no: MEMBER_PHONE,
      membership_card: null,
      profile: {
        first_name: "Luca",
        last_name: "Dela Cruz",
        date_of_birth: MEMBER_DOB,
        gender: "female",
        weight_kg: 68,
        height_cm: 172,
        avatar_url: null,
      },
    },
  };
}

async function installMemberFixtures(page: Page, capture: RequestCapture) {
  await page.addInitScript(() => {
    window.localStorage.setItem("fittrack_access_token", "member-profile-edit-token");
    window.localStorage.setItem("fittrack_refresh_token", "member-profile-edit-refresh-token");
  });

  await page.route("**/users/me", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(profileResponse()),
      });
      return;
    }

    if (route.request().method() === "PATCH") {
      capture.profile.push((route.request().postDataJSON() ?? {}) as Record<string, unknown>);
      await route.fulfill({ status: 204, body: "" });
      return;
    }

    await route.continue();
  });

  await page.route("**/users/me/phone", async (route) => {
    if (route.request().method() === "PATCH") {
      capture.phone.push((route.request().postDataJSON() ?? {}) as Record<string, unknown>);
      await route.fulfill({ status: 204, body: "" });
      return;
    }
    await route.continue();
  });

  await page.route("**/membership/my-subscription**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ data: null }),
    });
  });

  await page.route("**/notifications/my**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ data: [], meta: { page: 1, limit: 8, total: 0, total_pages: 0 } }),
    });
  });

  await page.route("**/notifications/unread-count**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ data: { count: 0 } }),
    });
  });
}

async function openEditor(page: Page) {
  await page.goto("/profile", { waitUntil: "domcontentloaded" });
  await expect(page).toHaveURL(/\/profile(?:\?|$)/);
  const editProfile = page.getByRole("button", { name: /^Edit Profile\b/i });
  await expect(editProfile).toBeVisible();
  await editProfile.click();
  await expect(page).toHaveURL(/\/profile(?:\?|$)/);
  const dialog = page.getByRole("dialog", { name: /edit profile/i }).last();
  await expect(dialog).toBeVisible();
  return dialog;
}

function field(dialog: Locator, name: string) {
  return dialog.getByLabel(new RegExp(`^${name}$`, "i"));
}

async function assertModalFitsViewport(page: Page, dialog: Locator) {
  const viewport = await page.evaluate(() => ({ width: innerWidth, height: innerHeight }));
  const [dialogBox, cancelBox] = await Promise.all([
    dialog.boundingBox(),
    dialog.getByRole("button", { name: /cancel/i }).last().boundingBox(),
  ]);
  expect(dialogBox, "profile editor dialog should have bounds").not.toBeNull();
  expect(cancelBox, "profile editor footer should be reachable").not.toBeNull();
  if (dialogBox && cancelBox) {
    expect(dialogBox.x).toBeGreaterThanOrEqual(-1);
    expect(dialogBox.x + dialogBox.width).toBeLessThanOrEqual(viewport.width + 1);
    expect(cancelBox.y + cancelBox.height).toBeLessThanOrEqual(viewport.height + 2);
  }
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
    "profile editor must not introduce horizontal overflow",
  ).toBe(true);
}

test.describe("member web profile editor", () => {
  const viewports = [
    { height: 1080, label: "desktop", width: 1920 },
    { height: 844, label: "mobile web", width: 390 },
  ];

  for (const viewport of viewports) {
    test(`${viewport.label} opens the mobile-equivalent editor, validates locally, and guards save`, async ({ page }, testInfo) => {
    test.setTimeout(90_000);
    test.skip(testInfo.project.name !== "desktop-chrome", "This web profile spec must not target the Expo web project.");
    await page.setViewportSize({ width: viewport.width, height: viewport.height });

    const capture: RequestCapture = { profile: [], phone: [] };
    await installMemberFixtures(page, capture);
    const dialog = await openEditor(page);
    await assertModalFitsViewport(page, dialog);

    await expect(dialog.getByRole("tab", { name: "Personal", exact: true })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await expect(field(dialog, "First Name")).toHaveValue("Luca");
    await expect(field(dialog, "Last Name")).toHaveValue("Dela Cruz");
    await expect(field(dialog, "Email")).toHaveValue(MEMBER_EMAIL);
    await expect(field(dialog, "Email")).toBeDisabled();
    await expect(field(dialog, "Phone")).toHaveValue("9171234567");
    const dateOfBirth = dialog.getByRole("button", { name: /Date of Birth:/i });
    await expect(dateOfBirth).toHaveAccessibleName(/Date of Birth: Apr 12, 1998/i);

    const genderRadios = dialog.getByRole("radio");
    await expect(genderRadios).toHaveCount(3);
    await expect(dialog.getByRole("radio", { name: "Female", exact: true })).toBeChecked();

    const firstName = field(dialog, "First Name");
    const lastName = field(dialog, "Last Name");
    const phone = field(dialog, "Phone");
    const personalAlerts = dialog.getByRole("alert");
    await firstName.fill("1");
    await firstName.blur();
    await expect(personalAlerts).toHaveCount(1);
    await expect(personalAlerts.first()).toContainText(/required|at least 2|letters/i);
    await lastName.fill("!");
    await lastName.blur();
    await expect(personalAlerts).toHaveCount(2);
    await expect(personalAlerts.nth(1)).toContainText(/required|letters|valid/i);
    await phone.fill("123");
    await phone.blur();
    await expect(personalAlerts).toHaveCount(3);
    await expect(personalAlerts.nth(2)).toContainText(/valid.*mobile|PH mobile/i);

    await dialog.getByRole("tab", { name: "Fitness", exact: true }).click();
    await expect(dialog.getByRole("tab", { name: "Fitness", exact: true })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await expect(field(dialog, "Role")).toHaveValue(/.+/);
    await expect(field(dialog, "Tier")).toHaveValue(/.+/);
    await expect(field(dialog, "Member Since")).toHaveValue(/.+/);
    const weight = dialog.getByRole("textbox", { name: "Weight in kilograms" });
    const height = dialog.getByRole("textbox", { name: "Height in centimeters" });
    await weight.fill("");
    await weight.blur();
    await expect(dialog.getByRole("alert").filter({ hasText: /required/i })).toBeVisible();
    await height.fill("-1");
    await height.blur();
    await expect(dialog.getByRole("alert").filter({ hasText: /positive|numeric|valid/i })).toBeVisible();

    await dialog.getByRole("tab", { name: "Personal", exact: true }).click();
    await dateOfBirth.click();
    const calendar = page.getByRole("dialog").filter({ hasText: /Today|Clear/ }).last();
    await expect(calendar).toBeVisible();
    await expect(calendar.getByRole("button", { name: /Select \d{4}-\d{2}-\d{2}/ }).first()).toBeVisible();
    await calendar.getByRole("button", { name: "Close calendar", exact: true }).click();
    await expect(calendar).not.toBeVisible();

    await firstName.fill("Changed");
    await dialog.getByRole("button", { name: /cancel/i }).last().click();
    await expect(dialog).not.toBeVisible();
    expect(capture.profile).toEqual([]);
    expect(capture.phone).toEqual([]);

    const reopened = await openEditor(page);
    await expect(field(reopened, "First Name")).toHaveValue("Luca");
    await field(reopened, "First Name").fill("Lucia");
    await reopened.getByRole("button", { name: /save/i }).last().click();

    const confirmation = page.getByRole("dialog", { name: /save profile changes/i }).last();
    await expect(confirmation).toBeVisible();
    await expect(confirmation).toContainText(/confirm|review/i);
    await expect(confirmation.getByRole("button", { name: "KEEP EDITING", exact: true })).toBeVisible();
    await confirmation.getByRole("button", { name: "KEEP EDITING", exact: true }).click();
    await expect(confirmation).not.toBeVisible();
    await expect(reopened).toBeVisible();
    expect(capture.profile).toEqual([]);
    expect(capture.phone).toEqual([]);

    await reopened.getByRole("button", { name: /save changes/i }).last().click();
    await expect(page.getByRole("dialog", { name: /save profile changes/i }).last()).toBeVisible();
    await page
      .getByRole("dialog", { name: /save profile changes/i })
      .last()
      .getByRole("button", { name: "CONFIRM SAVE", exact: true })
      .click();
    await expect(reopened).not.toBeVisible();
    expect(capture.profile).toHaveLength(1);
    expect(capture.profile[0]).toMatchObject({
      first_name: "Lucia",
      last_name: "Dela Cruz",
      date_of_birth: MEMBER_DOB,
      weight_kg: 68,
      height_cm: 172,
    });
    expect(capture.phone).toEqual([]);
    });
  }
});
