import test from "node:test";
import assert from "node:assert/strict";
import { getBookingCalendarTone, getUpcomingBookingDateKeys } from "./bookingCalendar";

test("booking calendar maps missing and empty availability to gray unavailable", () => {
  assert.equal(getBookingCalendarTone(null), "unavailable");
  assert.equal(getBookingCalendarTone([]), "unavailable");
  assert.equal(getBookingCalendarTone([{ status: "unavailable" }]), "unavailable");
});

test("booking calendar maps open and fully occupied slots to mobile tones", () => {
  assert.equal(getBookingCalendarTone([{ status: "available" }, { status: "full" }]), "available");
  assert.equal(getBookingCalendarTone([{ available: true }]), "available");
  assert.equal(getBookingCalendarTone([{ status: "unavailable" }, { status: "available" }]), "available");
  assert.equal(getBookingCalendarTone([{ available: false }]), "full");
  assert.equal(getBookingCalendarTone([{ status: "booked" }, { status: "unavailable" }]), "full");
  assert.equal(getBookingCalendarTone([{ status: "booked" }, { status: "full" }]), "full");
  assert.equal(getBookingCalendarTone([{ status: "unavailable" }, { status: "booked" }]), "full");
});

test("booking calendar date keys cover the same upcoming window as mobile", () => {
  assert.deepEqual(getUpcomingBookingDateKeys("2026-08-25", 2), ["2026-08-25", "2026-08-26"]);
  assert.deepEqual(getUpcomingBookingDateKeys("", 2), []);
});
