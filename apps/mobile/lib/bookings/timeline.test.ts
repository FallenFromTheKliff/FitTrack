import {
  clampBookingTimelinePage,
  groupBookingTimelineByDate,
  paginateBookingTimeline,
  sortBookingTimeline,
} from "./timeline";

type TestRegistrar = (name: string, callback: () => void) => unknown;
const jestTest = (globalThis as { test?: TestRegistrar }).test;
let passed = 0;
const failures: string[] = [];

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function assertEqual(actual: unknown, expected: unknown, message?: string) {
  const actualJson = JSON.stringify(actual);
  const expectedJson = JSON.stringify(expected);
  if (actualJson !== expectedJson) {
    throw new Error(message ?? `expected ${expectedJson}, got ${actualJson}`);
  }
}

function test(name: string, callback: () => void) {
  if (jestTest) {
    jestTest(name, callback);
    return;
  }
  try {
    callback();
    passed += 1;
  } catch (error) {
    failures.push(`${name}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

const today = "2026-09-08";

function row(id: string, date: string, startTime: string) {
  return { date, id, startTime };
}

function ids(items: readonly { id: string }[]) {
  return items.map((item) => item.id);
}

test("mixed shuffled rows use current/future ascending then history descending", () => {
  const input = [
    row("past-old", "2026-09-01", "9:00 AM"),
    row("future-late", "2026-09-10", "9:00 AM"),
    row("today-late", today, "2:00 PM"),
    row("past-recent", "2026-09-07", "10:00 AM"),
    row("today-early", today, "8:00 AM"),
    row("future-early", "2026-09-09", "10:00 AM"),
  ];

  assertEqual(ids(sortBookingTimeline(input, today)), [
    "today-early",
    "today-late",
    "future-early",
    "future-late",
    "past-recent",
    "past-old",
  ]);
});

test("equal date and start minute uses ascending string IDs in either bucket", () => {
  const input = [
    row("b", today, "9:00 AM"),
    row("a", today, "9:00 AM"),
    row("z", "2026-09-07", "9:00 AM"),
    row("c", "2026-09-07", "9:00 AM"),
  ];

  assertEqual(ids(sortBookingTimeline(input, today)), ["a", "b", "c", "z"]);
});

test("only-past and only-future inputs retain their bucket direction", () => {
  const past = [
    row("old", "2026-09-01", "11:00 AM"),
    row("new", "2026-09-07", "8:00 AM"),
  ];
  const future = [
    row("late", "2026-09-10", "8:00 AM"),
    row("soon", "2026-09-09", "8:00 AM"),
  ];

  assertEqual(ids(sortBookingTimeline(past, today)), ["new", "old"]);
  assertEqual(ids(sortBookingTimeline(future, today)), ["soon", "late"]);
});

test("empty timelines remain empty", () => {
  assertEqual(sortBookingTimeline([], today), []);
  assertEqual(groupBookingTimelineByDate([]), []);
  assertEqual(paginateBookingTimeline([], 2, 10), {
    items: [],
    page: 1,
    totalPages: 1,
  });
});

test("pagination clamps both lower and upper page bounds", () => {
  const input = Array.from({ length: 21 }, (_, index) => index);
  assertEqual(paginateBookingTimeline(input, 0, 10), {
    items: input.slice(0, 10),
    page: 1,
    totalPages: 3,
  });
  assertEqual(paginateBookingTimeline(input, 99, 10), {
    items: input.slice(20),
    page: 3,
    totalPages: 3,
  });
});

test("shrinking results clamps the persisted page before later growth", () => {
  const original = Array.from({ length: 25 }, (_, index) => index);
  const shrink = paginateBookingTimeline(original.slice(0, 3), 3, 10);
  assertEqual(shrink.page, 1);
  assertEqual(shrink.totalPages, 1);

  const regrown = paginateBookingTimeline(original.slice(0, 15), shrink.page, 10);
  assertEqual(regrown.page, 1);
  assertEqual(regrown.items, original.slice(0, 10));
  assertEqual(clampBookingTimelinePage(3, shrink.totalPages), 1);
});

test("grouping preserves sorted insertion order and complete date membership", () => {
  const input = [
    row("future-1", "2026-09-09", "8:00 AM"),
    row("future-2", "2026-09-09", "9:00 AM"),
    row("today-1", today, "8:00 AM"),
    row("past-1", "2026-09-07", "8:00 AM"),
  ];

  assertEqual(
    groupBookingTimelineByDate(input).map(([date, items]) => [date, ids(items)]),
    [
      ["2026-09-09", ["future-1", "future-2"]],
      [today, ["today-1"]],
      ["2026-09-07", ["past-1"]],
    ],
  );
});

test("sorting, grouping, and pagination do not mutate caller arrays", () => {
  const input = [
    row("past", "2026-09-07", "8:00 AM"),
    row("future", "2026-09-09", "8:00 AM"),
  ];
  const before = [...input];
  const sorted = sortBookingTimeline(input, today);
  const grouped = groupBookingTimelineByDate(sorted);
  paginateBookingTimeline(sorted, 1, 1);

  assertEqual(input, before);
  assert(sorted !== input, "sorting should return a new array");
  assert(grouped[0]?.[1] !== sorted, "grouping should return new group arrays");
});

if (!jestTest) {
  if (failures.length) {
    throw new Error(
      `${failures.length} booking timeline regression(s) failed:\n${failures.join("\n")}`,
    );
  }

  console.log(`timeline.test.ts: ${passed} regression tests passed`);
}
