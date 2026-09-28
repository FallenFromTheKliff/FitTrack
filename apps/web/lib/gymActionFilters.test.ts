import assert from "node:assert/strict";
import test from "node:test";

import { toInclusiveLocalBoundary } from "./gymActionFilters";

test("creates inclusive local-day boundaries for attendance queries", () => {
  const start = new Date(toInclusiveLocalBoundary("2026-08-28", "start")!);
  const end = new Date(toInclusiveLocalBoundary("2026-08-28", "end")!);

  assert.equal(start.getFullYear(), 2026);
  assert.equal(start.getMonth(), 7);
  assert.equal(start.getDate(), 28);
  assert.equal(start.getHours(), 0);
  assert.equal(start.getMinutes(), 0);
  assert.equal(end.getFullYear(), 2026);
  assert.equal(end.getMonth(), 7);
  assert.equal(end.getDate(), 28);
  assert.equal(end.getHours(), 23);
  assert.equal(end.getMinutes(), 59);
  assert.equal(end.getSeconds(), 59);
  assert.equal(end.getMilliseconds(), 999);
});

test("rejects empty and malformed calendar values", () => {
  assert.equal(toInclusiveLocalBoundary("", "start"), undefined);
  assert.equal(toInclusiveLocalBoundary("not-a-date", "end"), undefined);
});
