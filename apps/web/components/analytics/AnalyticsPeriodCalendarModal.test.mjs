import assert from "node:assert/strict";

import {
  getAnalyticsPeriodWeekOptions,
  getAnalyticsPeriodYearPage,
  getPeriodInitialValue,
  isPeriodAnchorSelectable,
  normalizePeriodValue,
  parsePeriodYmd,
} from "../analytics/AnalyticsPeriodCalendarModal.logic.ts";

function testNormalizeModes() {
  assert.equal(normalizePeriodValue("2026-08-26", "day"), "2026-08-26");
  assert.equal(normalizePeriodValue("2026-08-26", "week"), "2026-08-24");
  assert.equal(normalizePeriodValue("2026-08-26", "month"), "2026-08-01");
  assert.equal(normalizePeriodValue("2026-08-26", "year"), "2026-01-01");
  assert.equal(normalizePeriodValue("2026-02-30", "day"), null);
}

function testWeekOptions() {
  const options = getAnalyticsPeriodWeekOptions(2026);
  assert.equal(options.length, 53);
  assert.equal(options[0].start, "2025-12-29");
  assert.equal(options.at(-1).start, "2026-12-28");
  assert.equal(options[0].end, "2026-01-04");
  assert.equal(options.every((option, index) => {
    const date = new Date(`${option.start}T00:00:00.000Z`);
    const previous = options[index - 1];
    return date.getUTCDay() === 1 && (!previous || date.getTime() - new Date(`${previous.start}T00:00:00.000Z`).getTime() === 7 * 24 * 60 * 60 * 1000);
  }), true);
}

function testPeriodBounds() {
  assert.equal(isPeriodAnchorSelectable("2026-01-01", "month", "2026-02-15", "2026-04-01"), false);
  assert.equal(isPeriodAnchorSelectable("2026-02-01", "month", "2026-02-15", "2026-04-01"), true);
  assert.equal(isPeriodAnchorSelectable("2026-02-02", "week", "2026-02-15", "2026-03-01"), false);
  assert.equal(isPeriodAnchorSelectable("2026-02-16", "week", "2026-02-15", "2026-03-01"), true);
}

function testYearPages() {
  assert.deepEqual(getAnalyticsPeriodYearPage(2026), {
    end: 2028,
    start: 2017,
    values: [2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026, 2027, 2028],
  });
  assert.equal(getAnalyticsPeriodYearPage(9999).end, 9999);
  assert.equal(getAnalyticsPeriodYearPage(9999).values.length, 3);
}

function testInitialCursor() {
  const today = new Date("2026-08-28T12:00:00.000Z");
  assert.equal(getPeriodInitialValue("week", "2026-08-26", undefined, undefined, today), "2026-08-24");
  assert.equal(getPeriodInitialValue("month", undefined, "2025-03-17", undefined, today), "2025-03-01");
  assert.equal(getPeriodInitialValue("year", undefined, undefined, undefined, today), "2026-01-01");
  assert.deepEqual(parsePeriodYmd("2026-08-28"), { day: 28, month: 8, year: 2026 });
}

testNormalizeModes();
testWeekOptions();
testPeriodBounds();
testYearPages();
testInitialCursor();
console.log("AnalyticsPeriodCalendarModal logic checks passed");
