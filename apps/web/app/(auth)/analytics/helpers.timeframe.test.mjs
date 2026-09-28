import assert from "node:assert/strict";

import {
  deriveAnalyticsCustomPeriod,
  getAnalyticsWeekOptions,
  resolveAnalyticsTimeframe,
} from "./helpers.ts";

function addDays(value, days) {
  const date = new Date(`${value}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

const now = new Date("2026-08-28T12:00:00.000Z");

const weeks2026 = getAnalyticsWeekOptions(2026);
assert.equal(weeks2026.length, 53);
assert.equal(weeks2026[0].value, "2025-12-29");
assert.equal(weeks2026[0].label, "Dec 29, 2025–Jan 4, 2026");
assert.equal(weeks2026.at(-1).value, "2026-12-28");
assert.equal(weeks2026.at(-1).label, "Dec 28, 2026–Jan 3, 2027");
assert.equal(
  weeks2026.every((option, index) => {
    const date = new Date(`${option.value}T00:00:00.000Z`);
    return date.getUTCDay() === 1 &&
      (index === 0 || date.getTime() - new Date(`${weeks2026[index - 1].value}T00:00:00.000Z`).getTime() === 7 * 24 * 60 * 60 * 1000);
  }),
  true,
);

const weeks2024 = getAnalyticsWeekOptions(2024);
assert.equal(weeks2024.length, 53);
assert.equal(weeks2024[0].value, "2024-01-01");
assert.equal(weeks2024.at(-1).value, "2024-12-30");

assert.equal(deriveAnalyticsCustomPeriod("2026-08-28", "2026-08-28"), "hourly");
assert.equal(deriveAnalyticsCustomPeriod("2026-08-01", "2026-08-31"), "daily");
assert.equal(deriveAnalyticsCustomPeriod("2026-01-01", "2026-02-01"), "weekly");
assert.equal(deriveAnalyticsCustomPeriod("2026-01-01", "2026-06-29"), "weekly");
assert.equal(deriveAnalyticsCustomPeriod("2026-01-01", "2026-06-30"), "monthly");
assert.equal(deriveAnalyticsCustomPeriod("2026-01-01", "2028-01-01"), "monthly");
assert.equal(deriveAnalyticsCustomPeriod("2026-01-01", "2029-01-02"), "yearly");

assert.deepEqual(
  resolveAnalyticsTimeframe("custom", {
    endDate: "2026-08-28",
    startDate: "2026-08-28",
  }, now),
  {
    endDate: "2026-08-28",
    label: "Aug 28, 2026 - Aug 28, 2026",
    period: "hourly",
    startDate: "2026-08-28",
  },
);

assert.deepEqual(
  resolveAnalyticsTimeframe("day", { anchorDate: "2026-08-23" }, now),
  {
    endDate: "2026-08-23",
    label: "Aug 23, 2026",
    period: "hourly",
    startDate: "2026-08-23",
  },
);

assert.deepEqual(
  resolveAnalyticsTimeframe("day", {
    endDate: "2026-08-25",
    startDate: "2026-08-23",
  }, now),
  {
    endDate: "2026-08-25",
    label: "Aug 23, 2026 - Aug 25, 2026",
    period: "daily",
    startDate: "2026-08-23",
  },
);

assert.deepEqual(
  resolveAnalyticsTimeframe("week", { anchorDate: "2026-08-23" }, now),
  {
    endDate: "2026-08-23",
    label: "Week of Aug 17–23",
    period: "daily",
    startDate: "2026-08-17",
  },
);

assert.deepEqual(
  resolveAnalyticsTimeframe("week", { year: 2026 }, now),
  {
    endDate: "2026-01-04",
    label: "Week of Dec 29, 2025–Jan 4, 2026",
    period: "daily",
    startDate: "2025-12-29",
  },
);

assert.deepEqual(
  resolveAnalyticsTimeframe("week", {
    endDate: "2026-09-02",
    startDate: "2026-08-09",
  }, now),
  {
    endDate: "2026-09-06",
    label: "Aug 3, 2026 - Sep 6, 2026",
    period: "weekly",
    startDate: "2026-08-03",
  },
);

assert.deepEqual(
  resolveAnalyticsTimeframe("month", { month: 2, year: 2024 }, now),
  {
    endDate: "2024-02-29",
    label: "February 2024",
    period: "monthly",
    startDate: "2024-02-01",
  },
);

assert.deepEqual(
  resolveAnalyticsTimeframe("month", {
    endDate: "2026-03-02",
    startDate: "2026-01-15",
  }, now),
  {
    endDate: "2026-03-31",
    label: "January 2026 - March 2026",
    period: "monthly",
    startDate: "2026-01-01",
  },
);

assert.deepEqual(
  resolveAnalyticsTimeframe("year", { year: 2024 }, now),
  {
    endDate: "2024-12-31",
    label: "2024",
    period: "yearly",
    startDate: "2024-01-01",
  },
);

assert.deepEqual(
  resolveAnalyticsTimeframe("year", {
    endDate: "2026-02-01",
    startDate: "2024-03-01",
  }, now),
  {
    endDate: "2026-12-31",
    label: "2024 - 2026",
    period: "yearly",
    startDate: "2024-01-01",
  },
);

assert.equal(
  deriveAnalyticsCustomPeriod("2026-01-01", addDays("2026-01-01", 30)),
  "daily",
);
assert.equal(
  deriveAnalyticsCustomPeriod("2026-01-01", addDays("2026-01-01", 31)),
  "weekly",
);
assert.equal(
  deriveAnalyticsCustomPeriod("2026-01-01", addDays("2026-01-01", 180)),
  "monthly",
);
assert.equal(
  deriveAnalyticsCustomPeriod("2026-01-01", addDays("2026-01-01", 1095)),
  "yearly",
);

assert.deepEqual(
  resolveAnalyticsTimeframe("custom", {
    endDate: "2026-01-01",
    startDate: "2026-01-02",
  }, now),
  {
    endDate: "2026-01-02",
    label: "Jan 1, 2026 - Jan 2, 2026",
    period: "daily",
    startDate: "2026-01-01",
  },
);
