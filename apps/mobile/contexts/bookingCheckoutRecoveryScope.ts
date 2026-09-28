import type {
  CommerceCheckoutAttempt,
  CommerceCheckoutHoldState,
} from "@fittrack/api-client";

export type BookingCheckoutTerminalState = Exclude<
  CommerceCheckoutHoldState,
  "pending"
>;

export type BookingCheckoutTerminalNotice = {
  message: string;
  title: string;
};

export type BookingCheckoutIosNoticeOutcome =
  | CommerceCheckoutHoldState
  | "checkout_opened"
  | "cancelled_return"
  | "verification_error";

export type BookingCheckoutIosNoticeRequest =
  BookingCheckoutTerminalNotice & {
    holdId: string;
    outcome: BookingCheckoutIosNoticeOutcome;
    ownerGeneration?: number;
    ownerToken?: object;
    terminal: boolean;
    transitionGeneration?: number;
  };

export type BookingCheckoutIosNoticePhase =
  | "queued"
  | "presenting"
  | "visible"
  | "dismissing";

export type BookingCheckoutIosNoticePresentation = {
  cancelled: boolean;
  dismissAfterShow: boolean;
  generation: number;
  key: string;
  owned: boolean;
  owners: Map<object, number>;
  phase: BookingCheckoutIosNoticePhase;
  request: BookingCheckoutIosNoticeRequest;
  shown: boolean;
};

export type BookingCheckoutIosNoticeDecision = {
  accepted: boolean;
  generation: number | null;
  key: string;
};

export type BookingCheckoutIosHandoffListener = (
  presentation: BookingCheckoutIosNoticePresentation,
) => void;

export type BookingCheckoutIosHandoffOutcome = "cancelled" | "dismissed";

export type BookingCheckoutIosDismissalBarrier = {
  holdId: string;
  ownerGeneration: number;
  ownerToken: object;
  presentationGeneration: number;
  presentationKey: string;
};

type BookingCheckoutIosStoredDismissalBarrier =
  BookingCheckoutIosDismissalBarrier & {
    acceptedPresentationIdentities: Set<string>;
  };

type BookingCheckoutIosHandoffListenerRecord = {
  generation: number;
  listener: BookingCheckoutIosHandoffListener;
};

type BookingCheckoutIosHandoffWaiter = {
  ownerGeneration: number;
  ownerToken: object | null;
  resolve: (outcome: BookingCheckoutIosHandoffOutcome) => void;
};

export type BookingCheckoutCallbacks = {
  onCancelled?: (attempt: CommerceCheckoutAttempt) => void | Promise<void>;
  onSucceeded?: (attempt: CommerceCheckoutAttempt) => void | Promise<void>;
  onTerminal?: (
    attempt: CommerceCheckoutAttempt,
    state: BookingCheckoutTerminalState,
  ) => void | Promise<void>;
};

export type BookingCheckoutScopeListener = (
  attempt: CommerceCheckoutAttempt | null,
) => void;

export type BookingCheckoutRecoveryScope = {
  callbacks: BookingCheckoutCallbacks | null;
  disposed: boolean;
  attempt: CommerceCheckoutAttempt | null;
  iosAppActive: boolean;
  iosCancelledHandoffKeys: Set<string>;
  iosCancelledOwnerGenerations: Map<object, Set<number>>;
  iosDismissalBarriers: Map<object, BookingCheckoutIosStoredDismissalBarrier>;
  iosHandledNoticeKeys: Set<string>;
  iosHandoffListeners: Map<object, BookingCheckoutIosHandoffListenerRecord>;
  iosHandoffWaiters: Map<string, Set<BookingCheckoutIosHandoffWaiter>>;
  iosNextNotice: BookingCheckoutIosNoticePresentation | null;
  iosPresentation: BookingCheckoutIosNoticePresentation | null;
  iosPresentationGeneration: number;
  iosResultNoticeHoldIds: Set<string>;
  iosTerminalOutcomeByHoldId: Map<string, BookingCheckoutIosNoticeOutcome>;
  listeners: Map<object, BookingCheckoutScopeListener>;
  operationToken: object | null;
  ownerToken: object | null;
  sessionKey: string | null;
  terminalHandledKey: string | null;
  notice: BookingCheckoutTerminalNotice | null;
  acknowledgeIosNoticeDismissed: (key: string) => void;
  acknowledgeIosNoticeShown: (key: string) => void;
  addIosDismissalBarrier: (
    token: object,
    barrier: BookingCheckoutIosDismissalBarrier,
  ) => void;
  addIosHandoffListener: (
    token: object,
    generation: number,
    listener: BookingCheckoutIosHandoffListener,
  ) => () => void;
  cancelIosPresentationOwner: (
    ownerToken: object,
    ownerGeneration?: number,
  ) => void;
  dismissIosNotice: () => void;
  dismissNotice: () => void;
  dispose: () => void;
  hasIosNoticeForHold: (holdId: string) => boolean;
  matchesIosDismissalBarrier: (
    token: object,
    barrier: BookingCheckoutIosDismissalBarrier,
  ) => boolean;
  publishNotice: (notice: BookingCheckoutTerminalNotice) => void;
  requestIosNotice: (
    request: BookingCheckoutIosNoticeRequest,
  ) => BookingCheckoutIosNoticeDecision;
  resolveIosDismissalBarrier: (
    token: object,
    barrier: BookingCheckoutIosDismissalBarrier,
  ) => boolean;
  setIosAppActive: (active: boolean) => void;
  waitForIosDismissalBarriers: (
    holdId: string,
    presentationKey: string,
    ownerToken?: object,
    ownerGeneration?: number,
  ) => Promise<BookingCheckoutIosHandoffOutcome>;
};

export type BookingCheckoutIosProcessingGuardIdentity = {
  eventKey: string;
  generation: number;
  scope: BookingCheckoutRecoveryScope;
  sessionKey: string;
};

export type BookingCheckoutIosProcessingGuardState = {
  eventKey: string | null;
  generation: number;
  isFocused: boolean;
  isMounted: boolean;
  isUserRole: boolean;
  scope: BookingCheckoutRecoveryScope | null;
  sessionKey: string | null;
};

export function isBookingCheckoutIosProcessingCurrent(
  identity: BookingCheckoutIosProcessingGuardIdentity,
  current: BookingCheckoutIosProcessingGuardState,
) {
  return (
    current.isMounted &&
    current.generation === identity.generation &&
    current.isFocused &&
    current.isUserRole &&
    current.eventKey === identity.eventKey &&
    current.scope === identity.scope &&
    !identity.scope.disposed &&
    current.sessionKey === identity.sessionKey &&
    identity.scope.sessionKey === identity.sessionKey
  );
}

type NoticeChangeHandler = (
  scope: BookingCheckoutRecoveryScope,
  notice: BookingCheckoutTerminalNotice | null,
) => void;

type IosPresentationChangeHandler = (
  scope: BookingCheckoutRecoveryScope,
  presentation: BookingCheckoutIosNoticePresentation | null,
) => void;

export function createBookingCheckoutRecoveryScope(
  sessionKey: string | null,
  onNoticeChange: NoticeChangeHandler = () => undefined,
  onIosPresentationChange: IosPresentationChangeHandler = () => undefined,
): BookingCheckoutRecoveryScope {
  const scope = {
    callbacks: null,
    disposed: false,
    attempt: null,
    iosAppActive: true,
    iosCancelledHandoffKeys: new Set<string>(),
    iosCancelledOwnerGenerations: new Map<object, Set<number>>(),
    iosDismissalBarriers: new Map<
      object,
      BookingCheckoutIosStoredDismissalBarrier
    >(),
    iosHandledNoticeKeys: new Set<string>(),
    iosHandoffListeners: new Map<
      object,
      BookingCheckoutIosHandoffListenerRecord
    >(),
    iosHandoffWaiters: new Map<
      string,
      Set<BookingCheckoutIosHandoffWaiter>
    >(),
    iosNextNotice: null,
    iosPresentation: null,
    iosPresentationGeneration: 0,
    iosResultNoticeHoldIds: new Set<string>(),
    iosTerminalOutcomeByHoldId: new Map<
      string,
      BookingCheckoutIosNoticeOutcome
    >(),
    listeners: new Map<object, BookingCheckoutScopeListener>(),
    operationToken: null,
    ownerToken: null,
    sessionKey,
    terminalHandledKey: null,
    notice: null,
  } as BookingCheckoutRecoveryScope;

  const hasDismissalBarrier = (presentationKey: string) =>
    Array.from(scope.iosDismissalBarriers.values()).some(
      (barrier) => barrier.presentationKey === presentationKey,
    );

  const isOwnerGenerationCancelled = (
    ownerToken: object | undefined,
    ownerGeneration = 0,
  ) =>
    ownerToken != null &&
    (scope.iosCancelledOwnerGenerations.get(ownerToken)?.has(ownerGeneration) ??
      false);

  const findIosPresentation = (key: string) => {
    if (scope.iosPresentation?.key === key) return scope.iosPresentation;
    if (scope.iosNextNotice?.key === key) return scope.iosNextNotice;
    return null;
  };

  const getBarrierPresentationIdentity = (
    barrier: BookingCheckoutIosDismissalBarrier,
  ) => `${barrier.presentationKey}:${barrier.presentationGeneration}`;

  const matchesStoredBarrier = (
    registered: BookingCheckoutIosStoredDismissalBarrier | undefined,
    barrier: BookingCheckoutIosDismissalBarrier,
  ) =>
    registered != null &&
    registered.holdId === barrier.holdId &&
    registered.ownerToken === barrier.ownerToken &&
    registered.ownerGeneration === barrier.ownerGeneration &&
    registered.acceptedPresentationIdentities.has(
      getBarrierPresentationIdentity(barrier),
    );

  const emitIosPresentation = () => {
    onIosPresentationChange(
      scope,
      scope.iosPresentation
        ? { ...scope.iosPresentation }
        : null,
    );
  };

  const settleHandoffWaiters = (
    presentationKey: string,
    outcome: BookingCheckoutIosHandoffOutcome,
  ) => {
    const waiters = scope.iosHandoffWaiters.get(presentationKey);
    if (!waiters) return;
    scope.iosHandoffWaiters.delete(presentationKey);
    for (const waiter of waiters) waiter.resolve(outcome);
  };

  const resolveHandoffWaiters = (presentationKey: string) => {
    if (
      scope.iosCancelledHandoffKeys.has(presentationKey) ||
      hasDismissalBarrier(presentationKey)
    ) {
      return;
    }
    settleHandoffWaiters(presentationKey, "dismissed");
  };

  const releaseUndeliveredPresentation = (
    presentation: BookingCheckoutIosNoticePresentation,
  ) => {
    if (presentation.shown) return;
    scope.iosHandledNoticeKeys.delete(presentation.key);
    if (
      presentation.request.terminal &&
      scope.iosTerminalOutcomeByHoldId.get(presentation.request.holdId) ===
        presentation.request.outcome
    ) {
      scope.iosTerminalOutcomeByHoldId.delete(presentation.request.holdId);
    }
  };

  const maybePresentIosNotice = () => {
    const presentation = scope.iosPresentation;
    if (
      scope.disposed ||
      !scope.iosAppActive ||
      !presentation ||
      presentation.phase !== "queued" ||
      scope.iosCancelledHandoffKeys.has(presentation.key) ||
      hasDismissalBarrier(presentation.key)
    ) {
      return;
    }
    scope.iosPresentation = {
      ...presentation,
      phase: "presenting",
    };
    emitIosPresentation();
  };

  const notifyIosHandoffListeners = (
    presentation: BookingCheckoutIosNoticePresentation,
  ) => {
    for (const { listener } of scope.iosHandoffListeners.values()) {
      listener(presentation);
    }
  };

  const makeIosPresentation = (
    request: BookingCheckoutIosNoticeRequest,
    key: string,
  ): BookingCheckoutIosNoticePresentation => {
    const owners = new Map<object, number>();
    if (request.ownerToken) {
      owners.set(request.ownerToken, request.ownerGeneration ?? 0);
    }
    scope.iosPresentationGeneration += 1;
    return {
      cancelled: false,
      dismissAfterShow: false,
      generation: scope.iosPresentationGeneration,
      key,
      owned: request.ownerToken != null,
      owners,
      phase: "queued",
      request,
      shown: false,
    };
  };

  scope.acknowledgeIosNoticeDismissed = (key) => {
    const current = scope.iosPresentation;
    if (
      scope.disposed ||
      !current ||
      current.key !== key ||
      current.phase !== "dismissing"
    ) {
      return;
    }

    scope.iosPresentation = scope.iosNextNotice;
    scope.iosNextNotice = null;
    emitIosPresentation();
    maybePresentIosNotice();
  };

  scope.acknowledgeIosNoticeShown = (key) => {
    const current = scope.iosPresentation;
    if (
      scope.disposed ||
      !current ||
      current.key !== key ||
      current.phase !== "presenting"
    ) {
      return;
    }

    scope.iosPresentation = {
      ...current,
      phase: current.dismissAfterShow ? "dismissing" : "visible",
      shown: true,
    };
    emitIosPresentation();
  };

  scope.addIosDismissalBarrier = (token, barrier) => {
    if (scope.disposed || !barrier.holdId) return;
    const listener = scope.iosHandoffListeners.get(barrier.ownerToken);
    const presentation = findIosPresentation(barrier.presentationKey);
    if (
      listener?.generation !== barrier.ownerGeneration ||
      presentation?.generation !== barrier.presentationGeneration ||
      presentation.request.holdId !== barrier.holdId
    ) {
      return;
    }

    const previous = scope.iosDismissalBarriers.get(token);
    const continuesSameNativeDismissal =
      previous?.holdId === barrier.holdId &&
      previous.ownerToken === barrier.ownerToken &&
      previous.ownerGeneration === barrier.ownerGeneration;
    const acceptedPresentationIdentities = new Set(
      continuesSameNativeDismissal
        ? previous.acceptedPresentationIdentities
        : undefined,
    );
    acceptedPresentationIdentities.add(
      getBarrierPresentationIdentity(barrier),
    );
    if (
      previous &&
      (previous.presentationKey !== barrier.presentationKey ||
        previous.presentationGeneration !== barrier.presentationGeneration)
    ) {
      scope.iosCancelledHandoffKeys.add(previous.presentationKey);
      settleHandoffWaiters(previous.presentationKey, "cancelled");
    }
    scope.iosDismissalBarriers.set(token, {
      ...barrier,
      acceptedPresentationIdentities,
    });
  };

  scope.addIosHandoffListener = (token, generation, listener) => {
    if (scope.disposed || isOwnerGenerationCancelled(token, generation)) {
      return () => undefined;
    }
    scope.iosHandoffListeners.set(token, { generation, listener });

    const current = scope.iosPresentation;
    if (current?.phase === "queued") {
      scope.iosCancelledHandoffKeys.delete(current.key);
      listener(current);
      resolveHandoffWaiters(current.key);
      maybePresentIosNotice();
    }

    return () => {
      const registered = scope.iosHandoffListeners.get(token);
      if (registered?.generation === generation) {
        scope.iosHandoffListeners.delete(token);
      }
    };
  };

  scope.cancelIosPresentationOwner = (ownerToken, ownerGeneration) => {
    if (scope.disposed) return;
    const cancelledGenerations =
      scope.iosCancelledOwnerGenerations.get(ownerToken) ?? new Set<number>();
    if (ownerGeneration != null) {
      cancelledGenerations.add(ownerGeneration);
    } else {
      const registeredListener = scope.iosHandoffListeners.get(ownerToken);
      if (registeredListener) {
        cancelledGenerations.add(registeredListener.generation);
      }
      for (const barrier of scope.iosDismissalBarriers.values()) {
        if (barrier.ownerToken === ownerToken) {
          cancelledGenerations.add(barrier.ownerGeneration);
        }
      }
      for (const presentation of [
        scope.iosPresentation,
        scope.iosNextNotice,
      ]) {
        const generation = presentation?.owners.get(ownerToken);
        if (generation != null) cancelledGenerations.add(generation);
      }
      for (const waiters of scope.iosHandoffWaiters.values()) {
        for (const waiter of waiters) {
          if (waiter.ownerToken === ownerToken) {
            cancelledGenerations.add(waiter.ownerGeneration);
          }
        }
      }
    }
    if (cancelledGenerations.size > 0) {
      scope.iosCancelledOwnerGenerations.set(
        ownerToken,
        cancelledGenerations,
      );
    }
    const matchesGeneration = (generation: number) =>
      ownerGeneration == null || generation === ownerGeneration;
    const listener = scope.iosHandoffListeners.get(ownerToken);
    if (listener && matchesGeneration(listener.generation)) {
      scope.iosHandoffListeners.delete(ownerToken);
    }

    const interruptedKeys = new Set<string>();
    for (const [token, barrier] of scope.iosDismissalBarriers) {
      if (
        barrier.ownerToken === ownerToken &&
        matchesGeneration(barrier.ownerGeneration)
      ) {
        scope.iosDismissalBarriers.delete(token);
        interruptedKeys.add(barrier.presentationKey);
      }
    }
    for (const key of interruptedKeys) {
      scope.iosCancelledHandoffKeys.add(key);
      settleHandoffWaiters(key, "cancelled");
    }

    for (const [key, waiters] of scope.iosHandoffWaiters) {
      for (const waiter of [...waiters]) {
        if (
          waiter.ownerToken === ownerToken &&
          matchesGeneration(waiter.ownerGeneration)
        ) {
          waiters.delete(waiter);
          waiter.resolve("cancelled");
        }
      }
      if (waiters.size === 0) scope.iosHandoffWaiters.delete(key);
    }

    const removeOwner = (
      presentation: BookingCheckoutIosNoticePresentation | null,
    ) => {
      if (!presentation) return false;
      const generation = presentation.owners.get(ownerToken);
      if (generation == null || !matchesGeneration(generation)) return false;
      presentation.owners.delete(ownerToken);
      return presentation.owned && presentation.owners.size === 0;
    };

    let changed = false;
    if (removeOwner(scope.iosNextNotice)) {
      const cancelledNext = scope.iosNextNotice;
      if (cancelledNext) {
        scope.iosCancelledHandoffKeys.add(cancelledNext.key);
        settleHandoffWaiters(cancelledNext.key, "cancelled");
        releaseUndeliveredPresentation(cancelledNext);
      }
      scope.iosNextNotice = null;
      changed = true;
    }

    const current = scope.iosPresentation;
    if (removeOwner(current) && current) {
      scope.iosCancelledHandoffKeys.add(current.key);
      settleHandoffWaiters(current.key, "cancelled");
      if (current.phase === "queued") {
        releaseUndeliveredPresentation(current);
        scope.iosPresentation = scope.iosNextNotice;
        scope.iosNextNotice = null;
      } else if (current.phase === "presenting") {
        scope.iosPresentation = {
          ...current,
          cancelled: true,
          dismissAfterShow: true,
        };
      } else if (current.phase === "visible") {
        scope.iosPresentation = {
          ...current,
          cancelled: true,
          phase: "dismissing",
        };
      } else {
        scope.iosPresentation = { ...current, cancelled: true };
      }
      changed = true;
    }

    if (changed) emitIosPresentation();
  };

  scope.dismissIosNotice = () => {
    const current = scope.iosPresentation;
    if (scope.disposed || !current) return;
    if (current.phase === "presenting") {
      scope.iosPresentation = { ...current, dismissAfterShow: true };
      emitIosPresentation();
      return;
    }
    if (current.phase !== "visible") return;
    scope.iosPresentation = { ...current, phase: "dismissing" };
    emitIosPresentation();
  };

  scope.dismissNotice = () => {
    if (scope.disposed || scope.notice == null) return;
    scope.notice = null;
    onNoticeChange(scope, null);
  };

  scope.dispose = () => {
    if (scope.disposed) return;
    scope.disposed = true;
    scope.attempt = null;
    scope.callbacks = null;
    scope.operationToken = null;
    scope.ownerToken = null;
    scope.terminalHandledKey = null;
    scope.notice = null;
    scope.iosCancelledHandoffKeys.clear();
    scope.iosCancelledOwnerGenerations.clear();
    scope.iosDismissalBarriers.clear();
    scope.iosHandledNoticeKeys.clear();
    scope.iosHandoffListeners.clear();
    for (const waiters of scope.iosHandoffWaiters.values()) {
      for (const waiter of waiters) waiter.resolve("cancelled");
    }
    scope.iosHandoffWaiters.clear();
    scope.iosNextNotice = null;
    scope.iosPresentation = null;
    scope.iosResultNoticeHoldIds.clear();
    scope.iosTerminalOutcomeByHoldId.clear();
    scope.listeners.clear();
  };

  scope.hasIosNoticeForHold = (holdId) =>
    scope.iosPresentation?.request.holdId === holdId ||
    scope.iosNextNotice?.request.holdId === holdId;

  scope.publishNotice = (notice) => {
    if (scope.disposed) return;
    scope.notice = notice;
    onNoticeChange(scope, notice);
  };

  scope.matchesIosDismissalBarrier = (token, barrier) =>
    matchesStoredBarrier(scope.iosDismissalBarriers.get(token), barrier);

  scope.requestIosNotice = (request) => {
    const transitionKey =
      request.transitionGeneration == null
        ? ""
        : `:${request.transitionGeneration}`;
    const key = `${scope.sessionKey ?? "signed-out"}:${request.holdId}:${request.outcome}${transitionKey}`;
    const rejected = { accepted: false, generation: null, key };
    if (scope.disposed || !scope.sessionKey || !request.holdId) return rejected;
    if (
      isOwnerGenerationCancelled(
        request.ownerToken,
        request.ownerGeneration ?? 0,
      )
    ) {
      return rejected;
    }
    const isCheckoutOpenedNotice = request.outcome === "checkout_opened";
    if (
      isCheckoutOpenedNotice &&
      scope.iosResultNoticeHoldIds.has(request.holdId)
    ) {
      return rejected;
    }

    const existing = findIosPresentation(key);
    if (scope.iosHandledNoticeKeys.has(key)) {
      if (existing && request.ownerToken) {
        existing.owned = true;
        existing.owners.set(
          request.ownerToken,
          request.ownerGeneration ?? 0,
        );
      }
      if (
        existing?.phase === "queued" &&
        scope.iosCancelledHandoffKeys.delete(key)
      ) {
        existing.cancelled = false;
        existing.request = request;
        notifyIosHandoffListeners(existing);
        emitIosPresentation();
        resolveHandoffWaiters(key);
        maybePresentIosNotice();
        return { accepted: true, generation: existing.generation, key };
      }
      return {
        accepted: false,
        generation: existing?.generation ?? null,
        key,
      };
    }

    const terminalOutcome = scope.iosTerminalOutcomeByHoldId.get(
      request.holdId,
    );
    if (request.terminal) {
      if (terminalOutcome != null) return rejected;
    } else if (terminalOutcome != null) {
      return rejected;
    }
    scope.iosCancelledHandoffKeys.delete(key);
    scope.iosHandledNoticeKeys.add(key);
    if (!isCheckoutOpenedNotice) {
      scope.iosResultNoticeHoldIds.add(request.holdId);
    }
    if (request.terminal) {
      scope.iosTerminalOutcomeByHoldId.set(request.holdId, request.outcome);
    }

    const nextPresentation = makeIosPresentation(request, key);
    const current = scope.iosPresentation;
    if (!current) {
      scope.iosPresentation = nextPresentation;
      notifyIosHandoffListeners(nextPresentation);
      emitIosPresentation();
      resolveHandoffWaiters(key);
      maybePresentIosNotice();
      return { accepted: true, generation: nextPresentation.generation, key };
    }

    const replacesTransientForSameHold =
      ((request.terminal && !current.request.terminal) ||
        (!isCheckoutOpenedNotice &&
          current.request.outcome === "checkout_opened")) &&
      current.request.holdId === request.holdId;
    if (replacesTransientForSameHold && current.phase === "queued") {
      scope.iosCancelledHandoffKeys.add(current.key);
      settleHandoffWaiters(current.key, "cancelled");
      if (scope.iosNextNotice) {
        scope.iosCancelledHandoffKeys.add(scope.iosNextNotice.key);
        settleHandoffWaiters(scope.iosNextNotice.key, "cancelled");
      }
      scope.iosPresentation = nextPresentation;
      scope.iosNextNotice = null;
      notifyIosHandoffListeners(nextPresentation);
      emitIosPresentation();
      resolveHandoffWaiters(key);
      maybePresentIosNotice();
      return { accepted: true, generation: nextPresentation.generation, key };
    }

    if (!scope.iosNextNotice) {
      scope.iosNextNotice = nextPresentation;
    } else if (
      (request.terminal && !scope.iosNextNotice.request.terminal) ||
      (!isCheckoutOpenedNotice &&
        scope.iosNextNotice.request.outcome === "checkout_opened" &&
        scope.iosNextNotice.request.holdId === request.holdId)
    ) {
      scope.iosCancelledHandoffKeys.add(scope.iosNextNotice.key);
      settleHandoffWaiters(scope.iosNextNotice.key, "cancelled");
      scope.iosNextNotice = nextPresentation;
    } else {
      scope.iosHandledNoticeKeys.delete(key);
      if (
        request.terminal &&
        scope.iosTerminalOutcomeByHoldId.get(request.holdId) ===
          request.outcome
      ) {
        scope.iosTerminalOutcomeByHoldId.delete(request.holdId);
      }
      scope.iosCancelledHandoffKeys.add(key);
      return rejected;
    }
    notifyIosHandoffListeners(nextPresentation);
    resolveHandoffWaiters(key);

    if (replacesTransientForSameHold) {
      if (current.phase === "presenting") {
        scope.iosPresentation = { ...current, dismissAfterShow: true };
      } else if (current.phase === "visible") {
        scope.iosPresentation = { ...current, phase: "dismissing" };
      }
      emitIosPresentation();
    }

    return { accepted: true, generation: nextPresentation.generation, key };
  };

  scope.resolveIosDismissalBarrier = (token, barrier) => {
    const registered = scope.iosDismissalBarriers.get(token);
    if (!matchesStoredBarrier(registered, barrier)) return false;
    scope.iosDismissalBarriers.delete(token);
    resolveHandoffWaiters(registered!.presentationKey);
    maybePresentIosNotice();
    return true;
  };

  scope.setIosAppActive = (active) => {
    if (scope.disposed || scope.iosAppActive === active) return;
    scope.iosAppActive = active;
    if (active) maybePresentIosNotice();
  };

  scope.waitForIosDismissalBarriers = (
    holdId,
    presentationKey,
    ownerToken,
    ownerGeneration = 0,
  ) => {
    if (
      scope.disposed ||
      scope.iosCancelledHandoffKeys.has(presentationKey) ||
      isOwnerGenerationCancelled(ownerToken, ownerGeneration)
    ) {
      return Promise.resolve("cancelled");
    }
    const hasMatchingBarrier = Array.from(
      scope.iosDismissalBarriers.values(),
    ).some(
      (barrier) =>
        barrier.holdId === holdId &&
        barrier.presentationKey === presentationKey,
    );
    if (!hasMatchingBarrier) {
      return Promise.resolve("dismissed");
    }
    return new Promise<BookingCheckoutIosHandoffOutcome>((resolve) => {
      const waiters =
        scope.iosHandoffWaiters.get(presentationKey) ?? new Set();
      waiters.add({
        ownerGeneration,
        ownerToken: ownerToken ?? null,
        resolve,
      });
      scope.iosHandoffWaiters.set(presentationKey, waiters);
    });
  };

  return scope;
}
