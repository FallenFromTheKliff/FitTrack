import assert from "node:assert/strict";
import test from "node:test";

import {
  beginSidebarClose,
  beginSidebarLogout,
  beginSidebarNavigation,
  canOpenAutoHelpRequest,
  completeSidebarDismissal,
  createSidebarActionState,
  discardPendingSidebarAction,
  usesIosNativeModalCoordination,
} from "./sidebar-lifecycle.ts";

test("iOS navigation and logout wait for native dismissal", () => {
  const navigation = beginSidebarNavigation(
    createSidebarActionState(),
    "/(tabs)/nutrition",
    true,
  );
  assert.equal(navigation.shouldClose, true);
  assert.equal(navigation.action, null);
  assert.deepEqual(navigation.state.pending, {
    kind: "navigate",
    route: "/(tabs)/nutrition",
  });

  const logout = beginSidebarLogout(createSidebarActionState(), true);
  assert.equal(logout.shouldClose, true);
  assert.equal(logout.action, null);
  assert.deepEqual(completeSidebarDismissal(logout.state).action, { kind: "logout" });
});

test("animation completion alone cannot consume a pending iOS action", () => {
  const navigation = beginSidebarNavigation(
    createSidebarActionState(),
    "/(tabs)/mastery",
    true,
  );
  assert.deepEqual(navigation.state.pending, {
    kind: "navigate",
    route: "/(tabs)/mastery",
  });
  assert.deepEqual(completeSidebarDismissal(navigation.state).action, navigation.state.pending);
});

test("duplicate taps and dismissal callbacks execute an action only once", () => {
  const first = beginSidebarNavigation(
    createSidebarActionState(),
    "/(tabs)/nutrition",
    true,
  );
  const duplicate = beginSidebarLogout(first.state, true);
  assert.equal(duplicate.accepted, false);

  const dismissed = completeSidebarDismissal(first.state);
  assert.deepEqual(dismissed.action, {
    kind: "navigate",
    route: "/(tabs)/nutrition",
  });
  assert.equal(completeSidebarDismissal(dismissed.state).action, null);
});

test("route or account changes discard a stale pending action", () => {
  const queued = beginSidebarNavigation(
    createSidebarActionState(),
    "/(tabs)/mastery",
    true,
  );
  const discarded = discardPendingSidebarAction(queued.state);
  assert.equal(discarded.dismissing, true);
  assert.equal(completeSidebarDismissal(discarded).action, null);
});

test("current-route and backdrop dismissal close without an action", () => {
  const currentRouteClose = beginSidebarClose(createSidebarActionState(), true);
  assert.equal(currentRouteClose.shouldClose, true);
  assert.equal(completeSidebarDismissal(currentRouteClose.state).action, null);

  const backdropClose = beginSidebarClose(createSidebarActionState(), true);
  assert.equal(completeSidebarDismissal(backdropClose.state).action, null);
});

test("Android and web actions remain immediate without onDismiss", () => {
  assert.equal(usesIosNativeModalCoordination("android"), false);
  assert.equal(usesIosNativeModalCoordination("web"), false);
  assert.equal(usesIosNativeModalCoordination("ios"), true);
  const navigation = beginSidebarNavigation(
    createSidebarActionState(),
    "/(tabs)/nutrition",
    false,
  );
  assert.deepEqual(navigation.action, {
    kind: "navigate",
    route: "/(tabs)/nutrition",
  });
  assert.equal(navigation.shouldClose, true);

  const logout = beginSidebarLogout(createSidebarActionState(), false);
  assert.deepEqual(logout.action, { kind: "logout" });
  assert.equal(logout.shouldClose, false);
});

test("automatic Help rejects stale routes and pending Sign Out", () => {
  const base = {
    requestId: 4,
    currentRequestId: 4,
    expectedUserId: "member-1",
    currentUserId: "member-1",
    expectedScreen: "nutrition",
    currentScreen: "nutrition",
    isEligible: true,
    sidebarTransitionActive: false,
    sidebarLifecycle: { phase: "closed", pendingAction: null },
    logoutHasPriority: false,
  };
  assert.equal(canOpenAutoHelpRequest(base), true);
  assert.equal(
    canOpenAutoHelpRequest({ ...base, currentScreen: "mastery" }),
    false,
  );
  assert.equal(
    canOpenAutoHelpRequest({
      ...base,
      sidebarLifecycle: { phase: "dismissing", pendingAction: "logout" },
      logoutHasPriority: true,
    }),
    false,
  );
});
