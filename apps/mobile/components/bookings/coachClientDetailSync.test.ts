import { areCoachClientDetailsEquivalent } from "./coachClientDetailSync";

function assert(value: boolean, message: string) {
  if (!value) throw new Error(message);
}

const current = {
  id: "member-1",
  name: "Ava Rivera",
  readinessLabel: "Active",
  sessions: [{ id: "session-1", status: "confirmed" }],
};

assert(
  areCoachClientDetailsEquivalent(current, {
    ...current,
    sessions: [{ id: "session-1", status: "confirmed" }],
  }),
  "a recomputed but unchanged client summary must not trigger another state update",
);

assert(
  !areCoachClientDetailsEquivalent(current, {
    ...current,
    sessions: [{ id: "session-1", status: "completed" }],
  }),
  "a real client-session change must replace the selected detail",
);

