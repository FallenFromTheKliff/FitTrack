import assert from "node:assert/strict";
import test from "node:test";
import { createMembershipApi } from "./membership";

test("maps server-filtered membership access candidates and preserves free-pass expiry", async () => {
  const transport = {
    get: async (path: string) => {
      assert.equal(path, "/membership/access-management/candidates");
      return {
        data: [
          {
            member_id: "member-1",
            display_name: "Maria Santos",
            email: "maria.santos@fittrack.com",
            membership_card_status: null,
            subscription_id: null,
            subscription_status: null,
            plan_name: null,
            starts_at: null,
            expires_at: null,
            free_pass_expires_at: "2026-08-29T10:00:00.000Z",
          },
        ],
      };
    },
  };

  const result = await createMembershipApi(transport as never).listMembershipAccessCandidates({
    action: "revoke",
    product: "free_day_pass",
    search: "  Maria Santos  ",
  });

  assert.deepEqual(result[0], {
    memberId: "member-1",
    displayName: "Maria Santos",
    email: "maria.santos@fittrack.com",
    membershipCardStatus: null,
    subscriptionId: null,
    subscriptionStatus: null,
    planName: null,
    startsAt: null,
    expiresAt: null,
    freePassExpiresAt: "2026-08-29T10:00:00.000Z",
  });
});

test("maps free-pass grant and revoke lifecycle responses", async () => {
  const calls: Array<{ method: string; path: string; body?: unknown }> = [];
  const response = {
    data: {
      message: "Free one-day pass granted.",
      member_id: "member-1",
      granted_at: "2026-08-28T10:00:00.000Z",
      expires_at: "2026-08-29T10:00:00.000Z",
      redeemed_at: null,
      revoked_at: null,
      revoke_reason: null,
    },
  };
  const transport = {
    post: async (path: string, body: unknown) => {
      calls.push({ method: "post", path, body });
      return response;
    },
    patch: async (path: string, body: unknown) => {
      calls.push({ method: "patch", path, body });
      return response;
    },
  };
  const api = createMembershipApi(transport as never);

  const granted = await api.grantFreeDayPass("member-1");
  const revoked = await api.revokeFreeDayPass("member-1", {
    reason: "  undo  ",
  });

  assert.equal(granted.expiresAt, "2026-08-29T10:00:00.000Z");
  assert.equal(revoked.memberId, "member-1");
  assert.deepEqual(calls, [
    {
      method: "post",
      path: "/membership/access-management/free-day-pass/grant",
      body: { member_id: "member-1" },
    },
    {
      method: "patch",
      path: "/membership/access-management/free-day-pass/member-1/revoke",
      body: { reason: "undo" },
    },
  ]);
});
