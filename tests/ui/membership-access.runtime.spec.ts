import { expect, test, type Page } from "@playwright/test";

function candidate(product: string, action: string) {
  return {
    member_id: "33333333-3333-4333-8333-333333333333",
    display_name:
      product === "membership_card"
        ? "Membership Card Revoke Candidate"
        : action === "grant"
          ? "Free Pass Grant Candidate"
          : "Free Pass Revoke Candidate",
    email: "membership-access-runtime@fittrack.test",
    membership_card_status:
      product === "membership_card" && action === "revoke" ? "active" : null,
    subscription_id: null,
    subscription_status: null,
    plan_name: null,
    starts_at: null,
    expires_at: null,
    free_pass_expires_at:
      product === "free_day_pass" && action === "revoke"
        ? "2026-08-29T12:00:00.000Z"
        : null,
  };
}

test("membership access shows server candidates and confirms free-pass grant/revoke", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chrome");
  test.setTimeout(120_000);

  const candidateRequests: string[] = [];
  let grantCalls = 0;
  let revokeCalls = 0;
  let cardRevokeCalls = 0;
  let cardRevokeCandidateRequests = 0;
  let grantBody: Record<string, unknown> | null = null;
  let revokeBody: Record<string, unknown> | null = null;
  let cardRevokeBody: Record<string, unknown> | null = null;
  let membershipCardRevoked = false;

  await page.route("**/membership/access-management/candidates**", async (route) => {
    if (route.request().method() !== "GET") {
      throw new Error("Membership candidate route received a non-GET request.");
    }
    const url = new URL(route.request().url());
    const action = url.searchParams.get("action") ?? "";
    const product = url.searchParams.get("product") ?? "";
    candidateRequests.push(`${action}:${product}`);
    if (action === "revoke" && product === "membership_card") {
      cardRevokeCandidateRequests += 1;
    }
    const hasCandidate =
      product === "free_day_pass" && ["grant", "revoke"].includes(action)
        ? true
        : product === "membership_card" &&
            action === "revoke" &&
            !membershipCardRevoked;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: hasCandidate ? [candidate(product, action)] : [],
      }),
    });
  });

  // Keep this UI contract test independent from local seed state. The page still
  // exercises the authenticated layout, while all access data and mutations are
  // intercepted below and never touch a real account.
  await page.addInitScript(() => {
    window.localStorage.setItem("fittrack_access_token", "membership-ui-test-token");
  });
  await page.route("**/users/me", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: {
          id: "11111111-1111-4111-8111-111111111111",
          email: "membership-ui-admin@fittrack.test",
          role: "ADMIN",
          emailVerified: true,
          hasAcceptedPrivacy: true,
          profile: { first_name: "Membership", last_name: "UI Admin" },
        },
      }),
    });
  });
  await page.route("**/notifications/my**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: [],
        meta: { page: 1, limit: 8, total: 0, total_pages: 0 },
      }),
    });
  });
  await page.route("**/notifications/unread-count", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ data: { count: 0 } }),
    });
  });
  await page.route("**/membership/plans/management**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: [],
        meta: { page: 1, limit: 20, total: 0, total_pages: 0 },
      }),
    });
  });
  await page.route("**/membership/operations-dashboard", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: {
          expiring_membership_count: 0,
          expiring_memberships: [],
          generated_at: "2026-08-28T12:00:00.000Z",
          recently_activated: [],
          recently_activated_count: 0,
          total_active_members_count: 0,
        },
      }),
    });
  });
  await page.route("**/membership/catalog-settings", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ data: { membership_card_price: "400.00" } }),
    });
  });

  await page.route("**/membership/access-management/free-day-pass/grant", async (route) => {
    if (route.request().method() !== "POST") {
      throw new Error("Free-pass grant route received a non-POST request.");
    }
    grantCalls += 1;
    grantBody = route.request().postDataJSON() as Record<string, unknown>;
    await route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({
        data: {
          message: "Free one-day pass granted.",
          member_id: "33333333-3333-4333-8333-333333333333",
          granted_at: "2026-08-28T12:00:00.000Z",
          expires_at: "2026-08-29T12:00:00.000Z",
          redeemed_at: null,
          revoked_at: null,
          revoke_reason: null,
        },
      }),
    });
  });

  await page.route(
    "**/membership/access-management/free-day-pass/*/revoke",
    async (route) => {
      if (route.request().method() !== "PATCH") {
        throw new Error("Free-pass revoke route received a non-PATCH request.");
      }
      revokeCalls += 1;
      revokeBody = route.request().postDataJSON() as Record<string, unknown>;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: {
            message: "Free one-day pass revoked.",
            member_id: "33333333-3333-4333-8333-333333333333",
            granted_at: "2026-08-28T12:00:00.000Z",
            expires_at: "2026-08-29T12:00:00.000Z",
            redeemed_at: null,
            revoked_at: "2026-08-28T12:30:00.000Z",
            revoke_reason: "Runtime cleanup",
          },
        }),
      });
    },
  );
  await page.route("**/admin/users/*/membership-card", async (route) => {
    if (route.request().method() !== "PATCH") {
      throw new Error("Membership-card route received a non-PATCH request.");
    }
    cardRevokeCalls += 1;
    cardRevokeBody = route.request().postDataJSON() as Record<string, unknown>;
    membershipCardRevoked = true;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: {
          message: "Membership Card access revoked successfully.",
          membershipCard: {
            status: "revoked",
            revokeReason: "Card cleanup",
          },
        },
      }),
    });
  });

  await page.goto("/memberships", { waitUntil: "domcontentloaded" });
  const manageAccess = page.getByRole("button", {
    name: "MANAGE MEMBERSHIP ACCESS",
  });
  await expect(manageAccess).toBeVisible();
  await manageAccess.click();

  const modal = page.getByRole("dialog", { name: "Grant Membership Access" });
  await modal.getByRole("button", { name: "FREE 1-DAY PASS", exact: true }).click();
  const grantCandidate = modal.getByRole("option").first();
  await expect(grantCandidate).toContainText("Free Pass Grant Candidate");
  await grantCandidate.click();
  await modal.getByRole("button", { name: /review membership grant/i }).click();

  const grantConfirmation = page.getByRole("dialog", {
    name: "Confirm Membership Grant",
  });
  await expect(grantConfirmation).toContainText("24 hours to redeem it");
  await expect(grantConfirmation).toContainText("No payment or revenue is created");
  expect(grantCalls).toBe(0);
  await grantConfirmation.getByRole("button", { name: "GRANT ACCESS" }).click();
  await expect.poll(() => grantCalls).toBe(1);
  expect(grantBody).toEqual({ member_id: "33333333-3333-4333-8333-333333333333" });
  await expect(page.getByTestId("membership-access-success")).toContainText(
    "24 hours to redeem it",
  );

  await modal.getByRole("button", { name: "CLOSE", exact: true }).click();
  await manageAccess.click();
  const grantModal = page.getByRole("dialog", { name: "Grant Membership Access" });
  await grantModal.getByRole("button", { name: "REVOKE ACCESS" }).click();
  const revokeModal = page.getByRole("dialog", { name: "Revoke Membership Access" });
  await revokeModal.getByRole("button", { name: "FREE 1-DAY PASS", exact: true }).click();
  const revokeCandidate = revokeModal.getByRole("option").first();
  await expect(revokeCandidate).toContainText("Free Pass Revoke Candidate");
  await revokeCandidate.click();
  await revokeModal.getByLabel("Reason for revocation").fill("Runtime cleanup");
  await revokeModal
    .getByRole("button", { name: /review membership revocation/i })
    .click();

  const revokeConfirmation = page.getByRole("dialog", {
    name: "Confirm Access Revocation",
  });
  await expect(revokeConfirmation).toContainText("No refund is issued");
  await expect(revokeConfirmation).toContainText(
    "no payment record is created or deleted",
  );
  expect(revokeCalls).toBe(0);
  await revokeConfirmation.getByRole("button", { name: "REVOKE ACCESS" }).click();
  await expect.poll(() => revokeCalls).toBe(1);
  expect(revokeBody).toEqual({ reason: "Runtime cleanup" });
  await expect(page.getByTestId("membership-access-success")).toContainText(
    "Free 1-Day Pass access revoked successfully.",
  );
  expect(candidateRequests).toContain("grant:free_day_pass");
  expect(candidateRequests).toContain("revoke:free_day_pass");

  await revokeModal.getByRole("button", { name: "CLOSE", exact: true }).click();
  await manageAccess.click();
  const cardGrantModal = page.getByRole("dialog", {
    name: "Grant Membership Access",
  });
  await cardGrantModal.getByRole("button", { name: "REVOKE ACCESS" }).click();
  const cardRevokeModal = page.getByRole("dialog", {
    name: "Revoke Membership Access",
  });
  await cardRevokeModal
    .getByRole("button", { name: "MEMBERSHIP CARD", exact: true })
    .click();
  const cardCandidate = cardRevokeModal.getByRole("option").first();
  await expect(cardCandidate).toContainText("Membership Card Revoke Candidate");
  await cardCandidate.click();
  await cardRevokeModal
    .getByLabel("Reason for revocation")
    .fill("Card cleanup");
  await cardRevokeModal
    .getByRole("button", { name: /review membership revocation/i })
    .click();

  const cardConfirmation = page.getByRole("dialog", {
    name: "Confirm Access Revocation",
  });
  expect(cardRevokeCalls).toBe(0);
  await cardConfirmation.getByRole("button", { name: "REVOKE ACCESS" }).click();
  await expect.poll(() => cardRevokeCalls).toBe(1);
  await expect.poll(() => cardRevokeCandidateRequests).toBeGreaterThanOrEqual(2);
  expect(cardRevokeBody).toEqual({
    action: "revoke",
    reason: "Card cleanup",
    source: "admin_repair",
  });

  await expect(page.getByTestId("membership-access-success")).toContainText(
    "Membership Card access revoked successfully.",
  );
  await cardRevokeModal
    .getByRole("button", { name: "CLOSE", exact: true })
    .click();
  await manageAccess.click();
  const staleGrantModal = page.getByRole("dialog", {
    name: "Grant Membership Access",
  });
  await staleGrantModal.getByRole("button", { name: "REVOKE ACCESS" }).click();
  const staleRevokeModal = page.getByRole("dialog", {
    name: "Revoke Membership Access",
  });
  await staleRevokeModal
    .getByRole("button", { name: "MEMBERSHIP CARD", exact: true })
    .click();
  await expect(
    staleRevokeModal.getByText("No active Membership Card grants found."),
  ).toBeVisible();
  await expect(staleRevokeModal.getByRole("option")).toHaveCount(0);
  await expect.poll(() => cardRevokeCandidateRequests).toBeGreaterThanOrEqual(3);
});
