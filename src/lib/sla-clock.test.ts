import assert from "node:assert/strict";
import { test } from "node:test";
import { formatSlaClock, slaMinutesRemaining } from "./sla-clock";

test("slaMinutesRemaining is null without a due date", () => {
  assert.equal(slaMinutesRemaining(null), null);
});

test("formatSlaClock labels late, due now, and upcoming", () => {
  const now = new Date("2026-10-07T06:30:00.000Z");
  assert.equal(formatSlaClock(new Date(now.getTime() - 12 * 60_000), now), "12m late");
  assert.equal(formatSlaClock(now, now), "Due now");
  assert.equal(formatSlaClock(new Date(now.getTime() + 8 * 60_000), now), "due in 8m");
  assert.equal(formatSlaClock(new Date(now.getTime() + 2 * 60 * 60_000), now), "due in 2h");
});
