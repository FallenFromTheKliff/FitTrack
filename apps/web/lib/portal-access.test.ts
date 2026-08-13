import assert from "node:assert/strict";
import test from "node:test";

test("coach Clients destination is visible and route-authorized without admin access", async () => {
  const modulePath = "./portal-access.ts";
  const {
    canAccessWebPage,
    COACH_CLIENTS_PAGE_KEY,
    COACH_CLIENTS_ROUTE,
  } = await import(modulePath);
  assert.equal(COACH_CLIENTS_ROUTE, "/accounts");
  assert.equal(COACH_CLIENTS_PAGE_KEY, "coach-clients");
  assert.equal(canAccessWebPage("COACH", COACH_CLIENTS_PAGE_KEY), true);
  assert.equal(canAccessWebPage("COACH", "accounts"), false);
  assert.equal(canAccessWebPage("ADMIN", COACH_CLIENTS_PAGE_KEY), false);
  assert.equal(canAccessWebPage("USER", COACH_CLIENTS_PAGE_KEY), false);
});
