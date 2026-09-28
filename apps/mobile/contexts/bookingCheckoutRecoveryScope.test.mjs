import { readFileSync } from "node:fs";

import {
  createBookingCheckoutRecoveryScope,
  isBookingCheckoutIosProcessingCurrent,
} from "./bookingCheckoutRecoveryScope.ts";

function assertEqual(actual, expected, message) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(
      `${message}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
    );
  }
}

const attempt = {
  appointmentId: "appointment-1",
  bookingId: null,
  checkoutUrl: "https://checkout.example/hold-1",
  expiresAt: "2026-09-10T12:15:00.000Z",
  failureReason: null,
  holdId: "hold-1",
  kind: "one_time",
  membershipCardId: null,
  paymentId: null,
  recurringPlanId: null,
  state: "pending",
  status: "pending",
  subscriptionId: null,
};

const notices = [];
const firstSession = createBookingCheckoutRecoveryScope(
  "member-a",
  (_scope, notice) => notices.push(notice),
);
firstSession.attempt = attempt;
firstSession.callbacks = { onSucceeded: () => undefined };
firstSession.operationToken = {};
firstSession.ownerToken = {};
firstSession.publishNotice({ title: "Session confirmed", message: "Done." });

assertEqual(notices.length, 1, "active session publishes terminal notice");
assertEqual(firstSession.notice?.title, "Session confirmed", "notice is retained for active host");

firstSession.dispose();
assertEqual(firstSession.disposed, true, "disposed session is marked inactive");
assertEqual(firstSession.attempt, null, "disposed session drops the held attempt");
assertEqual(firstSession.callbacks, null, "disposed session drops callback references");
assertEqual(firstSession.operationToken, null, "disposed session drops operation ownership");
assertEqual(firstSession.ownerToken, null, "disposed session drops polling ownership");
assertEqual(firstSession.notice, null, "disposed session drops terminal notice");

firstSession.publishNotice({ title: "Stale", message: "Must not surface." });
assertEqual(notices.length, 1, "late disposed-session notice is ignored");

const replacementSession = createBookingCheckoutRecoveryScope("member-b");
assertEqual(replacementSession.disposed, false, "replacement session is active");
assertEqual(replacementSession.attempt, null, "replacement session starts without prior hold");
assertEqual(replacementSession.callbacks, null, "replacement session has no stale callbacks");

const iosChanges = [];
const iosScope = createBookingCheckoutRecoveryScope(
  "member-ios",
  undefined,
  (_scope, presentation) => iosChanges.push(presentation),
);
iosScope.setIosAppActive(false);
const outgoingOwnerToken = {};
const outgoingModalToken = {};
const outgoingOwnerGeneration = 1;
let outgoingBarrier = null;
let handoffCount = 0;
iosScope.addIosHandoffListener(outgoingOwnerToken, outgoingOwnerGeneration, (presentation) => {
  handoffCount += 1;
  outgoingBarrier = {
    holdId: presentation.request.holdId,
    ownerGeneration: outgoingOwnerGeneration,
    ownerToken: outgoingOwnerToken,
    presentationGeneration: presentation.generation,
    presentationKey: presentation.key,
  };
  iosScope.addIosDismissalBarrier(outgoingModalToken, outgoingBarrier);
});

const succeededRequest = {
  holdId: "hold-ios-1",
  message: "Confirmed.",
  outcome: "succeeded",
  terminal: true,
  title: "Session confirmed",
};
const firstTerminal = iosScope.requestIosNotice(succeededRequest);
const duplicateTerminal = iosScope.requestIosNotice(succeededRequest);
assertEqual(firstTerminal.accepted, true, "first terminal result is accepted");
assertEqual(
  firstTerminal.key,
  "member-ios:hold-ios-1:succeeded",
  "dedupe key includes the authenticated session, hold, and outcome",
);
assertEqual(duplicateTerminal.accepted, false, "duplicate terminal result is rejected");
assertEqual(handoffCount, 1, "polling and return-link duplicates share one handoff");
assertEqual(iosScope.iosPresentation?.phase, "queued", "background result remains queued");

let routeCleanupReady = false;
let routeCleanupOutcome = null;
const routeCleanup = iosScope
  .waitForIosDismissalBarriers(
    "hold-ios-1",
    firstTerminal.key,
    {},
    1,
  )
  .then((outcome) => {
    routeCleanupReady = true;
    routeCleanupOutcome = outcome;
  });
await Promise.resolve();
assertEqual(routeCleanupReady, false, "route cleanup waits for outgoing native dismissal");
assertEqual(
  iosScope.resolveIosDismissalBarrier(outgoingModalToken, outgoingBarrier),
  true,
  "matching native dismissal is accepted",
);
await routeCleanup;
assertEqual(routeCleanupReady, true, "native dismissal releases route cleanup");
assertEqual(routeCleanupOutcome, "dismissed", "normal native dismissal is explicit");
assertEqual(
  iosScope.resolveIosDismissalBarrier(outgoingModalToken, outgoingBarrier),
  false,
  "duplicate native dismissal callbacks are ignored",
);
assertEqual(iosScope.iosPresentation?.phase, "queued", "background result stays hidden after handoff");

iosScope.setIosAppActive(true);
assertEqual(iosScope.iosPresentation?.phase, "presenting", "foreground begins result presentation");
iosScope.acknowledgeIosNoticeShown(firstTerminal.key);
assertEqual(iosScope.iosPresentation?.phase, "visible", "onShow confirms visible result");
iosScope.dismissIosNotice();
assertEqual(iosScope.iosPresentation?.phase, "dismissing", "Continue starts native dismissal");
assertEqual(
  iosScope.hasIosNoticeForHold("hold-ios-1"),
  true,
  "presentation ownership remains until native onDismiss",
);
iosScope.acknowledgeIosNoticeDismissed("stale-key");
assertEqual(iosScope.iosPresentation?.phase, "dismissing", "stale onDismiss is ignored");
iosScope.acknowledgeIosNoticeDismissed(firstTerminal.key);
assertEqual(iosScope.iosPresentation, null, "matching onDismiss releases presentation state");
assertEqual(
  iosScope.requestIosNotice(succeededRequest).accepted,
  false,
  "late terminal response cannot reopen a dismissed result",
);

const upgradeScope = createBookingCheckoutRecoveryScope("member-upgrade");
const pending = upgradeScope.requestIosNotice({
  holdId: "hold-upgrade",
  message: "Still processing.",
  outcome: "pending",
  terminal: false,
  title: "Checkout still processing",
});
upgradeScope.acknowledgeIosNoticeShown(pending.key);
assertEqual(upgradeScope.iosPresentation?.phase, "visible", "pending notice may be shown");
const verified = upgradeScope.requestIosNotice({
  holdId: "hold-upgrade",
  message: "Confirmed.",
  outcome: "succeeded",
  terminal: true,
  title: "Checkout completed",
});
assertEqual(verified.accepted, true, "verified success supersedes a transient result");
assertEqual(upgradeScope.iosPresentation?.phase, "dismissing", "stale transient result closes first");
upgradeScope.acknowledgeIosNoticeDismissed(pending.key);
assertEqual(upgradeScope.iosPresentation?.key, verified.key, "verified success becomes the only next result");
assertEqual(upgradeScope.iosPresentation?.phase, "presenting", "verified success presents after dismissal");
assertEqual(
  upgradeScope.requestIosNotice({
    holdId: "hold-upgrade",
    message: "Could not verify.",
    outcome: "verification_error",
    terminal: false,
    title: "Checkout verification failed",
  }).accepted,
  false,
  "transient errors are discarded after a terminal outcome",
);

const errorUpgradeScope = createBookingCheckoutRecoveryScope("member-error-upgrade");
errorUpgradeScope.requestIosNotice({
  holdId: "hold-error-upgrade",
  message: "Could not verify.",
  outcome: "verification_error",
  terminal: false,
  title: "Checkout verification failed",
});
assertEqual(
  errorUpgradeScope.requestIosNotice({
    holdId: "hold-error-upgrade",
    message: "Confirmed.",
    outcome: "succeeded",
    terminal: true,
    title: "Checkout completed",
  }).accepted,
  true,
  "verification errors do not suppress a later verified success",
);

const presentingScope = createBookingCheckoutRecoveryScope("member-presenting");
const presentingPending = presentingScope.requestIosNotice({
  holdId: "hold-presenting",
  message: "Still processing.",
  outcome: "pending",
  terminal: false,
  title: "Checkout still processing",
});
const presentingSuccess = presentingScope.requestIosNotice({
  holdId: "hold-presenting",
  message: "Confirmed.",
  outcome: "succeeded",
  terminal: true,
  title: "Checkout completed",
});
assertEqual(
  presentingScope.iosPresentation?.dismissAfterShow,
  true,
  "a presenting transient waits for onShow before requesting dismissal",
);
presentingScope.acknowledgeIosNoticeShown(presentingPending.key);
assertEqual(
  presentingScope.iosPresentation?.phase,
  "dismissing",
  "presenting transient serializes show then dismiss",
);
presentingScope.acknowledgeIosNoticeDismissed(presentingPending.key);
assertEqual(
  presentingScope.iosPresentation?.key,
  presentingSuccess.key,
  "terminal result follows the presenting transient without overlap",
);

const transitionScope = createBookingCheckoutRecoveryScope("member-transition");
transitionScope.setIosAppActive(false);
const confirmationOwner = {};
const confirmationToken = {};
const resultOwner = {};
let confirmationBarrier = null;
transitionScope.addIosHandoffListener(confirmationOwner, 7, (presentation) => {
  confirmationBarrier = {
    holdId: presentation.request.holdId,
    ownerGeneration: 7,
    ownerToken: confirmationOwner,
    presentationGeneration: presentation.generation,
    presentationKey: presentation.key,
  };
  transitionScope.addIosDismissalBarrier(
    confirmationToken,
    confirmationBarrier,
  );
});
const checkoutOpened = transitionScope.requestIosNotice({
  holdId: "hold-transition",
  message: "Complete checkout, then return.",
  outcome: "checkout_opened",
  ownerGeneration: 7,
  ownerToken: confirmationOwner,
  terminal: false,
  title: "PayMongo checkout opened",
  transitionGeneration: 3,
});
assertEqual(
  checkoutOpened.key,
  "member-transition:hold-transition:checkout_opened:3",
  "informational notice key includes the transition generation",
);
assertEqual(
  transitionScope.iosPresentation?.phase,
  "queued",
  "checkout-opened notice waits behind confirmation dismissal",
);
transitionScope.setIosAppActive(true);
assertEqual(
  transitionScope.iosPresentation?.phase,
  "queued",
  "foreground does not bypass the confirmation barrier",
);
const firstConfirmationBarrier = confirmationBarrier;
const terminalDuringHandoff = transitionScope.requestIosNotice({
  holdId: "hold-transition",
  message: "Confirmed.",
  outcome: "succeeded",
  ownerGeneration: 11,
  ownerToken: resultOwner,
  terminal: true,
  title: "Checkout completed",
});
assertEqual(
  transitionScope.iosPresentation?.key,
  terminalDuringHandoff.key,
  "terminal result replaces queued checkout-opened information",
);
assertEqual(
  transitionScope.iosPresentation?.phase,
  "queued",
  "replacement still waits for the same native confirmation dismissal",
);
let terminalHandoffOutcome = null;
const terminalHandoff = transitionScope
  .waitForIosDismissalBarriers(
    "hold-transition",
    terminalDuringHandoff.key,
    resultOwner,
    11,
  )
  .then((outcome) => {
    terminalHandoffOutcome = outcome;
  });
assertEqual(
  transitionScope.resolveIosDismissalBarrier(
    confirmationToken,
    firstConfirmationBarrier,
  ),
  true,
  "the original callback may acknowledge a barrier rebound to the terminal result",
);
await terminalHandoff;
assertEqual(
  terminalHandoffOutcome,
  "dismissed",
  "terminal continuation receives a real native-dismissal outcome",
);
assertEqual(
  transitionScope.iosPresentation?.phase,
  "presenting",
  "terminal result presents only after confirmation onDismiss",
);
assertEqual(
  transitionScope.requestIosNotice({
    holdId: "hold-transition",
    message: "Complete checkout, then return.",
    outcome: "checkout_opened",
    ownerGeneration: 7,
    ownerToken: confirmationOwner,
    terminal: false,
    title: "PayMongo checkout opened",
    transitionGeneration: 4,
  }).accepted,
  false,
  "checkout-opened information cannot reappear after a terminal result",
);

const cancelledReturnScope = createBookingCheckoutRecoveryScope(
  "member-cancelled-return",
);
cancelledReturnScope.setIosAppActive(false);
cancelledReturnScope.requestIosNotice({
  holdId: "hold-cancelled-return",
  message: "Complete checkout, then return.",
  outcome: "checkout_opened",
  terminal: false,
  title: "PayMongo checkout opened",
  transitionGeneration: 1,
});
const cancelledReturn = cancelledReturnScope.requestIosNotice({
  holdId: "hold-cancelled-return",
  message: "The payment was not completed.",
  outcome: "cancelled_return",
  terminal: false,
  title: "Checkout cancelled",
});
assertEqual(
  cancelledReturnScope.iosPresentation?.key,
  cancelledReturn.key,
  "non-terminal cancellation return supersedes checkout-opened information",
);
assertEqual(
  cancelledReturnScope.requestIosNotice({
    holdId: "hold-cancelled-return",
    message: "Complete checkout, then return.",
    outcome: "checkout_opened",
    terminal: false,
    title: "PayMongo checkout opened",
    transitionGeneration: 2,
  }).accepted,
  false,
  "checkout-opened information stays suppressed after cancellation return",
);

const ownerScope = createBookingCheckoutRecoveryScope("member-owner");
ownerScope.setIosAppActive(false);
const departingOwner = {};
const survivingOwner = {};
const departingBarrierToken = {};
const survivingBarrierToken = {};
let departingBarrier = null;
let survivingBarrier = null;
ownerScope.addIosHandoffListener(departingOwner, 1, (presentation) => {
  departingBarrier = {
    holdId: presentation.request.holdId,
    ownerGeneration: 1,
    ownerToken: departingOwner,
    presentationGeneration: presentation.generation,
    presentationKey: presentation.key,
  };
  ownerScope.addIosDismissalBarrier(
    departingBarrierToken,
    departingBarrier,
  );
});
ownerScope.addIosHandoffListener(survivingOwner, 2, (presentation) => {
  survivingBarrier = {
    holdId: presentation.request.holdId,
    ownerGeneration: 2,
    ownerToken: survivingOwner,
    presentationGeneration: presentation.generation,
    presentationKey: presentation.key,
  };
  ownerScope.addIosDismissalBarrier(
    survivingBarrierToken,
    survivingBarrier,
  );
});
const ownerRequest = {
  holdId: "hold-owner",
  message: "Confirmed.",
  outcome: "succeeded",
  ownerGeneration: 2,
  ownerToken: survivingOwner,
  terminal: true,
  title: "Checkout completed",
};
const ownerDecision = ownerScope.requestIosNotice(ownerRequest);
let interruptedOutcome = null;
const interruptedWait = ownerScope
  .waitForIosDismissalBarriers(
    "hold-owner",
    ownerDecision.key,
    survivingOwner,
    2,
  )
  .then((outcome) => {
    interruptedOutcome = outcome;
  });
ownerScope.cancelIosPresentationOwner(departingOwner, 1);
await interruptedWait;
assertEqual(
  interruptedOutcome,
  "cancelled",
  "departing modal ownership cancels rather than falsely releasing the wait",
);
assertEqual(
  ownerScope.iosDismissalBarriers.has(departingBarrierToken),
  false,
  "departing owner leaves no barrier",
);
assertEqual(
  ownerScope.iosDismissalBarriers.has(survivingBarrierToken),
  true,
  "another owner's barrier remains intact",
);
assertEqual(
  ownerScope.iosPresentation?.phase,
  "queued",
  "owner cleanup does not immediately present a replacement",
);
assertEqual(
  ownerScope.iosHandoffWaiters.size,
  0,
  "owner cleanup leaves no unresolved handoff waiter",
);
assertEqual(
  ownerScope.requestIosNotice(ownerRequest).accepted,
  true,
  "a surviving owner can revive interrupted queued presentation work",
);
assertEqual(
  ownerScope.resolveIosDismissalBarrier(
    survivingBarrierToken,
    survivingBarrier,
  ),
  true,
  "surviving owner can finish its own native dismissal",
);
ownerScope.setIosAppActive(true);
assertEqual(
  ownerScope.iosPresentation?.phase,
  "presenting",
  "revived work presents after the surviving barrier resolves",
);

const neverShownScope = createBookingCheckoutRecoveryScope("member-retry");
neverShownScope.setIosAppActive(false);
const abandonedOwner = {};
const abandonedToken = {};
neverShownScope.addIosHandoffListener(abandonedOwner, 4, (presentation) => {
  neverShownScope.addIosDismissalBarrier(abandonedToken, {
    holdId: presentation.request.holdId,
    ownerGeneration: 4,
    ownerToken: abandonedOwner,
    presentationGeneration: presentation.generation,
    presentationKey: presentation.key,
  });
});
const abandonedRequest = {
  holdId: "hold-retry",
  message: "Confirmed.",
  outcome: "succeeded",
  ownerGeneration: 4,
  ownerToken: abandonedOwner,
  terminal: true,
  title: "Checkout completed",
};
const abandonedDecision = neverShownScope.requestIosNotice(abandonedRequest);
neverShownScope.cancelIosPresentationOwner(abandonedOwner, 4);
assertEqual(
  neverShownScope.iosPresentation,
  null,
  "never-shown work owned only by the departing component is removed",
);
assertEqual(
  neverShownScope.iosHandledNoticeKeys.has(abandonedDecision.key),
  false,
  "cancelled never-shown work is not permanently marked delivered",
);
assertEqual(
  neverShownScope.requestIosNotice(abandonedRequest).accepted,
  false,
  "late callbacks from the departed owner generation are rejected",
);
assertEqual(
  neverShownScope.requestIosNotice({
    ...abandonedRequest,
    ownerGeneration: 5,
    ownerToken: abandonedOwner,
  }).accepted,
  true,
  "a valid recovery owner may publish the previously cancelled terminal result",
);
assertEqual(
  await neverShownScope.waitForIosDismissalBarriers(
    "hold-without-modal",
    "member-retry:hold-without-modal:pending",
  ),
  "dismissed",
  "a never-presented modal creates no native-dismissal wait",
);

const disposedWaitScope = createBookingCheckoutRecoveryScope("member-disposed");
disposedWaitScope.setIosAppActive(false);
const disposedOwner = {};
const disposedBarrier = {};
let disposedBarrierRecord = null;
disposedWaitScope.addIosHandoffListener(disposedOwner, 1, (presentation) => {
  disposedBarrierRecord = {
    holdId: presentation.request.holdId,
    ownerGeneration: 1,
    ownerToken: disposedOwner,
    presentationGeneration: presentation.generation,
    presentationKey: presentation.key,
  };
  disposedWaitScope.addIosDismissalBarrier(
    disposedBarrier,
    disposedBarrierRecord,
  );
});
const disposedDecision = disposedWaitScope.requestIosNotice({
  holdId: "hold-disposed",
  message: "Confirmed.",
  outcome: "succeeded",
  terminal: true,
  title: "Checkout completed",
});
let disposedWaitOutcome = null;
const disposedWait = disposedWaitScope
  .waitForIosDismissalBarriers(
    "hold-disposed",
    disposedDecision.key,
    disposedOwner,
    1,
  )
  .then((outcome) => {
    disposedWaitOutcome = outcome;
  });
disposedWaitScope.dispose();
await disposedWait;
assertEqual(
  disposedWaitOutcome,
  "cancelled",
  "session disposal cancels pending handoff continuations",
);
assertEqual(disposedWaitScope.iosPresentation, null, "session disposal drops queued results");
assertEqual(disposedWaitScope.iosHandledNoticeKeys.size, 0, "session disposal clears dedupe state");

const guardScope = createBookingCheckoutRecoveryScope("member-guard");
const guardIdentity = {
  eventKey: "member-guard:hold-guard:coach-single:success",
  generation: 9,
  scope: guardScope,
  sessionKey: "member-guard",
};
const currentGuardState = {
  eventKey: guardIdentity.eventKey,
  generation: 9,
  isFocused: true,
  isMounted: true,
  isUserRole: true,
  scope: guardScope,
  sessionKey: "member-guard",
};
assertEqual(
  isBookingCheckoutIosProcessingCurrent(guardIdentity, currentGuardState),
  true,
  "current checkout event may publish and clear its own parameters",
);
for (const [label, staleState] of [
  ["component unmount", { ...currentGuardState, isMounted: false }],
  ["route change", { ...currentGuardState, isFocused: false }],
  ["logout", { ...currentGuardState, sessionKey: null }],
  [
    "account change",
    {
      ...currentGuardState,
      scope: createBookingCheckoutRecoveryScope("member-other"),
      sessionKey: "member-other",
    },
  ],
  [
    "newer checkout",
    {
      ...currentGuardState,
      eventKey: "member-guard:hold-new:coach-single:success",
    },
  ],
  ["processing generation change", { ...currentGuardState, generation: 10 }],
]) {
  assertEqual(
    isBookingCheckoutIosProcessingCurrent(guardIdentity, staleState),
    false,
    `${label} blocks stale notice publication and route cleanup`,
  );
}
guardScope.dispose();
assertEqual(
  isBookingCheckoutIosProcessingCurrent(guardIdentity, currentGuardState),
  false,
  "disposed authenticated scope blocks old-session continuation",
);

const appointmentModalSource = readFileSync(
  new URL(
    "../components/modals/booking/AppointmentModal.tsx",
    import.meta.url,
  ),
  "utf8",
);
assertEqual(
  appointmentModalSource.match(/queueIosCheckoutOpenedNotice\(/g)?.length,
  2,
  "single and monthly checkout both use the shared iOS handoff helper",
);
assertEqual(
  /checkoutReturn\.start\(checkoutAttempt\);[\s\S]*?queueIosCheckoutOpenedNotice\([\s\S]*?setAppointmentConfirmation\(null\);[\s\S]*?resetFormState\(\);/.test(
    appointmentModalSource,
  ),
  true,
  "checkout transition is recorded before confirmation state is reset",
);
assertEqual(
  appointmentModalSource.includes("!iosNoticeHandoffPending"),
  true,
  "automatic recovery is gated during the queued notice handoff",
);
assertEqual(
  appointmentModalSource.match(/!isBookingTerminalNoticeActive/g)?.length >= 2,
  true,
  "appointment and recovery surfaces stay hidden while the coordinator owns a notice",
);
