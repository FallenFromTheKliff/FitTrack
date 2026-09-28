import assert from "node:assert/strict";
import test from "node:test";

import {
  durationPartsFromDays,
  formatMembershipDuration,
  parseMembershipDuration,
} from "./membership-duration.ts";

test("converts duration controls into API days", () => {
  assert.equal(parseMembershipDuration("1", "days").days, 1);
  assert.equal(parseMembershipDuration("1", "weeks").days, 7);
  assert.equal(parseMembershipDuration("9", "months").days, 270);
  assert.equal(parseMembershipDuration("1", "years").days, 365);
  assert.equal(formatMembershipDuration("9", "months"), "9 months");
});

test("initializes stored days with the largest exact conventional unit", () => {
  assert.deepEqual(durationPartsFromDays(90), {
    quantity: "3",
    unit: "months",
  });
  assert.deepEqual(durationPartsFromDays(45), {
    quantity: "45",
    unit: "days",
  });
});

test("rejects invalid and overflowing duration input", () => {
  assert.match(parseMembershipDuration("", "days").error ?? "", /required/);
  assert.match(parseMembershipDuration("0", "days").error ?? "", /positive/);
  assert.match(
    parseMembershipDuration("1.5", "months").error ?? "",
    /whole number/,
  );
  assert.match(
    parseMembershipDuration("9007199254740991", "years").error ?? "",
    /large/,
  );
  assert.throws(() => durationPartsFromDays(0), /positive safe integer/);
});
