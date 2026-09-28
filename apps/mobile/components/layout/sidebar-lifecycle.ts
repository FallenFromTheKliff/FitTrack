export type SidebarPendingAction<Route extends string = string> =
  | { kind: "navigate"; route: Route }
  | { kind: "logout" };

export type SidebarActionState<Route extends string = string> = {
  dismissing: boolean;
  pending: SidebarPendingAction<Route> | null;
};

export type SidebarActionDecision<Route extends string = string> = {
  accepted: boolean;
  action: SidebarPendingAction<Route> | null;
  shouldClose: boolean;
  state: SidebarActionState<Route>;
};

export type SidebarLifecyclePhase =
  | "closed"
  | "presenting"
  | "open"
  | "dismissing";

export type SidebarLifecycleSnapshot = {
  phase: SidebarLifecyclePhase;
  pendingAction: SidebarPendingAction["kind"] | null;
};

export function usesIosNativeModalCoordination(platform: string) {
  return platform === "ios";
}

export function createSidebarActionState<Route extends string = string>(): SidebarActionState<Route> {
  return { dismissing: false, pending: null };
}

function rejectedDecision<Route extends string>(
  state: SidebarActionState<Route>,
): SidebarActionDecision<Route> {
  return { accepted: false, action: null, shouldClose: false, state };
}

export function beginSidebarNavigation<Route extends string>(
  state: SidebarActionState<Route>,
  route: Route,
  waitForNativeDismissal: boolean,
): SidebarActionDecision<Route> {
  if (state.dismissing) return rejectedDecision(state);
  const action: SidebarPendingAction<Route> = { kind: "navigate", route };
  if (!waitForNativeDismissal) {
    return { accepted: true, action, shouldClose: true, state };
  }
  return {
    accepted: true,
    action: null,
    shouldClose: true,
    state: { dismissing: true, pending: action },
  };
}

export function beginSidebarLogout<Route extends string>(
  state: SidebarActionState<Route>,
  waitForNativeDismissal: boolean,
): SidebarActionDecision<Route> {
  if (state.dismissing) return rejectedDecision(state);
  const action: SidebarPendingAction<Route> = { kind: "logout" };
  if (!waitForNativeDismissal) {
    return { accepted: true, action, shouldClose: false, state };
  }
  return {
    accepted: true,
    action: null,
    shouldClose: true,
    state: { dismissing: true, pending: action },
  };
}

export function beginSidebarClose<Route extends string>(
  state: SidebarActionState<Route>,
  waitForNativeDismissal: boolean,
): SidebarActionDecision<Route> {
  if (state.dismissing) return rejectedDecision(state);
  return {
    accepted: true,
    action: null,
    shouldClose: true,
    state: waitForNativeDismissal
      ? { dismissing: true, pending: null }
      : state,
  };
}

export function completeSidebarDismissal<Route extends string>(
  state: SidebarActionState<Route>,
) {
  if (!state.dismissing) return { action: null, state };
  return {
    action: state.pending,
    state: createSidebarActionState<Route>(),
  };
}

export function discardPendingSidebarAction<Route extends string>(
  state: SidebarActionState<Route>,
): SidebarActionState<Route> {
  return state.pending ? { ...state, pending: null } : state;
}

export function getSidebarLifecycleSnapshot<Route extends string>(
  phase: SidebarLifecyclePhase,
  state: SidebarActionState<Route>,
): SidebarLifecycleSnapshot {
  return { phase, pendingAction: state.pending?.kind ?? null };
}

export function canOpenAutoHelpRequest<Screen extends string>({
  requestId,
  currentRequestId,
  expectedUserId,
  currentUserId,
  expectedScreen,
  currentScreen,
  isEligible,
  sidebarTransitionActive,
  sidebarLifecycle,
  logoutHasPriority,
}: {
  requestId: number;
  currentRequestId: number;
  expectedUserId: string;
  currentUserId: string | null;
  expectedScreen: Screen;
  currentScreen: Screen;
  isEligible: boolean;
  sidebarTransitionActive: boolean;
  sidebarLifecycle: SidebarLifecycleSnapshot;
  logoutHasPriority: boolean;
}) {
  return (
    requestId === currentRequestId &&
    expectedUserId === currentUserId &&
    expectedScreen === currentScreen &&
    isEligible &&
    !sidebarTransitionActive &&
    sidebarLifecycle.phase === "closed" &&
    sidebarLifecycle.pendingAction !== "logout" &&
    !logoutHasPriority
  );
}
